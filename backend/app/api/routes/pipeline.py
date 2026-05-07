import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.enquiry import Enquiry, EnquiryStatus
from backend.app.schemas.enquiry import PipelineRunRequest, PipelineRunResponse
from backend.app.services.pipeline import run_pipeline

router = APIRouter(prefix="/pipeline", tags=["pipeline"])


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.post("/run", response_model=PipelineRunResponse)
async def run_decisioning_pipeline(
    request: PipelineRunRequest,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, request.enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")

    result = await run_pipeline(enquiry, db)
    return result


# PORTED: Ported to frontend/src/app/enquiries/actions.ts
@router.post("/execute/{enquiry_id}")
async def execute_approved(
    enquiry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")
    if enquiry.status != EnquiryStatus.APPROVED:
        raise HTTPException(400, "Enquiry must be approved before execution")

    from backend.app.services.execution import execute_enquiry

    result = await execute_enquiry(enquiry, db)
    return result
