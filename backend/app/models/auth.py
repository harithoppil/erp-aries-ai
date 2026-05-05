"""Auth, RBAC, Company, Warehouse models."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, Boolean, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, GUID, TimestampMixin, AuditMixin

class Company(Base, TimestampMixin):
    __tablename__ = "companies"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tax_id: Mapped[str | None] = mapped_column(String(100))
    vat_reg_no: Mapped[str | None] = mapped_column(String(100))
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    country: Mapped[str] = mapped_column(String(10), default="AE")
    address: Mapped[dict | None] = mapped_column(Text, default="{}")
    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    settings: Mapped[dict | None] = mapped_column(Text, default="{}")
    is_active: Mapped[bool] = mapped_column(default=True)

class User(Base, TimestampMixin):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    company_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("companies.id"))
    is_active: Mapped[bool] = mapped_column(default=True)
    is_superuser: Mapped[bool] = mapped_column(default=False)
    last_login: Mapped[datetime | None] = mapped_column(DateTime)

class Role(Base, TimestampMixin):
    __tablename__ = "roles"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500))
    permissions: Mapped[dict | None] = mapped_column(Text, default="{}")
    company_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("companies.id"))

class UserRole(Base):
    __tablename__ = "user_roles"
    user_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("users.id"), primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("roles.id"), primary_key=True)

class Warehouse(Base, TimestampMixin, AuditMixin):
    __tablename__ = "warehouses"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str | None] = mapped_column(String(500))
    warehouse_type: Mapped[str | None] = mapped_column(String(50))
