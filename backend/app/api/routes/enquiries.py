import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.schemas.enquiry import EnquiryCreate, EnquiryRead, EnquiryUpdate

router = APIRouter(prefix="/enquiries", tags=["enquiries"])


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.post("/", response_model=EnquiryRead, status_code=201)
async def create_enquiry(data: EnquiryCreate, db: AsyncSession = Depends(get_db)):
    enquiry = Enquiry(**data.model_dump())
    db.add(enquiry)
    await db.commit()
    await db.refresh(enquiry)
    return enquiry


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.get("/", response_model=list[EnquiryRead])
async def list_enquiries(
    status: EnquiryStatus | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Enquiry).order_by(Enquiry.created_at.desc()).offset(offset).limit(limit)
    if status:
        stmt = stmt.where(Enquiry.status == status)
    result = await db.execute(stmt)
    return result.scalars().all()


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.get("/{enquiry_id}", response_model=EnquiryRead)
async def get_enquiry(enquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    return enquiry


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.patch("/{enquiry_id}", response_model=EnquiryRead)
async def update_enquiry(
    enquiry_id: uuid.UUID,
    data: EnquiryUpdate,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(enquiry, field, value)

    await db.commit()
    await db.refresh(enquiry)
    return enquiry


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.post("/{enquiry_id}/approve", response_model=EnquiryRead)
async def approve_enquiry(
    enquiry_id: uuid.UUID,
    approver: str,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    if enquiry.status not in (EnquiryStatus.POLICY_REVIEW, EnquiryStatus.LLM_DRAFTED):
        raise HTTPException(400, f"Cannot approve enquiry in status {enquiry.status}")

    from datetime import datetime, timezone

    enquiry.status = EnquiryStatus.APPROVED
    enquiry.approved_by = approver
    enquiry.approved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(enquiry)
    return enquiry
