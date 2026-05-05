"""Fixed Assets: Register, Categories, Depreciation, Maintenance."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Date, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class FixedAsset(Base, TimestampMixin, AuditMixin):
    __tablename__ = "fixed_assets"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    asset_name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("items.id"))
    asset_category: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(255))
    purchase_date: Mapped[date | None] = mapped_column(Date)
    purchase_amount: Mapped[float] = mapped_column(Money, default=0.0)
    gross_purchase_amount: Mapped[float] = mapped_column(Money, default=0.0)
    available_for_use_date: Mapped[date | None] = mapped_column(Date)
    depreciation_method: Mapped[str] = mapped_column(String(50), default="Straight Line")
    total_depreciable_value: Mapped[float] = mapped_column(Money, default=0.0)
    value_after_depreciation: Mapped[float] = mapped_column(Money, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="Active")

class AssetCategory(Base, TimestampMixin, AuditMixin):
    __tablename__ = "asset_categories"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    depreciation_method: Mapped[str] = mapped_column(String(50), default="Straight Line")
    total_number_of_depreciations: Mapped[int] = mapped_column(default=12)
    frequency_of_depreciation: Mapped[str] = mapped_column(String(20), default="Monthly")

class AssetDepreciationSchedule(Base, TimestampMixin, AuditMixin):
    __tablename__ = "asset_depreciation_schedules"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("fixed_assets.id"))
    schedule_date: Mapped[date] = mapped_column(Date, nullable=False)
    depreciation_amount: Mapped[float] = mapped_column(Money, default=0.0)
    accumulated_depreciation_amount: Mapped[float] = mapped_column(Money, default=0.0)
    is_booked: Mapped[bool] = mapped_column(default=False)

class AssetMaintenanceLog(Base, TimestampMixin, AuditMixin):
    __tablename__ = "asset_maintenance_logs"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("fixed_assets.id"))
    maintenance_date: Mapped[date] = mapped_column(Date, nullable=False)
    maintenance_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    maintenance_cost: Mapped[float] = mapped_column(Money, default=0.0)
    next_maintenance_date: Mapped[date | None] = mapped_column(Date)
    performed_by: Mapped[str | None] = mapped_column(String(255))
