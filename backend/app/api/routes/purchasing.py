"""Purchasing: Suppliers, POs, Receipts, Invoices."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.purchasing import *

router = APIRouter(prefix="/purchasing", tags=["Purchasing"])

class SupplierCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    tax_id: str | None = None
    address: dict | None = None

class POItemCreate(BaseModel):
    item_id: uuid.UUID | None = None
    qty: float = 1.0
    rate: float = 0.0
    warehouse_id: uuid.UUID | None = None

class POCreate(BaseModel):
    company_id: uuid.UUID
    supplier_id: uuid.UUID
    date: str
    required_by_date: str | None = None
    items: list[POItemCreate] = []

def _list_model(model, page, page_size, company_id, status, db, order_by=None):
    q = select(model).where(model.is_active==True)
    if company_id: q = q.where(model.company_id==company_id)
    if status: q = q.where(model.status==status)
    total = db.execute(select(func.count()).select_from(q.subquery()))
    q = q.offset((page-1)*page_size).limit(page_size)
    if order_by: q = q.order_by(order_by.desc())
    return q, total

@router.get("/suppliers/")
async def list_suppliers(page: int=1, page_size: int=20, company_id: uuid.UUID=None, search: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Supplier).where(Supplier.is_active==True)
    if company_id: q = q.where(Supplier.company_id==company_id)
    if search: q = q.where(or_(Supplier.name.ilike(f"%{search}%"), Supplier.email.ilike(f"%{search}%")))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/suppliers/")
async def create_supplier(data: SupplierCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    s = Supplier(**data.model_dump()); db.add(s); await db.commit(); await db.refresh(s)
    return {"data": s}

@router.get("/purchase-orders/")
async def list_pos(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(PurchaseOrder).where(PurchaseOrder.is_active==True)
    if company_id: q = q.where(PurchaseOrder.company_id==company_id)
    if status: q = q.where(PurchaseOrder.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(PurchaseOrder.date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/purchase-orders/")
async def create_po(data: POCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump(); items_data = d.pop("items", [])
    d["date"] = dt.fromisoformat(d["date"]) if d.get("date") else dt.today()
    if d.get("required_by_date"): d["required_by_date"] = dt.fromisoformat(d["required_by_date"])
    total = sum(i["qty"]*i["rate"] for i in items_data)
    d.update({"total_amount": total, "grand_total": total, "tax_amount": 0, "total_qty": sum(i["qty"] for i in items_data)})
    po = PurchaseOrder(**d); db.add(po); await db.flush()
    for it in items_data:
        db.add(PurchaseOrderItem(purchase_order_id=po.id, amount=it["qty"]*it["rate"], received_qty=0, **{k:v for k,v in it.items() if k not in ["amount"]}))
    await db.commit(); await db.refresh(po)
    return {"data": po, "message": "Purchase Order created"}

@router.get("/purchase-receipts/")
async def list_receipts(page: int=1, page_size: int=20, company_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(PurchaseReceipt).where(PurchaseReceipt.is_active==True)
    if company_id: q = q.where(PurchaseReceipt.company_id==company_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(PurchaseReceipt.date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.get("/purchase-invoices/")
async def list_pinv(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(PurchaseInvoice).where(PurchaseInvoice.is_active==True)
    if company_id: q = q.where(PurchaseInvoice.company_id==company_id)
    if status: q = q.where(PurchaseInvoice.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(PurchaseInvoice.date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}
