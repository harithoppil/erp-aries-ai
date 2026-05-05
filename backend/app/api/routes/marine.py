"""Marine: Vessels, Crew, Dive Ops, Safety, Fuel, Charters."""
import uuid
from datetime import date as dt
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.database import get_db
from backend.app.core.auth import get_current_user
from backend.app.models.auth import User
from backend.app.models.marine import *

router = APIRouter(prefix="/marine", tags=["Marine"])

class VesselCreate(BaseModel):
    company_id: uuid.UUID
    vessel_name: str
    vessel_code: str
    vessel_type: str | None = None
    imo_number: str | None = None
    flag: str | None = None
    year_built: int | None = None
    length_m: float | None = None
    beam_m: float | None = None
    draft_m: float | None = None
    gross_tonnage: float | None = None
    engine_power: str | None = None
    max_speed: float | None = None
    owner: str | None = None
    operator: str | None = None
    status: str = "Active"
    home_port: str | None = None
    current_location: str | None = None
    notes: str | None = None
    certifications: dict | None = None

class VesselCertCreate(BaseModel):
    vessel_id: uuid.UUID
    certification_type: str
    certificate_number: str
    issuing_authority: str | None = None
    issue_date: str
    expiry_date: str

class DiveOpCreate(BaseModel):
    company_id: uuid.UUID
    project_id: uuid.UUID | None = None
    vessel_id: uuid.UUID | None = None
    dive_supervisor: str | None = None
    dive_date: str
    location: str | None = None
    depth_m: float | None = None
    duration_minutes: int | None = None
    purpose: str | None = None
    team_members: dict | None = None
    equipment_used: dict | None = None
    weather_conditions: str | None = None
    visibility_m: float | None = None
    water_temp_c: float | None = None
    notes: str | None = None

class SafetyEquipCreate(BaseModel):
    company_id: uuid.UUID
    equipment_type: str
    serial_number: str | None = None
    location: str | None = None
    inspection_date: str | None = None
    next_inspection_date: str | None = None
    inspection_notes: str | None = None

class FuelLogCreate(BaseModel):
    company_id: uuid.UUID
    vessel_id: uuid.UUID
    log_date: str
    fuel_type: str | None = None
    quantity_liters: float = 0.0
    cost_per_liter: float = 0.0
    location: str | None = None
    bunkering_party: str | None = None
    notes: str | None = None

class CharterCreate(BaseModel):
    company_id: uuid.UUID
    vessel_id: uuid.UUID
    customer_id: uuid.UUID
    contract_number: str
    start_date: str
    end_date: str
    charter_type: str = "Time"
    daily_rate: float = 0.0
    total_amount: float = 0.0
    currency: str = "AED"
    payment_terms: str | None = None
    terms_and_conditions: str | None = None

# ── Vessels ──
@router.get("/vessels/")
async def list_vessels(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(Vessel).where(Vessel.is_active==True)
    if company_id: q = q.where(Vessel.company_id==company_id)
    if status: q = q.where(Vessel.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/vessels/")
async def create_vessel(data: VesselCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    v = Vessel(**data.model_dump()); db.add(v); await db.commit(); await db.refresh(v)
    return {"data": v, "message": "Vessel created"}

@router.get("/vessels/{id}")
async def get_vessel(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    v = (await db.execute(select(Vessel).where(Vessel.id==id))).scalar_one_or_none()
    if not v: raise HTTPException(404, "Vessel not found")
    return {"data": v}

# ── Certifications ──
@router.get("/vessels/{id}/certifications")
async def list_vessel_certs(id: uuid.UUID, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    items = (await db.execute(select(VesselCertification).where(VesselCertification.vessel_id==id))).scalars().all()
    return {"data": items}

@router.post("/certifications/")
async def create_cert(data: VesselCertCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["issue_date"] = dt.fromisoformat(d["issue_date"])
    d["expiry_date"] = dt.fromisoformat(d["expiry_date"])
    c = VesselCertification(**d); db.add(c); await db.commit(); await db.refresh(c)
    return {"data": c}

# ── Dive Operations ──
@router.get("/dive-operations/")
async def list_dive_ops(page: int=1, page_size: int=20, company_id: uuid.UUID=None, vessel_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(DiveOperation).where(DiveOperation.is_active==True)
    if company_id: q = q.where(DiveOperation.company_id==company_id)
    if vessel_id: q = q.where(DiveOperation.vessel_id==vessel_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(DiveOperation.dive_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/dive-operations/")
async def create_dive_op(data: DiveOpCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["dive_date"] = dt.fromisoformat(d["dive_date"])
    do = DiveOperation(**d); db.add(do); await db.commit(); await db.refresh(do)
    return {"data": do, "message": "Dive operation logged"}

# ── Safety Equipment ──
@router.get("/safety-equipment/")
async def list_safety(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(SafetyEquipment).where(SafetyEquipment.is_active==True)
    if company_id: q = q.where(SafetyEquipment.company_id==company_id)
    if status: q = q.where(SafetyEquipment.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/safety-equipment/")
async def create_safety(data: SafetyEquipCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    for f in ["inspection_date", "next_inspection_date"]:
        if d.get(f): d[f] = dt.fromisoformat(d[f])
    s = SafetyEquipment(**d); db.add(s); await db.commit(); await db.refresh(s)
    return {"data": s}

# ── Fuel Logs ──
@router.get("/fuel-logs/")
async def list_fuel(page: int=1, page_size: int=20, company_id: uuid.UUID=None, vessel_id: uuid.UUID=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(FuelLog).where(FuelLog.is_active==True)
    if company_id: q = q.where(FuelLog.company_id==company_id)
    if vessel_id: q = q.where(FuelLog.vessel_id==vessel_id)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(FuelLog.log_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/fuel-logs/")
async def create_fuel(data: FuelLogCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    d["log_date"] = dt.fromisoformat(d["log_date"])
    d["total_cost"] = d["quantity_liters"] * d["cost_per_liter"]
    f = FuelLog(**d); db.add(f); await db.commit(); await db.refresh(f)
    return {"data": f, "message": "Fuel log recorded"}

# ── Charter Contracts ──
@router.get("/charter-contracts/")
async def list_charters(page: int=1, page_size: int=20, company_id: uuid.UUID=None, status: str=None, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    q = select(CharterContract).where(CharterContract.is_active==True)
    if company_id: q = q.where(CharterContract.company_id==company_id)
    if status: q = q.where(CharterContract.status==status)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size).order_by(CharterContract.start_date.desc()))).scalars().all()
    return {"data": items, "total": total, "page": page, "page_size": page_size}

@router.post("/charter-contracts/")
async def create_charter(data: CharterCreate, db: AsyncSession=Depends(get_db), user: User=Depends(get_current_user)):
    d = data.model_dump()
    for f in ["start_date", "end_date"]:
        if d.get(f): d[f] = dt.fromisoformat(d[f])
    c = CharterContract(**d); db.add(c); await db.commit(); await db.refresh(c)
    return {"data": c, "message": "Charter contract created"}
