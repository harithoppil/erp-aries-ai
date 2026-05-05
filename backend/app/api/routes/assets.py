"""Fixed Assets: Register, Categories, Depreciation, Maintenance."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.assets import *

router = APIRouter(prefix="/assets", tags=["Assets"])

class AssetCreate(BaseModel):
    company_id: uuid.UUID
    asset_name: str
    asset_category: str | None = None
    location: str | None = None
    purchase_date: str | None = None
    purchase_amount: float = 0.0
    depreciation_method: str = "Straight Line"

class AssetCategoryCreate(BaseModel):
    company_id: uuid.UUID
    category_name: str
    depreciation_method: str = "Straight Line"

@router.get("/fixed-assets/")
async def list_assets(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(FixedAsset).where(FixedAsset.is_active==True)
    if company_id: q = q.where(FixedAsset.company_id==company_id)
    if status: q = q.where(FixedAsset.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/fixed-assets/")
async def create_asset(data: AssetCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    if d.get("purchase_date"): d["purchase_date"] = dt.fromisoformat(d["purchase_date"])
    d["gross_purchase_amount"] = d["purchase_amount"]
    d["total_depreciable_value"] = d["purchase_amount"]
    d["value_after_depreciation"] = d["purchase_amount"]
    a = FixedAsset(**d); db.add(a); await db.commit(); await db.refresh(a)
    return {"data": a}

@router.get("/categories/")
async def list_categories(company_id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(AssetCategory).where(AssetCategory.company_id==company_id, AssetCategory.is_active==True))).scalars().all()
    return {"data": items}

@router.post("/categories/")
async def create_category(data: AssetCategoryCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    c = AssetCategory(**data.model_dump()); db.add(c); await db.commit(); await db.refresh(c)
    return {"data": c}
