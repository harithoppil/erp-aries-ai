"""HR: Employees, Attendance, Leave, Payroll, Expense Claims."""
import uuid
from datetime import date as dt, time
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.hr import *

router = APIRouter(prefix="/hr", tags=["HR"])

class EmployeeCreate(BaseModel):
    company_id: uuid.UUID
    employee_number: str
    full_name: str
    email: str | None = None
    phone: str | None = None
    department: str | None = None
    designation: str | None = None
    date_of_joining: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    employment_type: str | None = None
    status: str = "Active"

class AttendanceCreate(BaseModel):
    company_id: uuid.UUID
    employee_id: uuid.UUID
    attendance_date: str
    status: str = "Present"
    leave_type: str | None = None
    shift: str | None = None
    in_time: str | None = None
    out_time: str | None = None
    working_hours: float = 0.0
    notes: str | None = None

class LeaveAppCreate(BaseModel):
    company_id: uuid.UUID
    employee_id: uuid.UUID
    leave_type_id: uuid.UUID
    from_date: str
    to_date: str
    total_days: float
    reason: str | None = None

class SalarySlipCreate(BaseModel):
    company_id: uuid.UUID
    employee_id: uuid.UUID
    posting_date: str
    start_date: str
    end_date: str
    total_working_days: float = 0.0
    payment_days: float = 0.0
    gross_pay: float = 0.0
    total_deduction: float = 0.0

class ExpenseClaimCreate(BaseModel):
    company_id: uuid.UUID
    employee_id: uuid.UUID
    expense_date: str
    total_amount: float
    description: str | None = None

@router.get("/employees/")
async def list_employees(page: int=1, page_size: int=20, company_id: uuid.UUID=None, department: str=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Employee).where(Employee.is_active==True)
    if company_id: q = q.where(Employee.company_id==company_id)
    if department: q = q.where(Employee.department==department)
    if status: q = q.where(Employee.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/employees/")
async def create_employee(data: EmployeeCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    if d.get("date_of_joining"): d["date_of_joining"] = dt.fromisoformat(d["date_of_joining"])
    if d.get("date_of_birth"): d["date_of_birth"] = dt.fromisoformat(d["date_of_birth"])
    e = Employee(**d); db.add(e); await db.commit(); await db.refresh(e)
    return {"data": e, "message": "Employee created"}

@router.get("/attendance/")
async def list_attendance(page: int=1, page_size: int=20, company_id: uuid.UUID=None, employee_id: uuid.UUID=None, date: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Attendance).where(Attendance.is_active==True)
    if company_id: q = q.where(Attendance.company_id==company_id)
    if employee_id: q = q.where(Attendance.employee_id==employee_id)
    if date: q = q.where(Attendance.attendance_date==dt.fromisoformat(date))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(Attendance.attendance_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/attendance/")
async def mark_attendance(data: AttendanceCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["attendance_date"] = dt.fromisoformat(d["attendance_date"])
    if d.get("in_time"): d["in_time"] = time.fromisoformat(d["in_time"])
    if d.get("out_time"): d["out_time"] = time.fromisoformat(d["out_time"])
    a = Attendance(**d); db.add(a); await db.commit(); await db.refresh(a)
    return {"data": a}

@router.get("/leave-applications/")
async def list_leave(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(LeaveApplication).where(LeaveApplication.is_active==True)
    if company_id: q = q.where(LeaveApplication.company_id==company_id)
    if status: q = q.where(LeaveApplication.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/leave-applications/")
async def create_leave(data: LeaveAppCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["from_date"] = dt.fromisoformat(d["from_date"])
    d["to_date"] = dt.fromisoformat(d["to_date"])
    l = LeaveApplication(**d, status="Open"); db.add(l); await db.commit(); await db.refresh(l)
    return {"data": l}

@router.post("/leave-applications/{id}/approve")
async def approve_leave(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    l = (await db.execute(select(LeaveApplication).where(LeaveApplication.id==id))).scalar_one_or_none()
    if not l: raise HTTPException(404, "Not found")
    l.status = "Approved"; l.approved_by = user.full_name or str(user.id); await db.commit()
    return {"message": "Leave approved"}

@router.get("/salary-slips/")
async def list_salary_slips(page: int=1, page_size: int=20, company_id: uuid.UUID=None, employee_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(SalarySlip).where(SalarySlip.is_active==True)
    if company_id: q = q.where(SalarySlip.company_id==company_id)
    if employee_id: q = q.where(SalarySlip.employee_id==employee_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(SalarySlip.posting_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/salary-slips/")
async def create_salary_slip(data: SalarySlipCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    for f in ["posting_date", "start_date", "end_date"]:
        if d.get(f): d[f] = dt.fromisoformat(d[f])
    d["net_pay"] = d["gross_pay"] - d["total_deduction"]
    s = SalarySlip(**d); db.add(s); await db.commit(); await db.refresh(s)
    return {"data": s}

@router.get("/expense-claims/")
async def list_expense_claims(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(ExpenseClaim).where(ExpenseClaim.is_active==True)
    if company_id: q = q.where(ExpenseClaim.company_id==company_id)
    if status: q = q.where(ExpenseClaim.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(ExpenseClaim.expense_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/expense-claims/")
async def create_expense_claim(data: ExpenseClaimCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["expense_date"] = dt.fromisoformat(d["expense_date"])
    e = ExpenseClaim(**d); db.add(e); await db.commit(); await db.refresh(e)
    return {"data": e}
