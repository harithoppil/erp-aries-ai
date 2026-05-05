"""Inventory: Items, Stock Ledger, Transfers, Reconciliations."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.inventory import *

router = APIRouter(prefix="/inventory", tags=["Inventory"])

class ItemCreate(BaseModel):
    company_id: uuid.UUID
    item_code: str
    item_name: str
    description: str | None = None
    item_group: str | None = None
    is_stock_item: bool = True
    default_warehouse_id: uuid.UUID | None = None
    stock_uom: str = "Nos"
    valuation_method: str = "FIFO"

@router.get("/items/")
async def list_items(page: int=1, page_size: int=20, company_id: uuid.UUID=None, item_group: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Item).where(Item.is_active==True)
    if company_id: q = q.where(Item.company_id==company_id)
    if item_group: q = q.where(Item.item_group==item_group)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/items/")
async def create_item(data: ItemCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    it = Item(**data.model_dump()); db.add(it); await db.commit(); await db.refresh(it)
    return {"data": it}

@router.get("/stock-ledger/")
async def list_stock_ledger(page: int=1, page_size: int=20, company_id: uuid.UUID=None, item_id: uuid.UUID=None, warehouse_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(StockLedgerEntry)
    if company_id: q = q.where(StockLedgerEntry.company_id==company_id)
    if item_id: q = q.where(StockLedgerEntry.item_id==item_id)
    if warehouse_id: q = q.where(StockLedgerEntry.warehouse_id==warehouse_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(StockLedgerEntry.posting_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.get("/stock-balance/")
async def stock_balance(company_id: uuid.UUID=None, item_id: uuid.UUID=None, warehouse_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """Compute current stock balance per item+warehouse."""
    from sqlalchemy import func
    q = select(
        StockLedgerEntry.item_id, StockLedgerEntry.warehouse_id,
        func.sum(StockLedgerEntry.qty_change).label("qty"),
        func.max(StockLedgerEntry.valuation_rate).label("rate"),
    ).group_by(StockLedgerEntry.item_id, StockLedgerEntry.warehouse_id)
    if company_id: q = q.where(StockLedgerEntry.company_id==company_id)
    if item_id: q = q.having(StockLedgerEntry.item_id==item_id)
    if warehouse_id: q = q.having(StockLedgerEntry.warehouse_id==warehouse_id)
    result = await db.execute(q)
    rows = result.all()
    data = [{"item_id": str(r.item_id), "warehouse_id": str(r.warehouse_id), "qty": r.qty, "valuation_rate": r.rate, "value": (r.qty or 0) * (r.rate or 0)} for r in rows]
    return {"data": data}

@router.get("/transfers/")
async def list_transfers(page: int=1, page_size: int=20, company_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(StockTransfer).where(StockTransfer.is_active==True)
    if company_id: q = q.where(StockTransfer.company_id==company_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(StockTransfer.posting_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}
