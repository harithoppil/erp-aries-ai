"""Settings: Currencies, Tax, Workflows, Notifications."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Date, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base, GUID, TimestampMixin, AuditMixin

class Currency(Base, TimestampMixin, AuditMixin):
    __tablename__ = "currencies"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    currency_name: Mapped[str] = mapped_column(String(100), nullable=False)
    symbol: Mapped[str] = mapped_column(String(10), nullable=False)
    fraction: Mapped[str | None] = mapped_column(String(50))
    fraction_units: Mapped[int | None] = mapped_column(default=100)
    smallest_currency_fraction_value: Mapped[float] = mapped_column(default=0.01)

class ExchangeRate(Base, TimestampMixin):
    __tablename__ = "exchange_rates"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    from_currency: Mapped[str] = mapped_column(String(10), nullable=False)
    to_currency: Mapped[str] = mapped_column(String(10), nullable=False)
    exchange_rate: Mapped[float] = mapped_column(default=1.0)
    date: Mapped[date] = mapped_column(Date, nullable=False)

class TaxTemplate(Base, TimestampMixin, AuditMixin):
    __tablename__ = "tax_templates"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    template_name: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_type: Mapped[str] = mapped_column(String(100), nullable=False)
    rate: Mapped[float] = mapped_column(default=0.0)

class WorkflowRule(Base, TimestampMixin, AuditMixin):
    __tablename__ = "workflow_rules"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    module: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    condition: Mapped[str | None] = mapped_column(Text)
    action: Mapped[str | None] = mapped_column(Text)
    approver_role: Mapped[str | None] = mapped_column(String(100))

class ActivityLog(Base, TimestampMixin):
    __tablename__ = "activity_logs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(GUID)
    details: Mapped[dict | None] = mapped_column(Text, default="{}")
    ip_address: Mapped[str | None] = mapped_column(String(100))
