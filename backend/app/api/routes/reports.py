"""Financial Reports: P&L, Balance Sheet, AR/AP Aging, Tax."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, case, extract
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.accounting import Account, GeneralLedgerEntry
from backend.app.models.sales import SalesInvoice, Customer
from backend.app.models.purchasing import PurchaseInvoice, Supplier

router = APIRouter(prefix="/reports", tags=["Reports"])

@router.get("/profit-loss")
async def profit_loss(company_id: uuid.UUID, from_date: str, to_date: str, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """P&L: Income - Expenses for date range."""
    # Get income accounts and sum
    income_q = select(func.sum(GeneralLedgerEntry.credit - GeneralLedgerEntry.debit)).where(
        GeneralLedgerEntry.company_id==company_id,
        GeneralLedgerEntry.posting_date >= dt.fromisoformat(from_date),
        GeneralLedgerEntry.posting_date <= dt.fromisoformat(to_date),
    ).select_from(Account).where(Account.account_type=="Income")
    # Actually do it properly with a join
    from sqlalchemy.orm import joinedload
    q = select(
        Account.account_type,
        func.sum(GeneralLedgerEntry.credit - GeneralLedgerEntry.debit).label("amount")
    ).join(GeneralLedgerEntry, Account.id==GeneralLedgerEntry.account_id).where(
        GeneralLedgerEntry.company_id==company_id,
        GeneralLedgerEntry.posting_date >= dt.fromisoformat(from_date),
        GeneralLedgerEntry.posting_date <= dt.fromisoformat(to_date),
        Account.account_type.in_(["Income", "Expense"])
    ).group_by(Account.account_type)
    result = await db.execute(q)
    rows = {r.account_type: r.amount for r in result.all()}
    revenue = rows.get("Income", 0) or 0
    expenses = rows.get("Expense", 0) or 0
    return {
        "data": {
            "revenue": round(revenue, 2),
            "expenses": round(expenses, 2),
            "gross_profit": round(revenue - expenses, 2),
            "net_profit": round(revenue - expenses, 2),
            "period": {"from": from_date, "to": to_date}
        }
    }

@router.get("/balance-sheet")
async def balance_sheet(company_id: uuid.UUID, as_of_date: str, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(
        Account.account_type,
        func.sum(GeneralLedgerEntry.credit - GeneralLedgerEntry.debit).label("amount")
    ).join(GeneralLedgerEntry, Account.id==GeneralLedgerEntry.account_id).where(
        GeneralLedgerEntry.company_id==company_id,
        GeneralLedgerEntry.posting_date <= dt.fromisoformat(as_of_date),
        Account.account_type.in_(["Asset", "Liability", "Equity"])
    ).group_by(Account.account_type)
    result = await db.execute(q)
    rows = {r.account_type: r.amount for r in result.all()}
    assets = abs(rows.get("Asset", 0) or 0)
    liabilities = abs(rows.get("Liability", 0) or 0)
    equity = rows.get("Equity", 0) or 0
    return {
        "data": {
            "assets": round(assets, 2),
            "liabilities": round(liabilities, 2),
            "equity": round(equity, 2),
            "total_liabilities_equity": round(liabilities + equity, 2),
            "balanced": abs(assets - (liabilities + equity)) < 0.01,
            "as_of_date": as_of_date
        }
    }

@router.get("/ar-aging")
async def ar_aging(company_id: uuid.UUID, as_of_date: str = None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """AR Aging: outstanding invoices grouped by days overdue."""
    from sqlalchemy import case, literal_column
    if as_of_date:
        cutoff = dt.fromisoformat(as_of_date)
    else:
        cutoff = dt.today()
    q = select(
        case(
            (SalesInvoice.due_date == None, "No Due Date"),
            ((cutoff - SalesInvoice.due_date).days <= 30, "0-30"),
            ((cutoff - SalesInvoice.due_date).days <= 60, "31-60"),
            ((cutoff - SalesInvoice.due_date).days <= 90, "61-90"),
            else_="90+"
        ).label("bucket"),
        func.sum(SalesInvoice.outstanding_amount).label("amount"),
        func.count().label("count")
    ).where(
        SalesInvoice.company_id==company_id,
        SalesInvoice.status.in_(["Submitted", "Overdue"]),
        SalesInvoice.outstanding_amount > 0
    ).group_by("bucket")
    result = await db.execute(q)
    rows = [{"bucket": r.bucket, "amount": round(r.amount or 0, 2), "count": r.count} for r in result.all()]
    total = sum(r["amount"] for r in rows)
    return {"data": {"buckets": rows, "total_outstanding": round(total, 2), "as_of_date": cutoff.isoformat()}}

@router.get("/ap-aging")
async def ap_aging(company_id: uuid.UUID, as_of_date: str = None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """AP Aging: outstanding purchase invoices grouped by days overdue."""
    from sqlalchemy import case
    cutoff = dt.fromisoformat(as_of_date) if as_of_date else dt.today()
    q = select(
        case(
            (PurchaseInvoice.due_date == None, "No Due Date"),
            ((cutoff - PurchaseInvoice.due_date).days <= 30, "0-30"),
            ((cutoff - PurchaseInvoice.due_date).days <= 60, "31-60"),
            ((cutoff - PurchaseInvoice.due_date).days <= 90, "61-90"),
            else_="90+"
        ).label("bucket"),
        func.sum(PurchaseInvoice.outstanding_amount).label("amount"),
        func.count().label("count")
    ).where(
        PurchaseInvoice.company_id==company_id,
        PurchaseInvoice.status.in_(["Submitted", "Overdue"]),
        PurchaseInvoice.outstanding_amount > 0
    ).group_by("bucket")
    result = await db.execute(q)
    rows = [{"bucket": r.bucket, "amount": round(r.amount or 0, 2), "count": r.count} for r in result.all()]
    total = sum(r["amount"] for r in rows)
    return {"data": {"buckets": rows, "total_outstanding": round(total, 2), "as_of_date": cutoff.isoformat()}}

@router.get("/tax-summary")
async def tax_summary(company_id: uuid.UUID, from_date: str, to_date: str, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """UAE VAT 5% summary: output tax (on sales) and input tax (on purchases)."""
    sales_tax = (await db.execute(
        select(func.sum(SalesInvoice.tax_amount)).where(
            SalesInvoice.company_id==company_id,
            SalesInvoice.posting_date >= dt.fromisoformat(from_date),
            SalesInvoice.posting_date <= dt.fromisoformat(to_date),
        )
    )).scalar() or 0
    purchase_tax = (await db.execute(
        select(func.sum(PurchaseInvoice.tax_amount)).where(
            PurchaseInvoice.company_id==company_id,
            PurchaseInvoice.posting_date >= dt.fromisoformat(from_date),
            PurchaseInvoice.posting_date <= dt.fromisoformat(to_date),
        )
    )).scalar() or 0
    return {
        "data": {
            "output_tax": round(sales_tax, 2),
            "input_tax": round(purchase_tax, 2),
            "net_vat_payable": round(sales_tax - purchase_tax, 2),
            "vat_rate": 5.0,
            "period": {"from": from_date, "to": to_date}
        }
    }
