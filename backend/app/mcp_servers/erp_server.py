"""ERP MCP Server — real database queries for all ERP modules.

Every tool handler creates an AsyncSession, queries the live database,
and returns formatted string results. No stubs, no hardcoded data.
"""

import uuid
import json
import logging

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import async_session
from backend.app.models.sales import Customer, Quotation, SalesOrder, SalesInvoice, Payment
from backend.app.models.purchasing import Supplier, PurchaseOrder, PurchaseInvoice
from backend.app.models.inventory import Item, StockLedgerEntry
from backend.app.models.marine import Vessel, DiveOperation, SafetyEquipment, FuelLog, CharterContract, CrewAssignment, MaintenanceSchedule
from backend.app.models.hr import Employee, Attendance, LeaveApplication, SalarySlip, ExpenseClaim
from backend.app.models.projects import Project, ProjectTask, Timesheet
from backend.app.models.assets import FixedAsset, AssetCategory
from backend.app.models.accounting import Account, JournalEntry, GeneralLedgerEntry
from backend.app.models.crm import Lead, Opportunity

logger = logging.getLogger("aries.mcp.erp")


def _serialize(obj) -> dict:
    """Serialize a SQLAlchemy row to a dict."""
    from datetime import date, datetime
    result = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if val is None:
            result[col.name] = None
        elif isinstance(val, (datetime, date)):
            result[col.name] = val.isoformat()
        elif isinstance(val, uuid.UUID):
            result[col.name] = str(val)
        else:
            result[col.name] = val
    return result


async def _get_db() -> AsyncSession:
    return async_session()


# ── Customers ──────────────────────────────────────────────────

async def erp_list_customers(company_id: str = "", limit: int = 20, search: str = "") -> str:
    """List customers in the ERP."""
    async with async_session() as db:
        q = select(Customer).where(Customer.is_active == True)
        if company_id:
            q = q.where(Customer.company_id == uuid.UUID(company_id))
        if search:
            q = q.where(or_(Customer.name.ilike(f"%{search}%"), Customer.email.ilike(f"%{search}%")))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} customers:\n" + json.dumps(data, indent=2, default=str)


async def erp_get_customer(customer_id: str) -> str:
    """Get a single customer by ID."""
    async with async_session() as db:
        row = (await db.execute(select(Customer).where(Customer.id == uuid.UUID(customer_id)))).scalar_one_or_none()
        if not row:
            return f"Customer not found: {customer_id}"
        return json.dumps(_serialize(row), indent=2, default=str)


# ── Sales ──────────────────────────────────────────────────────

async def erp_list_sales_invoices(company_id: str = "", status: str = "", limit: int = 20) -> str:
    """List sales invoices in the ERP."""
    async with async_session() as db:
        q = select(SalesInvoice).where(SalesInvoice.is_active == True)
        if company_id:
            q = q.where(SalesInvoice.company_id == uuid.UUID(company_id))
        if status:
            q = q.where(SalesInvoice.status == status)
        rows = (await db.execute(q.order_by(SalesInvoice.date.desc()).limit(limit))).scalars().all()
        total_outstanding = (await db.execute(
            select(func.coalesce(func.sum(SalesInvoice.outstanding_amount), 0)).where(
                SalesInvoice.company_id == uuid.UUID(company_id) if company_id else True,
                SalesInvoice.status.in_(["Submitted", "Overdue"]),
            )
        )).scalar() or 0
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} sales invoices. Total outstanding: AED {float(total_outstanding):,.2f}\n" + json.dumps(data, indent=2, default=str)


async def erp_get_invoice(invoice_id: str) -> str:
    """Get a single sales invoice by ID."""
    async with async_session() as db:
        row = (await db.execute(select(SalesInvoice).where(SalesInvoice.id == uuid.UUID(invoice_id)))).scalar_one_or_none()
        if not row:
            return f"Invoice not found: {invoice_id}"
        return json.dumps(_serialize(row), indent=2, default=str)


