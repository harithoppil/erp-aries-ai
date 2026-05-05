import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


class EnquiryStatus(str, enum.Enum):
    DRAFT = "draft"
    INGESTED = "ingested"
    CLASSIFIED = "classified"
    RULES_APPLIED = "rules_applied"
    LLM_DRAFTED = "llm_drafted"
    POLICY_REVIEW = "policy_review"
    HUMAN_REVIEW = "human_review"
    APPROVED = "approved"
    EXECUTING = "executing"
    COMPLETED = "completed"
    REJECTED = "rejected"


class Enquiry(Base):
    __tablename__ = "enquiries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    enquiry_number: Mapped[str | None] = mapped_column(String(50), unique=True, index=True)
    client_name: Mapped[str] = mapped_column(String(255))
    client_email: Mapped[str | None] = mapped_column(String(255))
    channel: Mapped[str] = mapped_column(String(50))
    industry: Mapped[str | None] = mapped_column(String(100))
    subdivision: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[EnquiryStatus] = mapped_column(SAEnum(EnquiryStatus), default=EnquiryStatus.DRAFT, index=True)

    estimated_value: Mapped[float | None] = mapped_column(Float)
    estimated_cost: Mapped[float | None] = mapped_column(Float)
    estimated_margin: Mapped[float | None] = mapped_column(Float)

    scope_category: Mapped[str | None] = mapped_column(String(100))
    complexity: Mapped[str | None] = mapped_column(String(50))
    resource_profile: Mapped[str | None] = mapped_column(Text)

    approved_by: Mapped[str | None] = mapped_column(String(255))
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    documents: Mapped[list["Document"]] = relationship(back_populates="enquiry", cascade="all, delete-orphan")
    audit_log: Mapped[list["AuditLog"]] = relationship(back_populates="enquiry", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    filename: Mapped[str] = mapped_column(String(500))
    content_type: Mapped[str] = mapped_column(String(100))
    storage_path: Mapped[str] = mapped_column(String(1000))
    wiki_source_page: Mapped[str | None] = mapped_column(String(500))
    markdown_content: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(String(50), default="pending")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enquiry: Mapped["Enquiry"] = relationship(back_populates="documents")


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    enquiry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    action: Mapped[str] = mapped_column(String(100))
    actor: Mapped[str] = mapped_column(String(255))
    details: Mapped[str | None] = mapped_column(Text)
    node: Mapped[str | None] = mapped_column(String(50))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    enquiry: Mapped["Enquiry"] = relationship(back_populates="audit_log")
