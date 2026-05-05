"""Real MCP Tool Executor — queries the database, no stubs, no hardcoded responses.

Every tool function executes actual SQLAlchemy queries against the live database.
Results are serialized and returned to the AI agent for summarization.
"""

import logging
from datetime import date, datetime, timezone

from sqlalchemy import select, func, and_, or_, text, extract
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.database import async_session
from backend.app.models.sales import Customer, Quotation, SalesOrder, SalesInvoice, Payment
from backend.app.models.purchasing import Supplier, PurchaseOrder, PurchaseInvoice
from backend.app.models.inventory import Item, StockLedgerEntry
from backend.app.models.marine import Vessel, DiveOperation, SafetyEquipment, FuelLog, CharterContract
from backend.app.models.hr import Employee, Attendance, LeaveApplication, SalarySlip, ExpenseClaim
from backend.app.models.projects import Project, ProjectTask, Timesheet
from backend.app.models.crm import Lead, Opportunity
from backend.app.models.accounting import Account, JournalEntry, GeneralLedgerEntry

logger = logging.getLogger("aries.mcp_tools")


def serialize_row(row) -> dict:
    """Convert a SQLAlchemy model instance to a JSON-serializable dict."""
    if row is None:
        return {}
    result = {}
    for col in row.__table__.columns:
        val = getattr(row, col.name)
        if val is None:
            result[col.name] = None
        elif isinstance(val, (datetime, date)):
            result[col.name] = val.isoformat()
        elif isinstance(val, bytes):
            result[col.name] = val.hex()
        else:
            result[col.name] = val
    return result


def _month_expr(dialect, date_col):
    """Return a database-agnostic month extraction expression."""
    if dialect.name == "postgresql":
        return func.to_char(date_col, "YYYY-MM").label("month")
    return func.strftime("%Y-%m", date_col).label("month")


