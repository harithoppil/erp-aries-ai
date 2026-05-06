"""Document upload pipeline — upload images to GCS, process with Vertex AI structured output.

Flow: Upload image → GCS storage → DB record (pending) → Vertex AI structured extraction → update DB (completed)
"""

import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.document import UploadedDocument, DocType, ProcessingStatus

logger = logging.getLogger("aries.document_upload")

router = APIRouter(prefix="/document-upload", tags=["document-upload"])

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB

# Invoice extraction schema for Vertex AI structured output
INVOICE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "invoice_number": {"type": "STRING", "description": "Invoice or receipt number"},
        "date_of_issue": {"type": "STRING", "description": "Date the invoice was issued", "format": "date"},
        "due_date": {"type": "STRING", "description": "Payment due date", "format": "date", "nullable": True},
        "seller": {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "STRING", "description": "Seller company name"},
                "address": {"type": "STRING", "description": "Seller address", "nullable": True},
                "tax_id": {"type": "STRING", "description": "Seller tax ID / VAT number", "nullable": True},
                "email": {"type": "STRING", "description": "Seller email", "nullable": True},
            },
            "required": ["name"],
        },
        "client": {
            "type": "OBJECT",
            "properties": {
                "name": {"type": "STRING", "description": "Client / buyer company name"},
                "address": {"type": "STRING", "description": "Client address", "nullable": True},
                "tax_id": {"type": "STRING", "description": "Client tax ID / VAT number", "nullable": True},
            },
            "required": ["name"],
        },
        "items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "description": {"type": "STRING", "description": "Item description"},
                    "quantity": {"type": "NUMBER", "description": "Quantity", "nullable": True},
                    "unit_price": {"type": "NUMBER", "description": "Unit price", "nullable": True},
                    "total": {"type": "NUMBER", "description": "Line total"},
                },
                "required": ["description", "total"],
            },
        },
        "summary": {
            "type": "OBJECT",
            "properties": {
                "subtotal": {"type": "NUMBER", "description": "Subtotal before tax", "nullable": True},
                "tax_amount": {"type": "NUMBER", "description": "Total tax amount", "nullable": True},
                "total": {"type": "NUMBER", "description": "Grand total"},
            },
            "required": ["total"],
        },
    },
    "required": ["invoice_number", "date_of_issue", "seller", "client", "items", "summary"],
}

# Auto-detect schema — model decides what kind of document this is
AUTO_DETECT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "document_type": {
            "type": "STRING",
            "enum": ["invoice", "receipt", "contract", "certificate", "report", "other"],
            "description": "The type of document detected",
        },
        "confidence": {
            "type": "NUMBER",
            "description": "Confidence score 0-1 for the document type classification",
        },
        "extracted_fields": {
            "type": "OBJECT",
            "description": "Key-value pairs extracted from the document. Field names depend on document type.",
            "properties": {},
        },
    },
    "required": ["document_type", "confidence"],
}


class DocumentReadResponse(BaseModel):
    id: str
    original_filename: str
    content_type: str
    file_size: int
    gcs_path: str
    doc_type: str
    auto_detected_type: str | None
    entity_type: str | None
    entity_id: str | None
    processing_status: str
    extracted_data: dict | None
    confidence_score: float | None
    error_message: str | None
    created_at: str
    processed_at: str | None

    class Config:
        from_attributes = True


class ProcessRequest(BaseModel):
    doc_type: DocType | None = None  # Override auto-detection
    entity_type: str | None = None
    entity_id: str | None = None


