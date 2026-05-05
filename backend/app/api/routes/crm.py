"""CRM: Leads, Opportunities, Communications."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.crm import *

router = APIRouter(prefix="/crm", tags=["CRM"])

class LeadCreate(BaseModel):
    company_id: uuid.UUID
    lead_name: str
    organization: str | None = None
    email: str | None = None
    phone: str | None = None
    source: str | None = None
    territory: str | None = None
    industry: str | None = None
    notes: str | None = None
    status: str = "Open"

class OpportunityCreate(BaseModel):
    company_id: uuid.UUID
    lead_id: uuid.UUID | None = None
    customer_id: uuid.UUID | None = None
    opportunity_name: str
    stage: str | None = None
    expected_closing: str | None = None
    probability: float = 0.0
    expected_value: float = 0.0
    source: str | None = None
    notes: str | None = None

@router.get("/leads/")
async def list_leads(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Lead).where(Lead.is_active==True)
    if company_id: q = q.where(Lead.company_id==company_id)
    if status: q = q.where(Lead.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/leads/")
async def create_lead(data: LeadCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    l = Lead(**data.model_dump()); db.add(l); await db.commit(); await db.refresh(l)
    return {"data": l}

@router.get("/opportunities/")
async def list_opportunities(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Opportunity).where(Opportunity.is_active==True)
    if company_id: q = q.where(Opportunity.company_id==company_id)
    if status: q = q.where(Opportunity.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/opportunities/")
async def create_opportunity(data: OpportunityCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    if d.get("expected_closing"): d["expected_closing"] = dt.fromisoformat(d["expected_closing"])
    o = Opportunity(**d); db.add(o); await db.commit(); await db.refresh(o)
    return {"data": o}

@router.get("/communications/")
async def list_comms(page: int=1, page_size: int=20, company_id: uuid.UUID=None, reference_type: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Communication).where(Communication.is_active==True)
    if company_id: q = q.where(Communication.company_id==company_id)
    if reference_type: q = q.where(Communication.reference_type==reference_type)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(Communication.communication_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}
