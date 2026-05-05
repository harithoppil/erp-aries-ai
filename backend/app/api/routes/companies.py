"""Company & Warehouse routes."""
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User, Company, Warehouse

router = APIRouter(prefix="/companies", tags=["Companies"])

class CompanyCreate(BaseModel):
    name: str
    tax_id: str | None = None
    vat_reg_no: str | None = None
    currency: str = "AED"
    country: str = "AE"
    address: dict | None = None
    phone: str | None = None
    email: str | None = None

class CompanyUpdate(CompanyCreate):
    pass

class WarehouseCreate(BaseModel):
    company_id: uuid.UUID
    name: str
    location: str | None = None
    warehouse_type: str | None = None

@router.get("/")
async def list_companies(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Company).where(Company.is_active == True))
    return {"data": result.scalars().all()}

@router.post("/")
async def create_company(data: CompanyCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    company = Company(**data.model_dump(exclude_unset=True))
    db.add(company)
    await db.commit()
    await db.refresh(company)
    return {"data": company}

@router.get("/{id}")
async def get_company(id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Company).where(Company.id == id, Company.is_active == True))
    company = result.scalar_one_or_none()
    if not company: raise HTTPException(404, "Company not found")
    return {"data": company}

@router.put("/{id}")
async def update_company(id: uuid.UUID, data: CompanyUpdate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Company).where(Company.id == id))
    company = result.scalar_one_or_none()
    if not company: raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(company, k, v)
    await db.commit()
    return {"data": company}

# ── Warehouse routes ──
@router.get("/{company_id}/warehouses")
async def list_warehouses(company_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(Warehouse).where(Warehouse.company_id == company_id, Warehouse.is_active == True))
    return {"data": result.scalars().all()}

@router.post("/{company_id}/warehouses")
async def create_warehouse(data: WarehouseCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    wh = Warehouse(**data.model_dump())
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return {"data": wh}