async def erp_list_quotations(company_id: str = "", limit: int = 20) -> str:
    """List quotations in the ERP."""
    async with async_session() as db:
        q = select(Quotation).where(Quotation.is_active == True)
        if company_id:
            q = q.where(Quotation.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(Quotation.date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} quotations:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_sales_orders(company_id: str = "", limit: int = 20) -> str:
    """List sales orders in the ERP."""
    async with async_session() as db:
        q = select(SalesOrder).where(SalesOrder.is_active == True)
        if company_id:
            q = q.where(SalesOrder.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(SalesOrder.date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} sales orders:\n" + json.dumps(data, indent=2, default=str)


# ── Purchasing ─────────────────────────────────────────────────

async def erp_list_suppliers(company_id: str = "", limit: int = 20) -> str:
    """List suppliers in the ERP."""
    async with async_session() as db:
        q = select(Supplier).where(Supplier.is_active == True)
        if company_id:
            q = q.where(Supplier.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} suppliers:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_purchase_orders(company_id: str = "", limit: int = 20) -> str:
    """List purchase orders in the ERP."""
    async with async_session() as db:
        q = select(PurchaseOrder).where(PurchaseOrder.is_active == True)
        if company_id:
            q = q.where(PurchaseOrder.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(PurchaseOrder.date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} purchase orders:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_purchase_invoices(company_id: str = "", limit: int = 20) -> str:
    """List purchase invoices in the ERP."""
    async with async_session() as db:
        q = select(PurchaseInvoice).where(PurchaseInvoice.is_active == True)
        if company_id:
            q = q.where(PurchaseInvoice.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(PurchaseInvoice.date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} purchase invoices:\n" + json.dumps(data, indent=2, default=str)


# ── Inventory ────────────────────────────────────────────────

async def erp_list_items(company_id: str = "", limit: int = 50) -> str:
    """List inventory items in the ERP."""
    async with async_session() as db:
        q = select(Item).where(Item.is_active == True)
        if company_id:
            q = q.where(Item.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} items:\n" + json.dumps(data, indent=2, default=str)


async def erp_stock_balance(company_id: str) -> str:
    """Get stock balance summary by item and warehouse."""
    if not company_id:
        return "company_id is required"
    async with async_session() as db:
        q = select(
            StockLedgerEntry.item_id,
            StockLedgerEntry.warehouse_id,
            func.sum(StockLedgerEntry.qty_change).label("qty"),
            func.max(StockLedgerEntry.valuation_rate).label("rate"),
        ).where(StockLedgerEntry.company_id == uuid.UUID(company_id)).group_by(
            StockLedgerEntry.item_id, StockLedgerEntry.warehouse_id
        )
        rows = (await db.execute(q)).all()
        data = [
            {"item_id": str(r.item_id), "warehouse_id": str(r.warehouse_id), "qty": float(r.qty or 0), "valuation_rate": float(r.rate or 0), "value": float((r.qty or 0) * (r.rate or 0))}
            for r in rows
        ]
        return f"Stock balance: {len(data)} item/warehouse combinations:\n" + json.dumps(data, indent=2, default=str)


# ── Marine ────────────────────────────────────────────────────

async def erp_list_vessels(company_id: str = "", limit: int = 50) -> str:
    """List vessels in the ERP."""
    async with async_session() as db:
        q = select(Vessel).where(Vessel.is_active == True)
        if company_id:
            q = q.where(Vessel.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        active = sum(1 for r in rows if r.status == "Active")
        maintenance = sum(1 for r in rows if r.status == "Maintenance")
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} vessels (Active: {active}, Maintenance: {maintenance}):\n" + json.dumps(data, indent=2, default=str)


async def erp_list_dive_operations(company_id: str = "", limit: int = 20) -> str:
    """List dive operations in the ERP."""
    async with async_session() as db:
        q = select(DiveOperation).where(DiveOperation.is_active == True)
        if company_id:
            q = q.where(DiveOperation.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(DiveOperation.dive_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} dive operations:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_safety_equipment(company_id: str = "", limit: int = 50) -> str:
    """List safety equipment in the ERP."""
    async with async_session() as db:
        q = select(SafetyEquipment).where(SafetyEquipment.is_active == True)
        if company_id:
            q = q.where(SafetyEquipment.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        expiring = sum(1 for r in rows if r.next_inspection_date and r.next_inspection_date <= __import__("datetime").date.today())
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} safety equipment items (Expiring soon: {expiring}):\n" + json.dumps(data, indent=2, default=str)


# ── HR ─────────────────────────────────────────────────────────

async def erp_list_employees(company_id: str = "", limit: int = 50) -> str:
    """List employees in the ERP."""
    async with async_session() as db:
        q = select(Employee).where(Employee.is_active == True)
        if company_id:
            q = q.where(Employee.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} employees:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_attendance(company_id: str = "") -> str:
    """List today's attendance records."""
    from datetime import date
    async with async_session() as db:
        q = select(Attendance).where(Attendance.is_active == True, Attendance.attendance_date == date.today())
        if company_id:
            q = q.where(Attendance.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q)).scalars().all()
        present = sum(1 for r in rows if r.status == "Present")
        absent = sum(1 for r in rows if r.status == "Absent")
        on_leave = sum(1 for r in rows if r.status == "On Leave")
        data = [_serialize(r) for r in rows]
        return f"Attendance for {date.today().isoformat()} — Present: {present}, Absent: {absent}, On Leave: {on_leave}\n" + json.dumps(data, indent=2, default=str)


async def erp_list_leave_applications(company_id: str = "", limit: int = 20) -> str:
    """List leave applications in the ERP."""
    async with async_session() as db:
        q = select(LeaveApplication).where(LeaveApplication.is_active == True)
        if company_id:
            q = q.where(LeaveApplication.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} leave applications:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_salary_slips(company_id: str = "", limit: int = 20) -> str:
    """List salary slips in the ERP."""
    async with async_session() as db:
        q = select(SalarySlip).where(SalarySlip.is_active == True)
        if company_id:
            q = q.where(SalarySlip.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(SalarySlip.posting_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} salary slips:\n" + json.dumps(data, indent=2, default=str)


# ── Projects ───────────────────────────────────────────────────

async def erp_list_projects(company_id: str = "", limit: int = 50) -> str:
    """List projects in the ERP."""
    async with async_session() as db:
        q = select(Project).where(Project.is_active == True)
        if company_id:
            q = q.where(Project.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        active = sum(1 for r in rows if r.status == "In Progress")
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} projects (Active: {active}):\n" + json.dumps(data, indent=2, default=str)


async def erp_list_project_tasks(company_id: str = "", limit: int = 50) -> str:
    """List project tasks in the ERP."""
    async with async_session() as db:
        q = select(ProjectTask).where(ProjectTask.is_active == True)
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} project tasks:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_timesheets(company_id: str = "", limit: int = 50) -> str:
    """List timesheets in the ERP."""
    async with async_session() as db:
        q = select(Timesheet).where(Timesheet.is_active == True)
        if company_id:
            q = q.where(Timesheet.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(Timesheet.from_time.desc()).limit(limit))).scalars().all()
        total_hours = sum(r.hours for r in rows)
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} timesheets. Total hours: {total_hours:.2f}\n" + json.dumps(data, indent=2, default=str)


# ── Accounting ───────────────────────────────────────────────

async def erp_list_accounts(company_id: str = "", limit: int = 100) -> str:
    """List chart of accounts in the ERP."""
    async with async_session() as db:
        q = select(Account).where(Account.is_active == True)
        if company_id:
            q = q.where(Account.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(Account.code).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} accounts:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_journal_entries(company_id: str = "", limit: int = 20) -> str:
    """List journal entries in the ERP."""
    async with async_session() as db:
        q = select(JournalEntry).where(JournalEntry.is_active == True)
        if company_id:
            q = q.where(JournalEntry.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(JournalEntry.posting_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} journal entries:\n" + json.dumps(data, indent=2, default=str)


# ── Assets ────────────────────────────────────────────────────

async def erp_list_fixed_assets(company_id: str = "", limit: int = 50) -> str:
    """List fixed assets in the ERP."""
    async with async_session() as db:
        q = select(FixedAsset).where(FixedAsset.is_active == True)
        if company_id:
            q = q.where(FixedAsset.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} fixed assets:\n" + json.dumps(data, indent=2, default=str)


# ── CRM ───────────────────────────────────────────────────────

async def erp_list_leads(company_id: str = "", limit: int = 50) -> str:
    """List CRM leads in the ERP."""
    async with async_session() as db:
        q = select(Lead).where(Lead.is_active == True)
        if company_id:
            q = q.where(Lead.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} leads:\n" + json.dumps(data, indent=2, default=str)


async def erp_list_opportunities(company_id: str = "", limit: int = 50) -> str:
    """List CRM opportunities in the ERP."""
    async with async_session() as db:
        q = select(Opportunity).where(Opportunity.is_active == True)
        if company_id:
            q = q.where(Opportunity.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        pipeline_value = sum(r.expected_value or 0 for r in rows)
        data = [_serialize(r) for r in rows]
        return f"Found {len(data)} opportunities. Pipeline value: AED {pipeline_value:,.2f}\n" + json.dumps(data, indent=2, default=str)
