"""Settings: Currencies, Tax, Workflows, Activity Logs."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.settings import *

router = APIRouter(prefix="/settings", tags=["Settings"])

class CurrencyCreate(BaseModel):
    currency_name: str
    symbol: str
    fraction: str | None = None

class TaxTemplateCreate(BaseModel):
    company_id: uuid.UUID
    template_name: str
    tax_type: str
    rate: float = 0.0

class WorkflowRuleCreate(BaseModel):
    company_id: uuid.UUID
    module: str
    rule_name: str
    condition: str | None = None
    action: str | None = None
    approver_role: str | None = None

@router.get("/currencies/")
async def list_currencies(db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(Currency).where(Currency.is_active==True))).scalars().all()
    return {"data": items}

@router.post("/currencies/")
async def create_currency(data: CurrencyCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    c = Currency(**data.model_dump()); db.add(c); await db.commit(); await db.refresh(c)
    return {"data": c}

@router.get("/tax-templates/")
async def list_tax(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(TaxTemplate).where(TaxTemplate.company_id==company_id, TaxTemplate.is_active==True))).scalars().all()
    return {"data": items}

@router.post("/tax-templates/")
async def create_tax(data: TaxTemplateCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    t = TaxTemplate(**data.model_dump()); db.add(t); await db.commit(); await db.refresh(t)
    return {"data": t}

@router.get("/workflow-rules/")
async def list_workflows(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(WorkflowRule).where(WorkflowRule.company_id==company_id, WorkflowRule.is_active==True))).scalars().all()
    return {"data": items}

@router.post("/workflow-rules/")
async def create_workflow(data: WorkflowRuleCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    w = WorkflowRule(**data.model_dump()); db.add(w); await db.commit(); await db.refresh(w)
    return {"data": w}

@router.get("/activity-logs/")
async def list_activity(page: int=1, page_size: int=50, user_id: uuid.UUID=None, entity_type: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(ActivityLog)
    if user_id: q = q.where(ActivityLog.user_id==user_id)
    if entity_type: q = q.where(ActivityLog.entity_type==entity_type)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(ActivityLog.created_at.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}