@router.post("/upload", response_model=DocumentReadResponse, status_code=201)
async def upload_document(
    file: UploadFile,
    doc_type: DocType = Query(DocType.OTHER),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Upload an image/PDF to GCS and create a document record."""
    file_bytes = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(413, "File too large (max 50MB)")

    content_type = file.content_type or "application/octet-stream"
    ext = (file.filename or "file").rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
    file_id = str(uuid.uuid4())
    gcs_path = f"documents/{doc_type.value}/{file_id}.{ext}"

    # Upload to GCS (fallback to local storage if GCS not configured)
    gcs_uri = None
    try:
        from backend.app.services.gcs import upload_bytes
        gcs_uri = upload_bytes(file_bytes, gcs_path, content_type)
    except Exception as e:
        logger.warning("GCS upload failed, storing path only: %s", e)
        gcs_uri = f"gs://{settings.gcs_bucket_name}/{gcs_path}"

    # Parse entity_id
    parsed_entity_id = None
    if entity_id:
        try:
            parsed_entity_id = uuid.UUID(entity_id)
        except ValueError:
            raise HTTPException(400, "entity_id must be a valid UUID")

    doc = UploadedDocument(
        original_filename=file.filename or "unnamed",
        content_type=content_type,
        file_size=len(file_bytes),
        gcs_bucket=settings.gcs_bucket_name,
        gcs_path=gcs_path,
        doc_type=doc_type,
        entity_type=entity_type,
        entity_id=parsed_entity_id,
        processing_status=ProcessingStatus.PENDING,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Auto-process small images inline
    if content_type.startswith("image/") and len(file_bytes) < 10_000_000:
        try:
            await _process_image(doc, file_bytes, db)
        except Exception as e:
            logger.error("Inline processing failed for %s: %s", doc.id, e)

    await db.refresh(doc)
    return _to_response(doc)


@router.post("/{doc_id}/process", response_model=DocumentReadResponse)
async def process_document(
    doc_id: uuid.UUID,
    request: ProcessRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Process a pending document with Vertex AI structured output."""
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    if doc.processing_status == ProcessingStatus.PROCESSING:
        raise HTTPException(409, "Document is already being processed")

    if request:
        if request.doc_type:
            doc.doc_type = request.doc_type
        if request.entity_type:
            doc.entity_type = request.entity_type
        if request.entity_id:
            doc.entity_id = request.entity_id

    # Process based on content type
    if doc.content_type.startswith("image/"):
        # For images, we need to re-download from GCS or process from stored path
        try:
            file_bytes = _download_from_gcs(doc.gcs_path)
        except Exception:
            raise HTTPException(502, f"Cannot download file from GCS: {doc.gcs_path}")
        await _process_image(doc, file_bytes, db)
    elif doc.content_type == "application/pdf":
        try:
            file_bytes = _download_from_gcs(doc.gcs_path)
        except Exception:
            raise HTTPException(502, f"Cannot download file from GCS: {doc.gcs_path}")
        await _process_pdf(doc, file_bytes, db)
    else:
        raise HTTPException(400, f"Unsupported content type for processing: {doc.content_type}")

    await db.refresh(doc)
    return _to_response(doc)


@router.get("/", response_model=list[DocumentReadResponse])
async def list_documents(
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    status: ProcessingStatus | None = Query(None),
    limit: int = Query(50),
    db: AsyncSession = Depends(get_db),
):
    """List uploaded documents with optional filters."""
    stmt = select(UploadedDocument).order_by(UploadedDocument.created_at.desc()).limit(limit)
    if entity_type:
        stmt = stmt.where(UploadedDocument.entity_type == entity_type)
    if entity_id:
        try:
            eid = uuid.UUID(entity_id)
            stmt = stmt.where(UploadedDocument.entity_id == eid)
        except ValueError:
            pass
    if status:
        stmt = stmt.where(UploadedDocument.processing_status == status)

    result = await db.execute(stmt)
    docs = result.scalars().all()
    return [_to_response(d) for d in docs]


@router.get("/{doc_id}", response_model=DocumentReadResponse)
async def get_document(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return _to_response(doc)


@router.get("/{doc_id}/signed-url")
async def get_signed_url(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Get a signed URL for viewing the document image."""
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        from backend.app.services.gcs import generate_signed_url
        url = generate_signed_url(doc.gcs_path, expiration=3600)
        return {"url": url, "expires_in": 3600}
    except Exception as e:
        raise HTTPException(502, f"Cannot generate signed URL: {e}")


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Delete a document and its GCS file."""
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.delete(doc)
    await db.commit()
    if doc.gcs_path:
        try:
            from backend.app.services.gcs import delete_from_gcs
            delete_from_gcs(doc.gcs_path)
        except Exception as e:
            logger.warning("GCS delete failed (may not exist): %s", e)
    return None


@router.get("/{doc_id}/content")
async def get_document_content(doc_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Proxy document bytes from GCS — frontend never sees signed URLs."""
    doc = await db.get(UploadedDocument, doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    try:
        from backend.app.services.gcs import download_bytes
        data = download_bytes(doc.gcs_path)
        from fastapi import Response
        return Response(content=data, media_type=doc.content_type)
    except Exception as e:
        raise HTTPException(502, f"Cannot fetch document: {e}")


# --- Internal helpers ---

async def _process_image(doc: UploadedDocument, image_bytes: bytes, db: AsyncSession):
    """Process an image with Vertex AI structured output (multimodal)."""
    doc.processing_status = ProcessingStatus.PROCESSING
    await db.commit()

    try:
        from google import genai
        from google.genai import types

        client = settings.get_genai_client()

        # Step 1: Auto-detect document type
        prompt = "Analyze this document image. Classify its type and extract all key information."

        # Build content with image + text prompt
        mime_type = doc.content_type
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            prompt,
        ]

        # Step 2: Use structured output with invoice schema if doc_type is invoice
        if doc.doc_type == DocType.INVOICE:
            schema = INVOICE_SCHEMA
            prompt = "Extract all information from this invoice image. Follow the provided schema exactly."
            contents = [
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt,
            ]
        else:
            schema = AUTO_DETECT_SCHEMA

        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=contents,
            config={
                "response_mime_type": "application/json",
                "response_schema": schema,
            },
        )

        if not response.text:
            raise ValueError("Empty response from Vertex AI")

        extracted = json.loads(response.text)

        # Update document record
        doc.extracted_data = json.dumps(extracted)
        doc.processing_status = ProcessingStatus.COMPLETED
        doc.processed_at = datetime.now(timezone.utc)

        # Auto-detect type if not invoice
        if doc.doc_type != DocType.INVOICE and "document_type" in extracted:
            detected = extracted["document_type"]
            doc.auto_detected_type = detected
            doc.confidence_score = extracted.get("confidence", 0.0)
            # Map detected type to enum
            type_map = {
                "invoice": DocType.INVOICE,
                "receipt": DocType.RECEIPT,
                "contract": DocType.CONTRACT,
                "certificate": DocType.CERTIFICATE,
                "report": DocType.REPORT,
            }
            if detected in type_map:
                doc.doc_type = type_map[detected]

        logger.info("Document %s processed successfully — type: %s", doc.id, doc.doc_type.value)

    except Exception as e:
        logger.error("Document processing failed for %s: %s", doc.id, e, exc_info=True)
        doc.processing_status = ProcessingStatus.FAILED
        doc.error_message = str(e)[:2000]
        doc.processed_at = datetime.now(timezone.utc)

    await db.commit()


async def _process_pdf(doc: UploadedDocument, pdf_bytes: bytes, db: AsyncSession):
    """Process a PDF with Gemini structured output."""
    doc.processing_status = ProcessingStatus.PROCESSING
    await db.commit()

    try:
        from backend.app.services.gemini import GeminiService

        gemini = GeminiService()

        if doc.doc_type == DocType.INVOICE:
            result = await gemini.process_pdf_structured(
                pdf_bytes,
                "Extract all information from this invoice. Follow the provided schema exactly.",
                INVOICE_SCHEMA,
            )
        else:
            result = await gemini.process_pdf_structured(
                pdf_bytes,
                "Classify this document and extract key information.",
                AUTO_DETECT_SCHEMA,
            )

        doc.extracted_data = json.dumps(result)
        doc.processing_status = ProcessingStatus.COMPLETED
        doc.processed_at = datetime.now(timezone.utc)

    except Exception as e:
        logger.error("PDF processing failed for %s: %s", doc.id, e, exc_info=True)
        doc.processing_status = ProcessingStatus.FAILED
        doc.error_message = str(e)[:2000]
        doc.processed_at = datetime.now(timezone.utc)

    await db.commit()


def _download_from_gcs(gcs_path: str) -> bytes:
    """Download file bytes from GCS."""
    from backend.app.services.gcs import _get_bucket
    bucket = _get_bucket()
    blob = bucket.blob(gcs_path)
    return blob.download_as_bytes()


def _to_response(doc: UploadedDocument) -> DocumentReadResponse:
    extracted = None
    if doc.extracted_data:
        try:
            extracted = json.loads(doc.extracted_data)
        except (json.JSONDecodeError, TypeError):
            extracted = {"raw": doc.extracted_data}

    return DocumentReadResponse(
        id=str(doc.id),
        original_filename=doc.original_filename,
        content_type=doc.content_type,
        file_size=doc.file_size,
        gcs_path=doc.gcs_path,
        doc_type=doc.doc_type.value if doc.doc_type else "other",
        auto_detected_type=doc.auto_detected_type,
        entity_type=doc.entity_type,
        entity_id=str(doc.entity_id) if doc.entity_id else None,
        processing_status=doc.processing_status.value if doc.processing_status else "pending",
        extracted_data=extracted,
        confidence_score=doc.confidence_score,
        error_message=doc.error_message,
        created_at=doc.created_at.isoformat() if doc.created_at else "",
        processed_at=doc.processed_at.isoformat() if doc.processed_at else None,
    )
