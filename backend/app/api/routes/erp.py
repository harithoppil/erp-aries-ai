"""ERP API routes — Accounts, Assets, Stock, Projects, HR, Procurement."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.erp import (
    Account, SalesInvoice, InvoiceItem, PaymentEntry, JournalEntry, JournalEntryLine, Quotation, QuotationItem, SalesOrder, SalesOrderItem,
    Asset, MaintenanceRecord,
    Item, Warehouse, StockEntry, Bin,
    Project, Task, Timesheet, ProjectAssignment,
    Personnel, Certification, QualityInspection,
    Supplier, Customer, PurchaseOrder, POItem, MaterialRequest,
    GLEntry, FiscalYear, CostCenter, Subsidiary,
)
from pydantic import BaseModel, Field

router = APIRouter(prefix="/erp", tags=["erp"])


async def _paginated_results(db: AsyncSession, stmt, limit: int, offset: int):
    """Execute a paginated query and return data + total count."""
    # Count total
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0
    # Fetch page
    result = await db.execute(stmt.offset(offset).limit(limit))
    rows = result.scalars().all()
    return {"data": rows, "total": total, "limit": limit, "offset": offset}


# ═══════════════════════════════════════════════════════════════════
# ACCOUNTS
# ═══════════════════════════════════════════════════════════════════

class InvoiceItemIn(BaseModel):
    item_code: str | None = None
    description: str
    quantity: int = 1
    rate: float

class SalesInvoiceCreate(BaseModel):
    enquiry_id: str | None = None
    customer_name: str
    customer_email: str | None = None
    items: list[InvoiceItemIn]
    tax_rate: float = 5.0  # UAE VAT
    due_date_days: int = 30

class PaymentCreate(BaseModel):
    invoice_id: str
    amount: float
    reference_number: str | None = None


@router.get("/accounts")
async def list_accounts(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Account).order_by(Account.account_number)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/invoices", status_code=201)
async def create_invoice(data: SalesInvoiceCreate, db: AsyncSession = Depends(get_db)):
    inv_number = f"SINV-{uuid.uuid4().hex[:8].upper()}"
    subtotal = sum(i.quantity * i.rate for i in data.items)
    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount
    due = datetime.now(timezone.utc)  # placeholder

    invoice = SalesInvoice(
        invoice_number=inv_number,
        enquiry_id=uuid.UUID(data.enquiry_id) if data.enquiry_id else None,
        customer_name=data.customer_name,
        customer_email=data.customer_email,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        outstanding_amount=total,
    )
    db.add(invoice)
    await db.flush()

    for i in data.items:
        item = InvoiceItem(invoice_id=invoice.id, item_code=i.item_code, description=i.description, quantity=i.quantity, rate=i.rate, amount=i.quantity * i.rate)
        db.add(item)

    await db.commit()
    await db.refresh(invoice)
    return {"id": str(invoice.id), "invoice_number": inv_number, "total": total}


@router.get("/invoices")
async def list_invoices(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(SalesInvoice).order_by(SalesInvoice.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/payments")
async def list_payments(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(PaymentEntry).order_by(PaymentEntry.posting_date.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/payments", status_code=201)
async def record_payment(data: PaymentCreate, db: AsyncSession = Depends(get_db)):
    invoice = await db.get(SalesInvoice, uuid.UUID(data.invoice_id))
    if not invoice:
        raise HTTPException(404, "Invoice not found")

    payment = PaymentEntry(invoice_id=invoice.id, payment_type="receive", party_type="customer", party_name=invoice.customer_name, amount=data.amount, reference_number=data.reference_number)
    db.add(payment)

    invoice.paid_amount += data.amount
    invoice.outstanding_amount = max(0, invoice.total - invoice.paid_amount)
    if invoice.outstanding_amount <= 0:
        invoice.status = "paid"

    await db.commit()
    return {"id": str(payment.id), "outstanding": invoice.outstanding_amount}


class QuotationItemIn(BaseModel):
    description: str
    quantity: int = 1
    rate: float
    item_code: str | None = None

class QuotationCreate(BaseModel):
    customer_id: str | None = None
    customer_name: str
    project_type: str | None = None
    items: list[QuotationItemIn]
    tax_rate: float = 5.0
    valid_until: str | None = None
    notes: str | None = None


@router.get("/quotations")
async def list_quotations(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Quotation).order_by(Quotation.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/quotations", status_code=201)
async def create_quotation(data: QuotationCreate, db: AsyncSession = Depends(get_db)):
    q_number = f"QTN-{uuid.uuid4().hex[:8].upper()}"
    subtotal = sum(i.quantity * i.rate for i in data.items)
    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount

    quotation = Quotation(
        quotation_number=q_number,
        customer_id=uuid.UUID(data.customer_id) if data.customer_id else None,
        customer_name=data.customer_name,
        project_type=data.project_type,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        valid_until=datetime.fromisoformat(data.valid_until).replace(tzinfo=timezone.utc) if data.valid_until else None,
        notes=data.notes,
    )
    db.add(quotation)
    await db.flush()

    for i in data.items:
        item = QuotationItem(quotation_id=quotation.id, item_code=i.item_code, description=i.description, quantity=i.quantity, rate=i.rate, amount=i.quantity * i.rate)
        db.add(item)

    await db.commit()
    await db.refresh(quotation)
    return {"id": str(quotation.id), "quotation_number": q_number, "total": total}


class JournalEntryCreate(BaseModel):
    account: str
    entry_type: str
    amount: float
    party_type: str | None = None
    party_name: str | None = None
    reference: str | None = None
    notes: str | None = None


@router.get("/journal-entries")
async def list_journal_entries(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(JournalEntry).order_by(JournalEntry.posting_date.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/journal-entries", status_code=201)
async def create_journal_entry(data: JournalEntryCreate, db: AsyncSession = Depends(get_db)):
    entry_num = f"JV-{uuid.uuid4().hex[:8].upper()}"
    entry = JournalEntry(
        entry_number=entry_num,
        account=data.account,
        entry_type=data.entry_type,
        amount=data.amount,
        party_type=data.party_type,
        party_name=data.party_name,
        reference=data.reference,
        notes=data.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


class SalesOrderItemIn(BaseModel):
    description: str
    quantity: int = 1
    rate: float
    item_code: str | None = None

class SalesOrderCreate(BaseModel):
    quotation_id: str | None = None
    customer_id: str | None = None
    customer_name: str
    project_type: str | None = None
    items: list[SalesOrderItemIn]
    tax_rate: float = 5.0
    delivery_date: str | None = None
    notes: str | None = None


@router.get("/sales-orders")
async def list_sales_orders(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(SalesOrder).order_by(SalesOrder.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/sales-orders", status_code=201)
async def create_sales_order(data: SalesOrderCreate, db: AsyncSession = Depends(get_db)):
    so_number = f"SO-{uuid.uuid4().hex[:8].upper()}"
    subtotal = sum(i.quantity * i.rate for i in data.items)
    tax_amount = subtotal * (data.tax_rate / 100)
    total = subtotal + tax_amount

    so = SalesOrder(
        order_number=so_number,
        quotation_id=uuid.UUID(data.quotation_id) if data.quotation_id else None,
        customer_id=uuid.UUID(data.customer_id) if data.customer_id else None,
        customer_name=data.customer_name,
        project_type=data.project_type,
        subtotal=subtotal,
        tax_rate=data.tax_rate,
        tax_amount=tax_amount,
        total=total,
        delivery_date=datetime.fromisoformat(data.delivery_date).replace(tzinfo=timezone.utc) if data.delivery_date else None,
        notes=data.notes,
    )
    db.add(so)
    await db.flush()

    for i in data.items:
        item = SalesOrderItem(sales_order_id=so.id, item_code=i.item_code, description=i.description, quantity=i.quantity, rate=i.rate, amount=i.quantity * i.rate)
        db.add(item)

    await db.commit()
    await db.refresh(so)
    return {"id": str(so.id), "order_number": so_number, "total": total}


# ═══════════════════════════════════════════════════════════════════
# ASSETS & EQUIPMENT
# ═══════════════════════════════════════════════════════════════════

class AssetCreate(BaseModel):
    asset_name: str
    asset_code: str
    asset_category: str
    location: str | None = None
    purchase_cost: float | None = None
    calibration_date: str | None = None
    next_calibration_date: str | None = None
    certification_body: str | None = None


@router.get("/assets")
async def list_assets(status: str | None = None, limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Asset).order_by(Asset.asset_code)
    if status:
        stmt = stmt.where(Asset.status == status)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/assets", status_code=201)
async def create_asset(data: AssetCreate, db: AsyncSession = Depends(get_db)):
    asset = Asset(**data.model_dump(exclude_none=True))
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.get("/assets/calibration-due")
async def calibration_due(db: AsyncSession = Depends(get_db)):
    """Assets with calibration due within 30 days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) + timedelta(days=30)
    stmt = select(Asset).where(Asset.next_calibration_date <= cutoff, Asset.status != "decommissioned")
    result = await db.execute(stmt)
    return result.scalars().all()


