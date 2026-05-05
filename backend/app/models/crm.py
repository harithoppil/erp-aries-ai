"""CRM: Leads, Opportunities, Communications."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Lead(Base, TimestampMixin, AuditMixin):
    __tablename__ = "leads"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    lead_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    source: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="Open")
    territory: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

class Opportunity(Base, TimestampMixin, AuditMixin):
    __tablename__ = "opportunities"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    lead_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("leads.id"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("customers.id"))
    opportunity_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Open")
    stage: Mapped[str | None] = mapped_column(String(50))
    expected_closing: Mapped[date | None] = mapped_column(Date)
    probability: Mapped[float] = mapped_column(default=0.0)
    expected_value: Mapped[float] = mapped_column(Money, default=0.0)
    source: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)

class Communication(Base, TimestampMixin, AuditMixin):
    __tablename__ = "communications"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    reference_type: Mapped[str | None] = mapped_column(String(100))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(GUID)
    communication_type: Mapped[str] = mapped_column(String(20), default="Note")
    subject: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[str | None] = mapped_column(Text)
    sender: Mapped[str | None] = mapped_column(String(255))
    recipients: Mapped[str | None] = mapped_column(Text)
    communication_date: Mapped[date] = mapped_column(Date, nullable=False)
