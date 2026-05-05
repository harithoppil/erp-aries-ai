"""Projects, Tasks, Timesheets, Expenses."""
import uuid
from datetime import date, datetime
from sqlalchemy import ForeignKey, String, Text, Date, DateTime, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Project(Base, TimestampMixin, AuditMixin):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    project_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("customers.id"))
    status: Mapped[str] = mapped_column(String(20), default="Planning")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    estimated_cost: Mapped[float] = mapped_column(Money, default=0.0)
    actual_cost: Mapped[float] = mapped_column(Money, default=0.0)
    estimated_revenue: Mapped[float] = mapped_column(Money, default=0.0)
    actual_revenue: Mapped[float] = mapped_column(Money, default=0.0)
    progress_pct: Mapped[float] = mapped_column(default=0.0)
    notes: Mapped[str | None] = mapped_column(Text)
    tasks = relationship("ProjectTask", back_populates="project", cascade="all, delete-orphan")

class ProjectTask(Base, TimestampMixin, AuditMixin):
    __tablename__ = "project_tasks"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("projects.id"))
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    assigned_to: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="Open")
    priority: Mapped[str] = mapped_column(String(20), default="Medium")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    progress_pct: Mapped[float] = mapped_column(default=0.0)
    cost: Mapped[float] = mapped_column(Money, default=0.0)
    billable_hours: Mapped[float] = mapped_column(default=0.0)
    project = relationship("Project", back_populates="tasks")

class Timesheet(Base, TimestampMixin, AuditMixin):
    __tablename__ = "timesheets"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("employees.id"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("projects.id"))
    task_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("project_tasks.id"))
    activity_type: Mapped[str | None] = mapped_column(String(100))
    from_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    to_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    hours: Mapped[float] = mapped_column(default=0.0)
    billing_rate: Mapped[float] = mapped_column(Money, default=0.0)
    billing_amount: Mapped[float] = mapped_column(Money, default=0.0)
    cost_rate: Mapped[float] = mapped_column(Money, default=0.0)
    cost_amount: Mapped[float] = mapped_column(Money, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
