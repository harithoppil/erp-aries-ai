"""Dashboard KPIs and summary data."""
import uuid
from datetime import date as dt, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.sales import SalesInvoice, Customer, SalesOrder
from backend.app.models.purchasing import PurchaseInvoice, PurchaseOrder
from backend.app.models.inventory import Item, StockLedgerEntry
from backend.app.models.projects import Project
from backend.app.models.hr import Employee
from backend.app.models.marine import Vessel, DiveOperation

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
async def dashboard_summary(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """Company overview KPIs."""
    # Revenue this month
    month_start = dt(dt.today().year, dt.today().month, 1)
    revenue = (await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.grand_total), 0)).where(
            SalesInvoice.company_id==company_id,
            SalesInvoice.status.in_(["Submitted", "Paid"]),
            SalesInvoice.date >= month_start
        )
    )).scalar() or 0
    # Expenses this month
    expenses = (await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.grand_total), 0)).where(
            PurchaseInvoice.company_id==company_id,
            PurchaseInvoice.status.in_(["Submitted", "Paid"]),
            PurchaseInvoice.date >= month_start
        )
    )).scalar() or 0
    # Outstanding AR
    ar = (await db.execute(
        select(func.coalesce(func.sum(SalesInvoice.outstanding_amount), 0)).where(
            SalesInvoice.company_id==company_id,
            SalesInvoice.status.in_(["Submitted", "Overdue"])
        )
    )).scalar() or 0
    # Outstanding AP
    ap = (await db.execute(
        select(func.coalesce(func.sum(PurchaseInvoice.outstanding_amount), 0)).where(
            PurchaseInvoice.company_id==company_id,
            PurchaseInvoice.status.in_(["Submitted", "Overdue"])
        )
    )).scalar() or 0
    # Stock value
    stock_value = (await db.execute(
        select(func.coalesce(func.sum(StockLedgerEntry.balance_value), 0)).where(
            StockLedgerEntry.company_id==company_id
        )
    )).scalar() or 0
    # Active projects
    active_projects = (await db.execute(
        select(func.count()).where(Project.company_id==company_id, Project.status=="In Progress")
    )).scalar() or 0
    # Active employees
    active_employees = (await db.execute(
        select(func.count()).where(Employee.company_id==company_id, Employee.status=="Active")
    )).scalar() or 0
    # Vessel utilization
    total_vessels = (await db.execute(
        select(func.count()).where(Vessel.company_id==company_id)
    )).scalar() or 0
    active_vessels = (await db.execute(
        select(func.count()).where(Vessel.company_id==company_id, Vessel.status=="Active")
    )).scalar() or 0
    vessel_util = round((active_vessels / total_vessels * 100), 1) if total_vessels > 0 else 0

    return {
        "data": {
            "monthly_revenue": round(revenue, 2),
            "monthly_expenses": round(expenses, 2),
            "net_profit": round(revenue - expenses, 2),
            "outstanding_receivables": round(ar, 2),
            "outstanding_payables": round(ap, 2),
            "total_stock_value": round(stock_value, 2),
            "active_projects": active_projects,
            "active_employees": active_employees,
            "vessel_utilization_pct": vessel_util,
            "total_vessels": total_vessels,
            "active_vessels": active_vessels,
        }
    }

@router.get("/sales-trend")
async def sales_trend(company_id: uuid.UUID, months: int = 12, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    """Monthly sales for charting."""
    q = select(
        extract("year", SalesInvoice.date).label("year"),
        extract("month", SalesInvoice.date).label("month"),
        func.sum(SalesInvoice.grand_total).label("amount"),
        func.count().label("count")
    ).where(
        SalesInvoice.company_id==company_id,
        SalesInvoice.status.in_(["Submitted", "Paid"])
    ).group_by("year", "month").order_by("year", "month")
    result = await db.execute(q)
    rows = [{"year": int(r.year), "month": int(r.month), "amount": round(r.amount or 0, 2), "count": r.count} for r in result.all()]
    return {"data": rows}

@router.get("/project-status")
async def project_status(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Project.status, func.count().label("count"), func.sum(Project.estimated_revenue).label("value")).where(
        Project.company_id==company_id
    ).group_by(Project.status)
    result = await db.execute(q)
    return {"data": [{"status": r.status, "count": r.count, "value": round(r.value or 0, 2)} for r in result.all()]}

@router.get("/vessel-status")
async def vessel_status(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Vessel.status, func.count().label("count")).where(
        Vessel.company_id==company_id
    ).group_by(Vessel.status)
    result = await db.execute(q)
    return {"data": [{"status": r.status, "count": r.count} for r in result.all()]}