# ═══════════════════════════════════════════════════════════════════
# STOCK & INVENTORY
# ═══════════════════════════════════════════════════════════════════

@router.get("/items")
async def list_items(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Item).order_by(Item.item_code)
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/warehouses")
async def list_warehouses(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Warehouse).order_by(Warehouse.warehouse_code)
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/bins")
async def list_stock_levels(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    """Current stock levels per item per warehouse."""
    stmt = select(Bin)
    return await _paginated_results(db, stmt, limit, offset)


class StockEntryCreate(BaseModel):
    entry_type: str  # receipt, delivery, transfer
    item_id: str
    quantity: float
    source_warehouse: str | None = None
    target_warehouse: str | None = None
    reference: str | None = None


@router.post("/stock-entries", status_code=201)
async def create_stock_entry(data: StockEntryCreate, db: AsyncSession = Depends(get_db)):
    entry = StockEntry(**{k: (uuid.UUID(v) if k.endswith("_warehouse") or k == "item_id" else v) for k, v in data.model_dump().items() if v is not None})
    db.add(entry)
    await db.commit()
    return {"id": str(entry.id)}


# ═══════════════════════════════════════════════════════════════════
# PROJECTS & OPERATIONS
# ═══════════════════════════════════════════════════════════════════

class ProjectCreate(BaseModel):
    project_name: str
    project_type: str
    customer_name: str
    enquiry_id: str | None = None
    expected_start: str | None = None
    expected_end: str | None = None
    project_location: str | None = None
    vessel_name: str | None = None
    estimated_cost: float | None = None
    day_rate: float | None = None


@router.get("/projects")
async def list_projects(status: str | None = None, limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Project).order_by(Project.created_at.desc())
    if status:
        stmt = stmt.where(Project.status == status)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/projects", status_code=201)
async def create_project(data: ProjectCreate, db: AsyncSession = Depends(get_db)):
    code = f"PRJ-{uuid.uuid4().hex[:6].upper()}"
    project = Project(project_code=code, **{k: v for k, v in data.model_dump(exclude_none=True).items() if k != "enquiry_id"})
    if data.enquiry_id:
        project.enquiry_id = uuid.UUID(data.enquiry_id)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.post("/projects/{project_id}/assign")
async def assign_personnel(project_id: uuid.UUID, personnel_id: uuid.UUID, role: str, db: AsyncSession = Depends(get_db)):
    """Assign personnel to project with automatic compliance check."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    person = await db.get(Personnel, personnel_id)
    if not person:
        raise HTTPException(404, "Personnel not found")

    # Compliance check — are all certs valid?
    certs = (await db.execute(select(Certification).where(Certification.personnel_id == personnel_id))).scalars().all()
    issues = [f"{c.cert_type} expired on {c.expiry_date}" for c in certs if c.status in ("expired",)]

    assignment = ProjectAssignment(
        project_id=project_id,
        personnel_id=personnel_id,
        role=role,
        compliance_checked=True,
        compliance_passed=len(issues) == 0,
        compliance_issues="; ".join(issues) if issues else None,
    )
    db.add(assignment)
    await db.commit()
    return {"assigned": True, "compliance_passed": len(issues) == 0, "issues": issues}


class TaskCreate(BaseModel):
    project_id: str
    subject: str
    description: str | None = None
    assigned_to: str | None = None
    start_date: str | None = None
    end_date: str | None = None


@router.get("/tasks")
async def list_tasks(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Task).order_by(Task.id.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/tasks", status_code=201)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(
        project_id=uuid.UUID(data.project_id),
        subject=data.subject,
        description=data.description,
        assigned_to=data.assigned_to,
        start_date=datetime.fromisoformat(data.start_date) if data.start_date else None,
        end_date=datetime.fromisoformat(data.end_date) if data.end_date else None,

    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return {"id": str(task.id)}


class TimesheetCreate(BaseModel):
    project_id: str
    personnel_id: str
    date: str
    hours: float = 8.0
    activity_type: str
    description: str | None = None
    billable: bool = True


@router.get("/timesheets")
async def list_timesheets(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Timesheet).order_by(Timesheet.date.desc())
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/timesheets", status_code=201)
async def create_timesheet(data: TimesheetCreate, db: AsyncSession = Depends(get_db)):
    ts = Timesheet(
        project_id=uuid.UUID(data.project_id),
        personnel_id=uuid.UUID(data.personnel_id),
        date=datetime.fromisoformat(data.date),
        hours=data.hours,
        activity_type=data.activity_type,
        description=data.description,
        billable=data.billable,
    )
    db.add(ts)
    await db.commit()
    return {"id": str(ts.id)}


# ═══════════════════════════════════════════════════════════════════
# HR & COMPLIANCE
# ═══════════════════════════════════════════════════════════════════

class PersonnelCreate(BaseModel):
    employee_id: str
    first_name: str
    last_name: str
    email: str | None = None
    designation: str | None = None
    department: str | None = None
    day_rate: float | None = None


class CertCreate(BaseModel):
    personnel_id: str
    cert_type: str
    cert_number: str | None = None
    issuing_body: str | None = None
    issue_date: str | None = None
    expiry_date: str | None = None


@router.get("/personnel")
async def list_personnel(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Personnel).order_by(Personnel.employee_id)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/personnel", status_code=201)
async def create_personnel(data: PersonnelCreate, db: AsyncSession = Depends(get_db)):
    person = Personnel(**data.model_dump(exclude_none=True))
    db.add(person)
    await db.commit()
    await db.refresh(person)
    return person


@router.post("/certifications", status_code=201)
async def add_certification(data: CertCreate, db: AsyncSession = Depends(get_db)):
    cert = Certification(
        personnel_id=uuid.UUID(data.personnel_id),
        cert_type=data.cert_type,
        cert_number=data.cert_number,
        issuing_body=data.issuing_body,
        issue_date=datetime.fromisoformat(data.issue_date).replace(tzinfo=timezone.utc) if data.issue_date else None,
        expiry_date=datetime.fromisoformat(data.expiry_date).replace(tzinfo=timezone.utc) if data.expiry_date else None,
    )
    # Auto-set status based on expiry
    if cert.expiry_date:
        now = datetime.now(timezone.utc)
        if cert.expiry_date < now:
            cert.status = "expired"
        elif cert.expiry_date < now + __import__("datetime").timedelta(days=90):
            cert.status = "expiring_soon"
    db.add(cert)
    await db.commit()
    return cert


@router.get("/certifications")
async def list_certifications(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Certification).order_by(Certification.expiry_date)
    return await _paginated_results(db, stmt, limit, offset)


@router.get("/personnel/compliance-alerts")
async def compliance_alerts(db: AsyncSession = Depends(get_db)):
    """Personnel with expired or expiring certifications."""
    stmt = select(Certification).where(Certification.status.in_(["expired", "expiring_soon"]))
    result = await db.execute(stmt)
    return result.scalars().all()


# ═══════════════════════════════════════════════════════════════════
# PROCUREMENT
# ═══════════════════════════════════════════════════════════════════

@router.get("/suppliers")
async def list_suppliers(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Supplier).order_by(Supplier.supplier_name)
    return await _paginated_results(db, stmt, limit, offset)


class SupplierCreate(BaseModel):
    supplier_name: str
    supplier_code: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    category: str | None = None

@router.post("/suppliers", status_code=201)
async def create_supplier(data: SupplierCreate, db: AsyncSession = Depends(get_db)):
    supplier = Supplier(**data.model_dump(exclude_none=True))
    db.add(supplier)
    await db.commit()
    await db.refresh(supplier)
    return supplier


class CustomerCreate(BaseModel):
    customer_name: str
    customer_code: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    industry: str | None = None
    tax_id: str | None = None
    credit_limit: float | None = None


@router.get("/customers")
async def list_customers(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(Customer).order_by(Customer.customer_name)
    return await _paginated_results(db, stmt, limit, offset)


@router.post("/customers", status_code=201)
async def create_customer(data: CustomerCreate, db: AsyncSession = Depends(get_db)):
    customer = Customer(**data.model_dump(exclude_none=True))
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/purchase-orders")
async def list_purchase_orders(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(PurchaseOrder).order_by(PurchaseOrder.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


class POItemIn(BaseModel):
    description: str
    quantity: int = 1
    rate: float
    item_code: str | None = None

class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    project_id: str | None = None
    expected_delivery: str | None = None
    notes: str | None = None
    items: list[POItemIn]

@router.post("/purchase-orders", status_code=201)
async def create_purchase_order(data: PurchaseOrderCreate, db: AsyncSession = Depends(get_db)):
    po_number = f"PO-{uuid.uuid4().hex[:8].upper()}"
    subtotal = sum(i.quantity * i.rate for i in data.items)
    tax_amount = subtotal * 0.05  # 5% VAT
    total = subtotal + tax_amount

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=uuid.UUID(data.supplier_id),
        project_id=uuid.UUID(data.project_id) if data.project_id else None,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        notes=data.notes,
    )
    if data.expected_delivery:
        po.expected_delivery = datetime.fromisoformat(data.expected_delivery)
    db.add(po)
    await db.flush()

    for i in data.items:
        item = POItem(po_id=po.id, item_code=i.item_code, description=i.description, quantity=i.quantity, rate=i.rate, amount=i.quantity * i.rate)
        db.add(item)

    await db.commit()
    await db.refresh(po)
    return {"id": str(po.id), "po_number": po_number, "total": total}


@router.get("/material-requests")
async def list_material_requests(limit: int = Query(50, ge=1), offset: int = Query(0, ge=0), db: AsyncSession = Depends(get_db)):
    stmt = select(MaterialRequest).order_by(MaterialRequest.created_at.desc())
    return await _paginated_results(db, stmt, limit, offset)


class MaterialRequestCreate(BaseModel):
    project_id: str | None = None
    requested_by: str
    purpose: str | None = None

@router.post("/material-requests", status_code=201)
async def create_material_request(data: MaterialRequestCreate, db: AsyncSession = Depends(get_db)):
    req_number = f"MR-{uuid.uuid4().hex[:8].upper()}"
    mr = MaterialRequest(
        request_number=req_number,
        project_id=uuid.UUID(data.project_id) if data.project_id else None,
        requested_by=data.requested_by,
        purpose=data.purpose,
    )
    db.add(mr)
    await db.commit()
    await db.refresh(mr)
    return mr



