"""Accounting: Chart of Accounts, Journal Entries, GL, Fiscal Years."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.accounting import *

router = APIRouter(prefix="/accounting", tags=["Accounting"])

class AccountCreate(BaseModel):
    company_id: uuid.UUID
    code: str
    name: str
    account_type: str  # Asset/Liability/Equity/Income/Expense
    parent_id: uuid.UUID | None = None
    is_group: bool = False
    root_type: str | None = None

class JELineCreate(BaseModel):
    account_id: uuid.UUID
    debit: float = 0.0
    credit: float = 0.0
    description: str | None = None
    cost_center: str | None = None

class JournalEntryCreate(BaseModel):
    company_id: uuid.UUID
    entry_number: str
    posting_date: str
    reference_type: str | None = None
    reference_id: uuid.UUID | None = None
    notes: str | None = None
    lines: list[JELineCreate] = []

class FiscalYearCreate(BaseModel):
    company_id: uuid.UUID
    year_start_date: str
    year_end_date: str

@router.get("/accounts/")
async def list_accounts(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(Account).where(Account.company_id==company_id, Account.is_active==True).order_by(Account.code))).scalars().all()
    return {"data": items}

@router.post("/accounts/")
async def create_account(data: AccountCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    a = Account(**data.model_dump()); db.add(a); await db.commit(); await db.refresh(a)
    return {"data": a}

@router.get("/journal-entries/")
async def list_je(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(JournalEntry).where(JournalEntry.is_active==True)
    if company_id: q = q.where(JournalEntry.company_id==company_id)
    if status: q = q.where(JournalEntry.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(JournalEntry.posting_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/journal-entries/")
async def create_je(data: JournalEntryCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump(); lines = d.pop("lines", [])
    d["posting_date"] = dt.fromisoformat(d["posting_date"])
    total_debit = sum(l["debit"] for l in lines)
    total_credit = sum(l["credit"] for l in lines)
    if abs(total_debit - total_credit) > 0.001:
        raise HTTPException(400, f"Debits ({total_debit}) must equal Credits ({total_credit})")
    d["total_debit"] = total_debit
    d["total_credit"] = total_credit
    je = JournalEntry(**d); db.add(je); await db.flush()
    for ln in lines:
        db.add(JournalEntryLine(journal_entry_id=je.id, **ln))
    await db.commit(); await db.refresh(je)
    return {"data": je, "message": "Journal Entry created"}

@router.post("/journal-entries/{id}/submit")
async def submit_je(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    je = (await db.execute(select(JournalEntry).where(JournalEntry.id==id))).scalar_one_or_none()
    if not je: raise HTTPException(404, "Not found")
    # Create GL entries
    lines = (await db.execute(select(JournalEntryLine).where(JournalEntryLine.journal_entry_id==id))).scalars().all()
    for ln in lines:
        if ln.debit > 0 or ln.credit > 0:
            gl = GeneralLedgerEntry(
                company_id=je.company_id, posting_date=je.posting_date,
                account_id=ln.account_id, voucher_type="Journal Entry",
                voucher_id=je.id, debit=ln.debit, credit=ln.credit,
                description=ln.description,
            )
            db.add(gl)
    je.status = "Submitted"
    await db.commit()
    return {"message": "Journal Entry submitted, GL entries created"}

@router.get("/general-ledger/")
async def list_gl(page: int=1, page_size: int=20, company_id: uuid.UUID=None, account_id: uuid.UUID=None, from_date: str=None, to_date: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(GeneralLedgerEntry)
    if company_id: q = q.where(GeneralLedgerEntry.company_id==company_id)
    if account_id: q = q.where(GeneralLedgerEntry.account_id==account_id)
    if from_date: q = q.where(GeneralLedgerEntry.posting_date >= dt.fromisoformat(from_date))
    if to_date: q = q.where(GeneralLedgerEntry.posting_date <= dt.fromisoformat(to_date))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(GeneralLedgerEntry.posting_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.get("/fiscal-years/")
async def list_fiscal_years(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(FiscalYear).where(FiscalYear.company_id==company_id))).scalars().all()
    return {"data": items}

@router.post("/fiscal-years/")
async def create_fiscal_year(data: FiscalYearCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["year_start_date"] = dt.fromisoformat(d["year_start_date"])
    d["year_end_date"] = dt.fromisoformat(d["year_end_date"])
    fy = FiscalYear(**d); db.add(fy); await db.commit(); await db.refresh(fy)
    return {"data": fy}