class MCPToolExecutor:
    """Executes MCP tools against the real database."""

    async def execute(self, tool_name: str, args: dict) -> dict:
        """Route tool call to the appropriate handler."""
        handler = getattr(self, f"_{tool_name}", None)
        if handler is None:
            return {"error": f"Unknown tool: {tool_name}"}
        try:
            async with async_session() as db:
                return await handler(db, args)
        except Exception as e:
            logger.error(f"Tool {tool_name} failed: {e}", exc_info=True)
            return {"error": str(e)}

    # ── Sales Tools ──────────────────────────────────────────────

    async def _query_sales(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "customers")
        company_id = args.get("company_id")
        filters = args.get("filters", {})

        if entity == "customers":
            q = select(Customer).where(Customer.is_active == True)
            if company_id:
                q = q.where(Customer.company_id == company_id)
            if filters.get("search"):
                s = f"%{filters['search']}%"
                q = q.where(or_(Customer.name.ilike(s), Customer.email.ilike(s)))
            rows = (await db.execute(q.limit(20))).scalars().all()
            return {"entity": "customers", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "quotations":
            q = select(Quotation).where(Quotation.is_active == True)
            if company_id:
                q = q.where(Quotation.company_id == company_id)
            if filters.get("status"):
                q = q.where(Quotation.status == filters["status"])
            rows = (await db.execute(q.order_by(Quotation.date.desc()).limit(20))).scalars().all()
            return {"entity": "quotations", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "sales_orders":
            q = select(SalesOrder).where(SalesOrder.is_active == True)
            if company_id:
                q = q.where(SalesOrder.company_id == company_id)
            rows = (await db.execute(q.order_by(SalesOrder.date.desc()).limit(20))).scalars().all()
            return {"entity": "sales_orders", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "invoices":
            q = select(SalesInvoice).where(SalesInvoice.is_active == True)
            if company_id:
                q = q.where(SalesInvoice.company_id == company_id)
            if filters.get("status"):
                q = q.where(SalesInvoice.status == filters["status"])
            rows = (await db.execute(q.order_by(SalesInvoice.date.desc()).limit(20))).scalars().all()
            total_outstanding = (await db.execute(
                select(func.coalesce(func.sum(SalesInvoice.outstanding_amount), 0)).where(
                    SalesInvoice.company_id == company_id if company_id else True,
                    SalesInvoice.status.in_(["Submitted", "Overdue"]),
                )
            )).scalar() or 0
            return {
                "entity": "invoices",
                "count": len(rows),
                "total_outstanding": float(total_outstanding),
                "data": [serialize_row(r) for r in rows],
            }

        elif entity == "payments":
            q = select(Payment).where(Payment.is_active == True)
            if company_id:
                q = q.where(Payment.company_id == company_id)
            rows = (await db.execute(q.order_by(Payment.created_at.desc()).limit(20))).scalars().all()
            return {"entity": "payments", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── Purchasing Tools ─────────────────────────────────────────

    async def _query_purchasing(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "suppliers")
        company_id = args.get("company_id")

        if entity == "suppliers":
            q = select(Supplier).where(Supplier.is_active == True)
            if company_id:
                q = q.where(Supplier.company_id == company_id)
            rows = (await db.execute(q.limit(20))).scalars().all()
            return {"entity": "suppliers", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "purchase_orders":
            q = select(PurchaseOrder).where(PurchaseOrder.is_active == True)
            if company_id:
                q = q.where(PurchaseOrder.company_id == company_id)
            rows = (await db.execute(q.order_by(PurchaseOrder.date.desc()).limit(20))).scalars().all()
            return {"entity": "purchase_orders", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "purchase_invoices":
            q = select(PurchaseInvoice).where(PurchaseInvoice.is_active == True)
            if company_id:
                q = q.where(PurchaseInvoice.company_id == company_id)
            rows = (await db.execute(q.order_by(PurchaseInvoice.date.desc()).limit(20))).scalars().all()
            total_outstanding = (await db.execute(
                select(func.coalesce(func.sum(PurchaseInvoice.outstanding_amount), 0)).where(
                    PurchaseInvoice.company_id == company_id if company_id else True,
                    PurchaseInvoice.status.in_(["Submitted", "Overdue"]),
                )
            )).scalar() or 0
            return {"entity": "purchase_invoices", "count": len(rows), "total_outstanding": float(total_outstanding), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── Inventory Tools ──────────────────────────────────────────

    async def _query_inventory(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "items")
        company_id = args.get("company_id")

        if entity == "items":
            q = select(Item).where(Item.is_active == True)
            if company_id:
                q = q.where(Item.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            return {"entity": "items", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "stock_balance":
            if not company_id:
                return {"entity": "stock_balance", "data": [], "note": "company_id required"}
            q = select(
                StockLedgerEntry.item_id,
                StockLedgerEntry.warehouse_id,
                func.sum(StockLedgerEntry.qty_change).label("qty"),
                func.max(StockLedgerEntry.valuation_rate).label("rate"),
            ).where(
                StockLedgerEntry.company_id == company_id
            ).group_by(StockLedgerEntry.item_id, StockLedgerEntry.warehouse_id)
            rows = (await db.execute(q)).all()
            return {
                "entity": "stock_balance",
                "count": len(rows),
                "data": [
                    {"item_id": str(r.item_id), "warehouse_id": str(r.warehouse_id), "qty": float(r.qty or 0), "valuation_rate": float(r.rate or 0), "value": float((r.qty or 0) * (r.rate or 0))}
                    for r in rows
                ],
            }

        elif entity == "stock_ledger":
            q = select(StockLedgerEntry)
            if company_id:
                q = q.where(StockLedgerEntry.company_id == company_id)
            rows = (await db.execute(q.order_by(StockLedgerEntry.posting_date.desc()).limit(50))).scalars().all()
            return {"entity": "stock_ledger", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── Accounting Tools ─────────────────────────────────────────

    async def _query_accounting(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "accounts")
        company_id = args.get("company_id")

        if entity == "accounts":
            q = select(Account).where(Account.is_active == True)
            if company_id:
                q = q.where(Account.company_id == company_id)
            rows = (await db.execute(q.order_by(Account.code))).scalars().all()
            return {"entity": "accounts", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "journal_entries":
            q = select(JournalEntry).where(JournalEntry.is_active == True)
            if company_id:
                q = q.where(JournalEntry.company_id == company_id)
            rows = (await db.execute(q.order_by(JournalEntry.posting_date.desc()).limit(20))).scalars().all()
            return {"entity": "journal_entries", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "general_ledger":
            q = select(GeneralLedgerEntry)
            if company_id:
                q = q.where(GeneralLedgerEntry.company_id == company_id)
            rows = (await db.execute(q.order_by(GeneralLedgerEntry.posting_date.desc()).limit(50))).scalars().all()
            return {"entity": "general_ledger", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "profit_loss":
            if not company_id:
                return {"entity": "profit_loss", "error": "company_id required"}
            from_date = args.get("from_date", "2026-01-01")
            to_date = args.get("to_date", "2026-12-31")

            income_result = await db.execute(select(
                func.coalesce(func.sum(GeneralLedgerEntry.credit - GeneralLedgerEntry.debit), 0)
            ).join(Account).where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.posting_date >= date.fromisoformat(from_date),
                GeneralLedgerEntry.posting_date <= date.fromisoformat(to_date),
                Account.account_type == "Income",
            ))
            revenue = income_result.scalar() or 0

            expense_result = await db.execute(select(
                func.coalesce(func.sum(GeneralLedgerEntry.debit - GeneralLedgerEntry.credit), 0)
            ).join(Account).where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.posting_date >= date.fromisoformat(from_date),
                GeneralLedgerEntry.posting_date <= date.fromisoformat(to_date),
                Account.account_type == "Expense",
            ))
            expenses = expense_result.scalar() or 0

            return {"entity": "profit_loss", "revenue": round(float(revenue), 2), "expenses": round(float(expenses), 2), "net_profit": round(float(revenue - expenses), 2), "period": {"from": from_date, "to": to_date}}

        elif entity == "balance_sheet":
            if not company_id:
                return {"entity": "balance_sheet", "error": "company_id required"}
            as_of = args.get("to_date", date.today().isoformat())

            asset_result = await db.execute(select(
                func.coalesce(func.sum(GeneralLedgerEntry.debit - GeneralLedgerEntry.credit), 0)
            ).join(Account).where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.posting_date <= date.fromisoformat(as_of),
                Account.account_type == "Asset",
            ))
            assets = abs(asset_result.scalar() or 0)

            liability_result = await db.execute(select(
                func.coalesce(func.sum(GeneralLedgerEntry.credit - GeneralLedgerEntry.debit), 0)
            ).join(Account).where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.posting_date <= date.fromisoformat(as_of),
                Account.account_type == "Liability",
            ))
            liabilities = abs(liability_result.scalar() or 0)

            equity_result = await db.execute(select(
                func.coalesce(func.sum(GeneralLedgerEntry.credit - GeneralLedgerEntry.debit), 0)
            ).join(Account).where(
                GeneralLedgerEntry.company_id == company_id,
                GeneralLedgerEntry.posting_date <= date.fromisoformat(as_of),
                Account.account_type == "Equity",
            ))
            equity = equity_result.scalar() or 0

            return {"entity": "balance_sheet", "assets": round(float(assets), 2), "liabilities": round(float(liabilities), 2), "equity": round(float(equity), 2), "as_of_date": as_of}

        return {"entity": entity, "count": 0, "data": []}

    # ── HR Tools ─────────────────────────────────────────────────

    async def _query_hr(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "employees")
        company_id = args.get("company_id")

        if entity == "employees":
            q = select(Employee).where(Employee.is_active == True)
            if company_id:
                q = q.where(Employee.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            return {"entity": "employees", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "attendance":
            q = select(Attendance).where(Attendance.is_active == True)
            if company_id:
                q = q.where(Attendance.company_id == company_id)
            today = date.today()
            q = q.where(Attendance.attendance_date == today)
            rows = (await db.execute(q)).scalars().all()
            present = sum(1 for r in rows if r.status == "Present")
            absent = sum(1 for r in rows if r.status == "Absent")
            on_leave = sum(1 for r in rows if r.status == "On Leave")
            return {"entity": "attendance", "date": today.isoformat(), "present": present, "absent": absent, "on_leave": on_leave, "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "leave_applications":
            q = select(LeaveApplication).where(LeaveApplication.is_active == True)
            if company_id:
                q = q.where(LeaveApplication.company_id == company_id)
            rows = (await db.execute(q.limit(20))).scalars().all()
            return {"entity": "leave_applications", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "salary_slips":
            q = select(SalarySlip).where(SalarySlip.is_active == True)
            if company_id:
                q = q.where(SalarySlip.company_id == company_id)
            rows = (await db.execute(q.order_by(SalarySlip.posting_date.desc()).limit(20))).scalars().all()
            return {"entity": "salary_slips", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "expense_claims":
            q = select(ExpenseClaim).where(ExpenseClaim.is_active == True)
            if company_id:
                q = q.where(ExpenseClaim.company_id == company_id)
            rows = (await db.execute(q.order_by(ExpenseClaim.expense_date.desc()).limit(20))).scalars().all()
            return {"entity": "expense_claims", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── Marine Tools ─────────────────────────────────────────────

    async def _query_marine(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "vessels")
        company_id = args.get("company_id")
        vessel_id = args.get("vessel_id")

        if entity == "vessels":
            q = select(Vessel).where(Vessel.is_active == True)
            if company_id:
                q = q.where(Vessel.company_id == company_id)
            if vessel_id:
                q = q.where(Vessel.id == vessel_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            active = sum(1 for r in rows if r.status == "Active")
            maintenance = sum(1 for r in rows if r.status == "Maintenance")
            return {"entity": "vessels", "count": len(rows), "active": active, "maintenance": maintenance, "data": [serialize_row(r) for r in rows]}

        elif entity == "dive_operations":
            q = select(DiveOperation).where(DiveOperation.is_active == True)
            if company_id:
                q = q.where(DiveOperation.company_id == company_id)
            rows = (await db.execute(q.order_by(DiveOperation.dive_date.desc()).limit(20))).scalars().all()
            return {"entity": "dive_operations", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "safety_equipment":
            q = select(SafetyEquipment).where(SafetyEquipment.is_active == True)
            if company_id:
                q = q.where(SafetyEquipment.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            expiring_soon = sum(1 for r in rows if r.next_inspection_date and r.next_inspection_date <= date.today())
            return {"entity": "safety_equipment", "count": len(rows), "expiring_soon": expiring_soon, "data": [serialize_row(r) for r in rows]}

        elif entity == "fuel_logs":
            q = select(FuelLog).where(FuelLog.is_active == True)
            if company_id:
                q = q.where(FuelLog.company_id == company_id)
            rows = (await db.execute(q.order_by(FuelLog.log_date.desc()).limit(20))).scalars().all()
            total_cost = sum(r.total_cost for r in rows)
            return {"entity": "fuel_logs", "count": len(rows), "total_cost": round(float(total_cost), 2), "data": [serialize_row(r) for r in rows]}

        elif entity == "charter_contracts":
            q = select(CharterContract).where(CharterContract.is_active == True)
            if company_id:
                q = q.where(CharterContract.company_id == company_id)
            rows = (await db.execute(q.order_by(CharterContract.start_date.desc()).limit(20))).scalars().all()
            return {"entity": "charter_contracts", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "crew_assignments":
            from backend.app.models.marine import CrewAssignment
            q = select(CrewAssignment).where(CrewAssignment.is_active == True)
            if company_id:
                q = q.where(CrewAssignment.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            return {"entity": "crew_assignments", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "maintenance_schedules":
            from backend.app.models.marine import MaintenanceSchedule
            q = select(MaintenanceSchedule).where(MaintenanceSchedule.is_active == True)
            if company_id:
                q = q.where(MaintenanceSchedule.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            return {"entity": "maintenance_schedules", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── Project Tools ────────────────────────────────────────────

    async def _query_projects(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "projects")
        company_id = args.get("company_id")

        if entity == "projects":
            q = select(Project).where(Project.is_active == True)
            if company_id:
                q = q.where(Project.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            active = sum(1 for r in rows if r.status == "In Progress")
            return {"entity": "projects", "count": len(rows), "active": active, "data": [serialize_row(r) for r in rows]}

        elif entity == "tasks":
            q = select(ProjectTask).where(ProjectTask.is_active == True)
            rows = (await db.execute(q.limit(50))).scalars().all()
            return {"entity": "tasks", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "timesheets":
            q = select(Timesheet).where(Timesheet.is_active == True)
            if company_id:
                q = q.where(Timesheet.company_id == company_id)
            rows = (await db.execute(q.order_by(Timesheet.from_time.desc()).limit(50))).scalars().all()
            total_hours = sum(r.hours for r in rows)
            return {"entity": "timesheets", "count": len(rows), "total_hours": round(float(total_hours), 2), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── CRM Tools ────────────────────────────────────────────────

    async def _query_crm(self, db: AsyncSession, args: dict) -> dict:
        entity = args.get("entity", "leads")
        company_id = args.get("company_id")

        if entity == "leads":
            q = select(Lead).where(Lead.is_active == True)
            if company_id:
                q = q.where(Lead.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            return {"entity": "leads", "count": len(rows), "data": [serialize_row(r) for r in rows]}

        elif entity == "opportunities":
            q = select(Opportunity).where(Opportunity.is_active == True)
            if company_id:
                q = q.where(Opportunity.company_id == company_id)
            rows = (await db.execute(q.limit(50))).scalars().all()
            pipeline_value = sum(r.expected_value or 0 for r in rows)
            return {"entity": "opportunities", "count": len(rows), "pipeline_value": round(float(pipeline_value), 2), "data": [serialize_row(r) for r in rows]}

        return {"entity": entity, "count": 0, "data": []}

    # ── Dashboard Tools ──────────────────────────────────────────

    async def _query_dashboard(self, db: AsyncSession, args: dict) -> dict:
        company_id = args.get("company_id")
        kpi_type = args.get("kpi_type", "summary")

        if not company_id:
            return {"error": "company_id required"}

        if kpi_type == "summary":
            monthly_revenue = (await db.execute(
                select(func.coalesce(func.sum(SalesInvoice.grand_total), 0)).where(
                    SalesInvoice.company_id == company_id,
                    SalesInvoice.status.in_(["Submitted", "Paid"]),
                    SalesInvoice.date >= date(date.today().year, date.today().month, 1),
                )
            )).scalar() or 0

            monthly_expenses = (await db.execute(
                select(func.coalesce(func.sum(PurchaseInvoice.grand_total), 0)).where(
                    PurchaseInvoice.company_id == company_id,
                    PurchaseInvoice.status.in_(["Submitted", "Paid"]),
                    PurchaseInvoice.date >= date(date.today().year, date.today().month, 1),
                )
            )).scalar() or 0

            ar = (await db.execute(
                select(func.coalesce(func.sum(SalesInvoice.outstanding_amount), 0)).where(
                    SalesInvoice.company_id == company_id,
                    SalesInvoice.status.in_(["Submitted", "Overdue"]),
                )
            )).scalar() or 0

            ap = (await db.execute(
                select(func.coalesce(func.sum(PurchaseInvoice.outstanding_amount), 0)).where(
                    PurchaseInvoice.company_id == company_id,
                    PurchaseInvoice.status.in_(["Submitted", "Overdue"]),
                )
            )).scalar() or 0

            active_projects = (await db.execute(
                select(func.count()).where(Project.company_id == company_id, Project.status == "In Progress")
            )).scalar() or 0

            active_employees = (await db.execute(
                select(func.count()).where(Employee.company_id == company_id, Employee.status == "Active")
            )).scalar() or 0

            return {
                "kpi_type": "summary",
                "monthly_revenue": round(float(monthly_revenue), 2),
                "monthly_expenses": round(float(monthly_expenses), 2),
                "net_profit": round(float(monthly_revenue - monthly_expenses), 2),
                "outstanding_receivables": round(float(ar), 2),
                "outstanding_payables": round(float(ap), 2),
                "active_projects": int(active_projects),
                "active_employees": int(active_employees),
            }

        elif kpi_type == "sales_trend":
            q = select(
                _month_expr(db.bind.dialect, SalesInvoice.date),
                func.coalesce(func.sum(SalesInvoice.grand_total), 0).label("amount"),
            ).where(
                SalesInvoice.company_id == company_id,
                SalesInvoice.status.in_(["Submitted", "Paid"]),
            ).group_by("month").order_by("month").limit(12)
            rows = (await db.execute(q)).all()
            return {"kpi_type": "sales_trend", "data": [{"month": r.month, "amount": round(float(r.amount), 2)} for r in rows]}

        return {"kpi_type": kpi_type, "data": {}}

    # ── Create Document Tool ─────────────────────────────────────

    async def _create_document(self, db: AsyncSession, args: dict) -> dict:
        doc_type = args.get("doc_type", "quotation")
        company_id = args.get("company_id")
        details = args.get("details", {})

        if not company_id:
            return {"error": "company_id required", "doc_type": doc_type}

        try:
            if doc_type == "quotation":
                from backend.app.models.sales import QuotationItem
                q = Quotation(
                    company_id=company_id,
                    customer_id=details.get("customer_id"),
                    date=date.today(),
                    status="Draft",
                    grand_total=details.get("total_amount", 0),
                )
                db.add(q)
                await db.flush()
                for item in details.get("items", []):
                    db.add(QuotationItem(quotation_id=q.id, **item))
                await db.commit()
                return {"success": True, "doc_type": "quotation", "id": str(q.id), "message": "Quotation created successfully"}

            elif doc_type == "purchase_order":
                from backend.app.models.purchasing import PurchaseOrderItem
                po = PurchaseOrder(
                    company_id=company_id,
                    supplier_id=details.get("supplier_id"),
                    date=date.today(),
                    status="Draft",
                    grand_total=details.get("total_amount", 0),
                )
                db.add(po)
                await db.flush()
                for item in details.get("items", []):
                    db.add(PurchaseOrderItem(purchase_order_id=po.id, **item))
                await db.commit()
                return {"success": True, "doc_type": "purchase_order", "id": str(po.id), "message": "Purchase Order created successfully"}

            elif doc_type == "sales_invoice":
                from backend.app.models.sales import SalesInvoiceItem
                inv = SalesInvoice(
                    company_id=company_id,
                    customer_id=details.get("customer_id"),
                    date=date.today(),
                    due_date=details.get("due_date", date.today()),
                    status="Draft",
                    grand_total=details.get("total_amount", 0),
                    outstanding_amount=details.get("total_amount", 0),
                )
                db.add(inv)
                await db.flush()
                for item in details.get("items", []):
                    db.add(SalesInvoiceItem(sales_invoice_id=inv.id, **item))
                await db.commit()
                return {"success": True, "doc_type": "sales_invoice", "id": str(inv.id), "message": "Sales Invoice created successfully"}

            elif doc_type == "journal_entry":
                from backend.app.models.accounting import JournalEntryLine
                je = JournalEntry(
                    company_id=company_id,
                    entry_number=f"JE-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}",
                    posting_date=date.today(),
                    total_debit=details.get("total_debit", 0),
                    total_credit=details.get("total_credit", 0),
                    status="Draft",
                    notes=details.get("notes", ""),
                )
                db.add(je)
                await db.flush()
                for line in details.get("lines", []):
                    db.add(JournalEntryLine(journal_entry_id=je.id, **line))
                await db.commit()
                return {"success": True, "doc_type": "journal_entry", "id": str(je.id), "message": "Journal Entry created successfully"}

            return {"success": False, "doc_type": doc_type, "message": f"Document type {doc_type} creation not yet implemented"}

        except Exception as e:
            await db.rollback()
            return {"success": False, "doc_type": doc_type, "error": str(e)}
