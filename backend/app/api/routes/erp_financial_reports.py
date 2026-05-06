"""Financial Reports API — Phase 1.

Chart of Accounts, General Ledger, Trial Balance, Balance Sheet, P&L.
All queries run against Azure PostgreSQL.
"""

import uuid
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.erp import (
    Account, GLEntry, JournalEntry, JournalEntryLine,
    FiscalYear, CostCenter, Subsidiary,
)

router = APIRouter(prefix="/erp", tags=["financial-reports"])


# ═══════════════════════════════════════════════════════════════════
# CHART OF ACCOUNTS
# ═══════════════════════════════════════════════════════════════════

@router.get("/accounts/tree")
async def chart_of_accounts(
    company: str = Query("Aries Marine"),
    root_type: str | None = Query(None, description="Filter by root type: Asset, Liability, Equity, Income, Expense"),
    db: AsyncSession = Depends(get_db),
):
    """Return the Chart of Accounts as a nested-set tree.
    
    Ordered by `lft` for correct tree traversal. Use `level` to indent in UI.
    """
    stmt = select(Account).where(Account.company == company)
    if root_type:
        stmt = stmt.where(Account.root_type == root_type)
    stmt = stmt.order_by(Account.lft)
    
    result = await db.execute(stmt)
    accounts = result.scalars().all()
    
    # Compute tree level from nested set
    def build_tree(accts):
        stack = []
        for a in accts:
            level = len(stack)
            # Pop stack until we find the parent
            while stack and stack[-1].rgt < a.rgt:
                stack.pop()
            level = len(stack)
            stack.append(a)
            yield {
                "id": str(a.id),
                "name": a.name,
                "account_number": a.account_number,
                "account_type": a.account_type,
                "root_type": a.root_type,
                "parent_account": a.parent_account,
                "is_group": a.is_group,
                "balance": a.balance,
                "lft": a.lft,
                "rgt": a.rgt,
                "level": level,
                "has_children": a.rgt - a.lft > 1,
            }
    
    return {"company": company, "count": len(accounts), "accounts": list(build_tree(accounts))}


# ═══════════════════════════════════════════════════════════════════
# GENERAL LEDGER
# ═══════════════════════════════════════════════════════════════════

