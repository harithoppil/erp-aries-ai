"""Sales: Customers, Quotations, Orders, Invoices, Payments."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.sales import *

router = APIRouter(prefix="/sales", tags=["Sales"])

# ── Customers ──
class CustomerCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    email: str | None = None
    phone: str | None = None
    tax_id: str | None = None
    address: dict | None = None
    credit_limit: float = 0.0
    payment_terms: int = 30

@router.get("/customers/")
async def list_customers(page: int=1, page_size: int=20, company_id: uuid.UUID=None, search: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Customer).where(Customer.is_active==True)
    if company_id: q = q.where(Customer.company_id==company_id)
    if search: q = q.where(or_(Customer.name.ilike(f"%{search}%"), Customer.email.ilike(f"%{search}%")))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.get("/customers/{id}")
async def get_customer(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    item = (await db.execute(select(Customer).where(Customer.id==id))).scalar_one_or_none()
    if not item: raise HTTPException(404, "Not found")
    return {"data": item}

@router.post("/customers/")
async def create_customer(data: CustomerCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    item = Customer(**data.model_dump())
    db.add(item); await db.commit(); await db.refresh(item)
    return {"data": item, "message": "Customer created"}

@router.put("/customers/{id}")
async def update_customer(id: uuid.UUID, data: CustomerCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    item = (await db.execute(select(Customer).where(Customer.id==id))).scalar_one_or_none()
    if not item: raise HTTPException(404, "Not found")
    for k,v in data.model_dump(exclude_unset=True).items(): setattr(item,k,v)
    await db.commit(); return {"data": item}

@router.delete("/customers/{id}")
async def delete_customer(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    item = (await db.execute(select(Customer).where(Customer.id==id))).scalar_one_or_none()
    if item: item.is_active=False; await db.commit()
    return {"message": "Deleted"}

# ── Quotations ──
class QuotationItemCreate(BaseModel):
    item_id: uuid.UUID | None = None
    description: str | None = None
    qty: float = 1.0
    rate: float = 0.0
    tax_rate: float = 0.0

class QuotationCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    date: str
    expiry_date: str | None = None
    status: str = "Draft"
    terms_and_conditions: str | None = None
    items: list[QuotationItemCreate] = []

@router.get("/quotations/")
async def list_quotations(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Quotation).where(Quotation.is_active==True)
    if company_id: q = q.where(Quotation.company_id==company_id)
    if status: q = q.where(Quotation.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(Quotation.date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/quotations/")
async def create_quotation(data: QuotationCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    from datetime import date as dt
    d = data.model_dump()
    items_data = d.pop("items", [])
    d["date"] = dt.fromisoformat(d["date"]) if d.get("date") else dt.today()
    if d.get("expiry_date"): d["expiry_date"] = dt.fromisoformat(d["expiry_date"])
    # Calculate totals
    total_amount = sum(i["qty"] * i["rate"] for i in items_data)
    tax_amount = sum(i["qty"] * i["rate"] * (i.get("tax_rate",0)/100) for i in items_data)
    d["total_amount"] = total_amount
    d["tax_amount"] = tax_amount
    d["grand_total"] = total_amount + tax_amount
    d["total_qty"] = sum(i["qty"] for i in items_data)
    qtn = Quotation(**d)
    db.add(qtn); await db.flush()
    for it in items_data:
        it["amount"] = it["qty"] * it["rate"]
        db.add(QuotationItem(quotation_id=qtn.id, **it))
    await db.commit(); await db.refresh(qtn)
    return {"data": qtn, "message": "Quotation created"}

# ── Sales Orders ──
class SalesOrderCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    quotation_id: uuid.UUID | None = None
    date: str
    delivery_date: str | None = None
    items: list[QuotationItemCreate] = []

@router.get("/orders/")
async def list_orders(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(SalesOrder).where(SalesOrder.is_active==True)
    if company_id: q = q.where(SalesOrder.company_id==company_id)
    if status: q = q.where(SalesOrder.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(SalesOrder.date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/orders/")
async def create_order(data: SalesOrderCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    from datetime import date as dt
    d = data.model_dump(); items_data = d.pop("items", [])
    d["date"] = dt.fromisoformat(d["date"]) if d.get("date") else dt.today()
    if d.get("delivery_date"): d["delivery_date"] = dt.fromisoformat(d["delivery_date"])
    total = sum(i["qty"]*i["rate"] for i in items_data)
    d.update({"total_amount": total, "grand_total": total, "tax_amount": 0, "total_qty": sum(i["qty"] for i in items_data)})
    so = SalesOrder(**d); db.add(so); await db.flush()
    for it in items_data:
        db.add(SalesOrderItem(sales_order_id=so.id, amount=it["qty"]*it["rate"], **{k:v for k,v in it.items() if k != "tax_rate"}))
    await db.commit(); await db.refresh(so)
    return {"data": so, "message": "Sales Order created"}

@router.post("/orders/{id}/cancel")
async def cancel_order(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    item = (await db.execute(select(SalesOrder).where(SalesOrder.id==id))).scalar_one_or_none()
    if not item: raise HTTPException(404, "Not found")
    item.status = "Cancelled"; await db.commit()
    return {"message": "Sales Order cancelled"}

# ── Sales Invoices ──
class SalesInvoiceCreate(BaseModel):
    company_id: uuid.UUID
    customer_id: uuid.UUID
    sales_order_id: uuid.UUID | None = None
    date: str
    due_date: str | None = None
    items: list[QuotationItemCreate] = []

@router.get("/invoices/")
async def list_invoices(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(SalesInvoice).where(SalesInvoice.is_active==True)
    if company_id: q = q.where(SalesInvoice.company_id==company_id)
    if status: q = q.where(SalesInvoice.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(SalesInvoice.date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/invoices/")
async def create_invoice(data: SalesInvoiceCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    from datetime import date as dt
    d = data.model_dump(); items_data = d.pop("items", [])
    d["date"] = dt.fromisoformat(d["date"]) if d.get("date") else dt.today()
    if d.get("due_date"): d["due_date"] = dt.fromisoformat(d["due_date"])
    total = sum(i["qty"]*i["rate"] for i in items_data)
    d.update({"total_amount": total, "grand_total": total, "tax_amount": 0, "outstanding_amount": total, "paid_amount": 0})
    inv = SalesInvoice(**d); db.add(inv); await db.flush()
    for it in items_data:
        db.add(SalesInvoiceItem(sales_invoice_id=inv.id, amount=it["qty"]*it["rate"], **{k:v for k,v in it.items() if k != "tax_rate"}))
    await db.commit(); await db.refresh(inv)
    return {"data": inv, "message": "Sales Invoice created"}

# ── Payments ──
class PaymentCreate(BaseModel):
    company_id: uuid.UUID
    party_type: str
    party_id: uuid.UUID
    payment_type: str
    amount: float
    mode_of_payment: str | None = None
    reference_no: str | None = None
    reference_date: str | None = None

@router.get("/payments/")
async def list_payments(page: int=1, page_size: int=20, company_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Payment).where(Payment.is_active==True)
    if company_id: q = q.where(Payment.company_id==company_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(Payment.created_at.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/payments/")
async def create_payment(data: PaymentCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    from datetime import date as dt
    d = data.model_dump()
    if d.get("reference_date"): d["reference_date"] = dt.fromisoformat(d["reference_date"])
    p = Payment(**d); db.add(p); await db.commit(); await db.refresh(p)
    return {"data": p, "message": "Payment recorded"}
