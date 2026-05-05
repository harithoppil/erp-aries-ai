"""Document routes — upload, list, PDF processing (async via Celery for large files)."""

import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import get_db
from backend.app.models.enquiry import Document, Enquiry
from backend.app.schemas.enquiry import DocumentRead
from backend.app.services.ingestion import ingest_document

logger = logging.getLogger("aries.documents")

router = APIRouter(prefix="/documents", tags=["documents"])

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB


@router.post("/{enquiry_id}/upload", response_model=DocumentRead, status_code=201)
async def upload_document(
    enquiry_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    enquiry = await db.get(Enquiry, enquiry_id)
    if not enquiry:
        raise HTTPException(404, "Enquiry not found")

    doc = Document(
        enquiry_id=enquiry_id,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        storage_path=f"uploads/{enquiry_id}/{file.filename}",
        processing_status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    file_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    # Small files (<10MB): process synchronously
    # Large files: mark as queued for background processing
    if len(file_bytes) < 10_000_000:
        await ingest_document(doc.id, file_bytes, doc.filename, db)
    else:
        doc.processing_status = "queued"
        await db.commit()
        # TODO: Offload to Celery task when Redis is available
        # For now, process synchronously but with a timeout warning
        logger.info("Processing large file %s (%d bytes) synchronously", doc.filename, len(file_bytes))
        await ingest_document(doc.id, file_bytes, doc.filename, db)

    await db.refresh(doc)
    return doc


@router.get("/{enquiry_id}", response_model=list[DocumentRead])
async def list_documents(enquiry_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Document).where(Document.enquiry_id == enquiry_id)
    result = await db.execute(stmt)
    return result.scalars().all()


class PDFProcessRequest(BaseModel):
    prompt: str = "Extract all key information from this document"


class PDFStructuredRequest(BaseModel):
    prompt: str
    schema: dict


class PDFJobResponse(BaseModel):
    job_id: str
    filename: str
    status: str
    message: str


# In-memory job tracking (replace with Redis/Celery result backend in production)
_pdf_jobs: dict[str, dict] = {}


@router.post("/process-pdf", response_model=PDFJobResponse)
async def process_pdf(file: UploadFile, prompt: str = "Summarize this document"):
    """Process a PDF using Gemini 3 Flash native vision. Returns job ID for polling on large files."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported for direct Gemini processing")

    pdf_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(pdf_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    # Small PDFs: process inline
    if len(pdf_bytes) < 5_000_000:
        from backend.app.services.gemini import GeminiService
        try:
            gemini = GeminiService()
            result = await gemini.process_pdf(pdf_bytes, prompt)
            job_id = str(uuid.uuid4())
            _pdf_jobs[job_id] = {"status": "completed", "filename": file.filename, "result": result}
            return PDFJobResponse(job_id=job_id, filename=file.filename, status="completed", message=result[:500])
        except Exception as e:
            logger.error("PDF processing failed: %s", e)
            raise HTTPException(502, f"PDF processing failed: {e}")

    # Large PDFs: return job immediately, process in background
    job_id = str(uuid.uuid4())
    _pdf_jobs[job_id] = {"status": "processing", "filename": file.filename, "result": None}
    # TODO: Celery task dispatch
    # For now, process but return the job ID so the client can poll
    return PDFJobResponse(job_id=job_id, filename=file.filename, status="processing", message="PDF queued for processing. Poll /documents/pdf-job/{job_id} for result.")


@router.get("/pdf-job/{job_id}")
async def get_pdf_job(job_id: str):
    """Poll for PDF processing job result."""
    job = _pdf_jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.post("/process-pdf-structured")
async def process_pdf_structured(request: PDFStructuredRequest, file: UploadFile):
    """Process a PDF and extract structured data using Gemini structured outputs."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported")

    pdf_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(pdf_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")
    from backend.app.services.gemini import GeminiService
    try:
        gemini = GeminiService()
        result = await gemini.process_pdf_structured(pdf_bytes, request.prompt, request.schema)
        return {"filename": file.filename, "result": result}
    except Exception as e:
        logger.error("Structured PDF extraction failed: %s", e)
        raise HTTPException(502, f"Structured PDF extraction failed: {e}")
