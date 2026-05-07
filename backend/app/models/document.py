"""UploadedDocument model — entity-agnostic document storage with OCR processing.

Supports any ERP entity (supplier, invoice, asset, etc.) via entity_type + entity_id.
Images are stored in GCS, metadata and extracted data in postgres.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.core.database import Base, GUID


class DocType(str, enum.Enum):
    INVOICE = "invoice"
    RECEIPT = "receipt"
    CONTRACT = "contract"
    CERTIFICATE = "certificate"
    REPORT = "report"
    OTHER = "other"


class ProcessingStatus(str, enum.Enum):
    PENDING = "pending"
    CONVERTING = "converting"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class UploadedDocument(Base):
    """Entity-agnostic document record — linked to any ERP entity via entity_type/entity_id."""
    __tablename__ = "uploaded_documents"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)

    # File info
    original_filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer, default=0)

    # GCS storage
    gcs_bucket: Mapped[str] = mapped_column(String(255), default="aries-raw-sources")
    gcs_path: Mapped[str] = mapped_column(String(1000))  # e.g. "invoices/2024/01/uuid.jpg"

    # Document classification
    doc_type: Mapped[DocType] = mapped_column(SAEnum(DocType), default=DocType.OTHER)
    auto_detected_type: Mapped[str | None] = mapped_column(String(100))  # What the model thinks it is

    # Entity linkage — generic FK to any table
    entity_type: Mapped[str | None] = mapped_column(String(100))  # e.g. "supplier", "invoice", "asset"
    entity_id: Mapped[uuid.UUID | None] = mapped_column(GUID())  # UUID of the linked entity

    # Processing status
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        SAEnum(ProcessingStatus), default=ProcessingStatus.PENDING
    )
    extracted_data: Mapped[str | None] = mapped_column(Text)  # JSON string of structured extraction
    confidence_score: Mapped[float | None] = mapped_column(Float)
    error_message: Mapped[str | None] = mapped_column(Text)

    # MarkItDown conversion result
    markdown_content: Mapped[str | None] = mapped_column(Text)

    # Optional: public URL for viewing (signed URL or public)
    thumbnail_url: Mapped[str | None] = mapped_column(String(1000))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
