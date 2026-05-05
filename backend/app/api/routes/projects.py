"""Projects, Tasks, Timesheets, Expenses."""
import uuid
from datetime import date as dt, datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.projects import *

router = APIRouter(prefix="/projects", tags=["Projects"])

class ProjectCreate(BaseModel):
    company_id: uuid.UUID
    project_name: str
    customer_id: uuid.UUID | None = None
    status: str = "Planning"
    start_date: str | None = None
    end_date: str | None = None
    estimated_cost: float = 0.0
    estimated_revenue: float = 0.0
    notes: str | None = None

class TaskCreate(BaseModel):
    project_id: uuid.UUID
    task_name: str
    description: str | None = None
    assigned_to: str | None = None
    priority: str = "Medium"
    start_date: str | None = None
    end_date: str | None = None

class TimesheetCreate(BaseModel):
    company_id: uuid.UUID
    employee_id: uuid.UUID
    project_id: uuid.UUID | None = None
    task_id: uuid.UUID | None = None
    activity_type: str | None = None
    from_time: str
    to_time: str
    billing_rate: float = 0.0
    cost_rate: float = 0.0

@router.get("/")
async def list_projects(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Project).where(Project.is_active==True)
    if company_id: q = q.where(Project.company_id==company_id)
    if status: q = q.where(Project.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/")
async def create_project(data: ProjectCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    if d.get("start_date"): d["start_date"] = dt.fromisoformat(d["start_date"])
    if d.get("end_date"): d["end_date"] = dt.fromisoformat(d["end_date"])
    p = Project(**d); db.add(p); await db.commit(); await db.refresh(p)
    return {"data": p, "message": "Project created"}

@router.get("/{id}")
async def get_project(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    from sqlalchemy.orm import selectinload
    p = (await db.execute(select(Project).options(selectinload(Project.tasks)).where(Project.id==id))).scalar_one_or_none()
    if not p: raise HTTPException(404, "Not found")
    return {"data": p}

@router.get("/{id}/tasks")
async def list_tasks(id: uuid.UUID, page: int=1, page_size: int=20, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(ProjectTask).where(ProjectTask.project_id==id, ProjectTask.is_active==True)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/{id}/tasks")
async def create_task(id: uuid.UUID, data: TaskCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump() | {"project_id": id}
    if d.get("start_date"): d["start_date"] = dt.fromisoformat(d["start_date"])
    if d.get("end_date"): d["end_date"] = dt.fromisoformat(d["end_date"])
    t = ProjectTask(**d); db.add(t); await db.commit(); await db.refresh(t)
    return {"data": t}

@router.get("/timesheets/")
async def list_timesheets(page: int=1, page_size: int=20, company_id: uuid.UUID=None, employee_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Timesheet).where(Timesheet.is_active==True)
    if company_id: q = q.where(Timesheet.company_id==company_id)
    if employee_id: q = q.where(Timesheet.employee_id==employee_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(Timesheet.from_time.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/timesheets/")
async def create_timesheet(data: TimesheetCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["from_time"] = datetime.fromisoformat(d["from_time"])
    d["to_time"] = datetime.fromisoformat(d["to_time"])
    d["hours"] = (d["to_time"] - d["from_time"]).total_seconds() / 3600
    d["billing_amount"] = d["hours"] * d["billing_rate"]
    d["cost_amount"] = d["hours"] * d["cost_rate"]
    t = Timesheet(**d); db.add(t); await db.commit(); await db.refresh(t)
    return {"data": t, "message": "Timesheet created"}
