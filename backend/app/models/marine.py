"""Aries Marine-specific: Vessels, Crew, Dive Ops, Safety, Fuel, Charters."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Vessel(Base, TimestampMixin, AuditMixin):
    __tablename__ = "vessels"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    vessel_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vessel_code: Mapped[str] = mapped_column(String(50), nullable=False)
    vessel_type: Mapped[str | None] = mapped_column(String(100))  # DP Vessel, Dive Support, etc.
    imo_number: Mapped[str | None] = mapped_column(String(50))
    flag: Mapped[str | None] = mapped_column(String(50))
    year_built: Mapped[int | None] = mapped_column(default=None)
    length_m: Mapped[float | None] = mapped_column(default=None)
    beam_m: Mapped[float | None] = mapped_column(default=None)
    draft_m: Mapped[float | None] = mapped_column(default=None)
    gross_tonnage: Mapped[float | None] = mapped_column(default=None)
    engine_power: Mapped[str | None] = mapped_column(String(100))
    max_speed: Mapped[float | None] = mapped_column(default=None)
    owner: Mapped[str | None] = mapped_column(String(255))
    operator: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="Active")
    home_port: Mapped[str | None] = mapped_column(String(100))
    current_location: Mapped[str | None] = mapped_column(String(255))
    last_inspection_date: Mapped[date | None] = mapped_column(Date)
    next_inspection_date: Mapped[date | None] = mapped_column(Date)
    certifications: Mapped[dict | None] = mapped_column(Text, default="{}")
    notes: Mapped[str | None] = mapped_column(Text)

class VesselCertification(Base, TimestampMixin, AuditMixin):
    __tablename__ = "vessel_certifications"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    vessel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("vessels.id"))
    certification_type: Mapped[str] = mapped_column(String(100), nullable=False)
    certificate_number: Mapped[str] = mapped_column(String(100), nullable=False)
    issuing_authority: Mapped[str | None] = mapped_column(String(255))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Valid")
    attachment_url: Mapped[str | None] = mapped_column(String(500))

class CrewAssignment(Base, TimestampMixin, AuditMixin):
    __tablename__ = "crew_assignments"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("employees.id"))
    vessel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("vessels.id"))
    role_on_vessel: Mapped[str] = mapped_column(String(100), nullable=False)
    rank: Mapped[str | None] = mapped_column(String(50))
    certification_level: Mapped[str | None] = mapped_column(String(100))
    date_assigned: Mapped[date] = mapped_column(Date, nullable=False)
    date_relieved: Mapped[date | None] = mapped_column(Date)

class DiveOperation(Base, TimestampMixin, AuditMixin):
    __tablename__ = "dive_operations"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"))
    vessel_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("vessels.id"))
    dive_supervisor: Mapped[str | None] = mapped_column(String(255))
    dive_date: Mapped[date] = mapped_column(Date, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255))
    depth_m: Mapped[float | None] = mapped_column(default=None)
    duration_minutes: Mapped[int | None] = mapped_column(default=None)
    purpose: Mapped[str | None] = mapped_column(Text)
    team_members: Mapped[dict | None] = mapped_column(Text, default="{}")
    equipment_used: Mapped[dict | None] = mapped_column(Text, default="{}")
    weather_conditions: Mapped[str | None] = mapped_column(String(255))
    visibility_m: Mapped[float | None] = mapped_column(default=None)
    water_temp_c: Mapped[float | None] = mapped_column(default=None)
    status: Mapped[str] = mapped_column(String(20), default="Planned")
    notes: Mapped[str | None] = mapped_column(Text)

class SafetyEquipment(Base, TimestampMixin, AuditMixin):
    __tablename__ = "safety_equipment"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("items.id"))
    equipment_type: Mapped[str] = mapped_column(String(100), nullable=False)
    serial_number: Mapped[str | None] = mapped_column(String(100))
    location: Mapped[str | None] = mapped_column(String(255))
    inspection_date: Mapped[date | None] = mapped_column(Date)
    next_inspection_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="OK")
    inspection_notes: Mapped[str | None] = mapped_column(Text)

class MaintenanceSchedule(Base, TimestampMixin, AuditMixin):
    __tablename__ = "maintenance_schedules"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    vessel_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("vessels.id"))
    equipment_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("items.id"))
    maintenance_type: Mapped[str] = mapped_column(String(100), nullable=False)
    frequency: Mapped[str | None] = mapped_column(String(50))
    last_maintenance_date: Mapped[date | None] = mapped_column(Date)
    next_maintenance_date: Mapped[date | None] = mapped_column(Date)
    responsible_department: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(20), default="Scheduled")
    notes: Mapped[str | None] = mapped_column(Text)

class FuelLog(Base, TimestampMixin, AuditMixin):
    __tablename__ = "fuel_logs"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    vessel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("vessels.id"))
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    fuel_type: Mapped[str | None] = mapped_column(String(50))
    quantity_liters: Mapped[float] = mapped_column(default=0.0)
    cost_per_liter: Mapped[float] = mapped_column(Money, default=0.0)
    total_cost: Mapped[float] = mapped_column(Money, default=0.0)
    location: Mapped[str | None] = mapped_column(String(255))
    bunkering_party: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

class CharterContract(Base, TimestampMixin, AuditMixin):
    __tablename__ = "charter_contracts"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    vessel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("vessels.id"))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("customers.id"))
    contract_number: Mapped[str] = mapped_column(String(100), nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    charter_type: Mapped[str] = mapped_column(String(20), default="Time")
    daily_rate: Mapped[float] = mapped_column(Money, default=0.0)
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    currency: Mapped[str] = mapped_column(String(10), default="AED")
    payment_terms: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    terms_and_conditions: Mapped[str | None] = mapped_column(Text)