@router.get("/reports/general-ledger")
async def general_ledger(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    account_id: str | None = Query(None),
    voucher_no: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """General Ledger — all GL entries in date range with running balance."""
    
    # Base filter
    filters = [GLEntry.posting_date >= from_date, GLEntry.posting_date <= to_date]
    if account_id:
        filters.append(GLEntry.account_id == uuid.UUID(account_id))
    if voucher_no:
        filters.append(GLEntry.voucher_no.ilike(f"%{voucher_no}%"))
    
    # Count total
    count_stmt = select(func.count()).select_from(GLEntry).where(and_(*filters))
    total = (await db.execute(count_stmt)).scalar() or 0
    
    # Fetch entries ordered by date, then voucher
    stmt = (
        select(GLEntry)
        .where(and_(*filters))
        .order_by(GLEntry.posting_date, GLEntry.voucher_no, GLEntry.created_at)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    entries = result.scalars().all()
    
    # Build response with running balance
    response = []
    running_balance = 0.0
    for e in entries:
        debit = float(e.debit) if e.debit else 0.0
        credit = float(e.credit) if e.credit else 0.0
        running_balance += debit - credit
        response.append({
            "id": str(e.id),
            "posting_date": e.posting_date.isoformat() if e.posting_date else None,
            "account_id": str(e.account_id) if e.account_id else None,
            "party_type": e.party_type,
            "party_name": e.party_name,
            "voucher_type": e.voucher_type,
            "voucher_no": e.voucher_no,
            "debit": debit,
            "credit": credit,
            "balance": round(running_balance, 2),
            "cost_center": e.cost_center,
            "project_id": str(e.project_id) if e.project_id else None,
            "remarks": e.remarks,
        })
    
    return {
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "total": total,
        "limit": limit,
        "offset": offset,
        "entries": response,
    }


# ═══════════════════════════════════════════════════════════════════
# TRIAL BALANCE
# ═══════════════════════════════════════════════════════════════════

@router.get("/reports/trial-balance")
async def trial_balance(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    company: str = Query("Aries Marine"),
    show_zero_values: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Trial Balance — opening, period movement, closing per account."""
    
    # Get all accounts for this company
    acct_stmt = select(Account).where(Account.company == company).order_by(Account.lft)
    result = await db.execute(acct_stmt)
    accounts = result.scalars().all()
    
    # Get opening balances (before from_date)
    opening_stmt = (
        select(GLEntry.account_id, func.sum(GLEntry.debit).label("debit"), func.sum(GLEntry.credit).label("credit"))
        .where(GLEntry.posting_date < from_date)
        .group_by(GLEntry.account_id)
    )
    result = await db.execute(opening_stmt)
    opening_map = {str(r.account_id): (float(r.debit or 0), float(r.credit or 0)) for r in result.all()}
    
    # Get period movements
    period_stmt = (
        select(GLEntry.account_id, func.sum(GLEntry.debit).label("debit"), func.sum(GLEntry.credit).label("credit"))
        .where(GLEntry.posting_date >= from_date, GLEntry.posting_date <= to_date)
        .group_by(GLEntry.account_id)
    )
    result = await db.execute(period_stmt)
    period_map = {str(r.account_id): (float(r.debit or 0), float(r.credit or 0)) for r in result.all()}
    
    rows = []
    for a in accounts:
        aid = str(a.id)
        op_dr, op_cr = opening_map.get(aid, (0.0, 0.0))
        per_dr, per_cr = period_map.get(aid, (0.0, 0.0))
        
        opening = op_dr - op_cr
        closing = opening + per_dr - per_cr
        
        # Skip zero-balance accounts unless requested
        if not show_zero_values and opening == 0 and per_dr == 0 and per_cr == 0 and closing == 0:
            continue
        
        rows.append({
            "id": aid,
            "name": a.name,
            "account_number": a.account_number,
            "root_type": a.root_type,
            "is_group": a.is_group,
            "opening_debit": round(max(opening, 0), 2) if opening > 0 else 0,
            "opening_credit": round(abs(min(opening, 0)), 2) if opening < 0 else 0,
            "debit": round(per_dr, 2),
            "credit": round(per_cr, 2),
            "closing_debit": round(max(closing, 0), 2) if closing > 0 else 0,
            "closing_credit": round(abs(min(closing, 0)), 2) if closing < 0 else 0,
        })
    
    return {
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "company": company,
        "count": len(rows),
        "accounts": rows,
    }


# ═══════════════════════════════════════════════════════════════════
# BALANCE SHEET
# ═══════════════════════════════════════════════════════════════════

@router.get("/reports/balance-sheet")
async def balance_sheet(
    as_of_date: date = Query(..., description="As-of date (YYYY-MM-DD)"),
    company: str = Query("Aries Marine"),
    show_zero_values: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Balance Sheet — Assets = Liabilities + Equity as of a date."""
    
    # Get accounts
    acct_stmt = (
        select(Account)
        .where(Account.company == company, Account.root_type.in_(["Asset", "Liability", "Equity"]))
        .order_by(Account.lft)
    )
    result = await db.execute(acct_stmt)
    accounts = result.scalars().all()
    
    # Get balances up to as_of_date
    bal_stmt = (
        select(GLEntry.account_id, func.sum(GLEntry.debit).label("debit"), func.sum(GLEntry.credit).label("credit"))
        .where(GLEntry.posting_date <= as_of_date)
        .group_by(GLEntry.account_id)
    )
    result = await db.execute(bal_stmt)
    balance_map = {str(r.account_id): float(r.debit or 0) - float(r.credit or 0) for r in result.all()}
    
    def build_section(root_type: str):
        section_accounts = [a for a in accounts if a.root_type == root_type]
        items = []
        total = 0.0
        for a in section_accounts:
            bal = balance_map.get(str(a.id), 0.0)
            if not show_zero_values and bal == 0 and not a.is_group:
                continue
            if not a.is_group:
                total += bal
            items.append({
                "id": str(a.id),
                "name": a.name,
                "account_number": a.account_number,
                "is_group": a.is_group,
                "balance": round(bal, 2),
                "level": 0,  # TODO: compute from nested set
            })
        return items, round(total, 2)
    
    assets, total_assets = build_section("Asset")
    liabilities, total_liabilities = build_section("Liability")
    equity, total_equity = build_section("Equity")
    
    return {
        "as_of_date": as_of_date.isoformat(),
        "company": company,
        "assets": {"accounts": assets, "total": total_assets},
        "liabilities": {"accounts": liabilities, "total": total_liabilities},
        "equity": {"accounts": equity, "total": total_equity},
        "total_liabilities_and_equity": round(total_liabilities + total_equity, 2),
    }


# ═══════════════════════════════════════════════════════════════════
# PROFIT & LOSS
# ═══════════════════════════════════════════════════════════════════

@router.get("/reports/profit-and-loss")
async def profit_and_loss(
    from_date: date = Query(..., description="Start date (YYYY-MM-DD)"),
    to_date: date = Query(..., description="End date (YYYY-MM-DD)"),
    company: str = Query("Aries Marine"),
    show_zero_values: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Profit & Loss (Income Statement) — Income - Expenses over a period."""
    
    acct_stmt = (
        select(Account)
        .where(Account.company == company, Account.root_type.in_(["Income", "Expense"]))
        .order_by(Account.lft)
    )
    result = await db.execute(acct_stmt)
    accounts = result.scalars().all()
    
    # Get period balances
    bal_stmt = (
        select(GLEntry.account_id, func.sum(GLEntry.debit).label("debit"), func.sum(GLEntry.credit).label("credit"))
        .where(GLEntry.posting_date >= from_date, GLEntry.posting_date <= to_date)
        .group_by(GLEntry.account_id)
    )
    result = await db.execute(bal_stmt)
    balance_map = {str(r.account_id): float(r.credit or 0) - float(r.debit or 0) for r in result.all()}
    
    def build_section(root_type: str):
        section_accounts = [a for a in accounts if a.root_type == root_type]
        items = []
        total = 0.0
        for a in section_accounts:
            bal = balance_map.get(str(a.id), 0.0)
            if not show_zero_values and bal == 0 and not a.is_group:
                continue
            if not a.is_group:
                total += bal
            items.append({
                "id": str(a.id),
                "name": a.name,
                "account_number": a.account_number,
                "is_group": a.is_group,
                "balance": round(bal, 2),
                "level": 0,
            })
        return items, round(total, 2)
    
    income, total_income = build_section("Income")
    expenses, total_expenses = build_section("Expense")
    net_profit = round(total_income - total_expenses, 2)
    
    return {
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "company": company,
        "income": {"accounts": income, "total": total_income},
        "expenses": {"accounts": expenses, "total": total_expenses},
        "net_profit": net_profit,
        "is_profit": net_profit >= 0,
    }
