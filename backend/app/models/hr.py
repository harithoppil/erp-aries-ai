"""HR: Employees, Attendance, Leave, Payroll, Expense Claims."""
import uuid
from datetime import date, time
from sqlalchemy import ForeignKey, String, Text, Date, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Department(Base, TimestampMixin, AuditMixin):
    __tablename__ = "departments"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    department_name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("departments.id"))
    is_group: Mapped[bool] = mapped_column(default=False)

class Designation(Base, TimestampMixin, AuditMixin):
    __tablename__ = "designations"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    designation_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

class Employee(Base, TimestampMixin, AuditMixin):
    __tablename__ = "employees"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    employee_number: Mapped[str] = mapped_column(String(50), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    department: Mapped[str | None] = mapped_column(String(100))
    designation: Mapped[str | None] = mapped_column(String(100))
    date_of_joining: Mapped[date | None] = mapped_column(Date)
    date_of_birth: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    marital_status: Mapped[str | None] = mapped_column(String(20))
    employment_type: Mapped[str | None] = mapped_column(String(50))
    branch: Mapped[str | None] = mapped_column(String(100))
    grade: Mapped[str | None] = mapped_column(String(50))
    bank_account_no: Mapped[str | None] = mapped_column(String(100))
    bank_name: Mapped[str | None] = mapped_column(String(100))
    salary_mode: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="Active")
    resignation_date: Mapped[date | None] = mapped_column(Date)
    relieving_date: Mapped[date | None] = mapped_column(Date)

class Attendance(Base, TimestampMixin, AuditMixin):
    __tablename__ = "attendance"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("employees.id"))
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Present")
    leave_type: Mapped[str | None] = mapped_column(String(50))
    shift: Mapped[str | None] = mapped_column(String(50))
    in_time: Mapped[time | None] = mapped_column(Time)
    out_time: Mapped[time | None] = mapped_column(Time)
    working_hours: Mapped[float] = mapped_column(default=0.0)
    notes: Mapped[str | None] = mapped_column(String(500))

class LeaveType(Base, TimestampMixin, AuditMixin):
    __tablename__ = "leave_types"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    leave_type_name: Mapped[str] = mapped_column(String(100), nullable=False)
    max_days_allowed: Mapped[float] = mapped_column(default=0.0)
    is_carry_forward: Mapped[bool] = mapped_column(default=False)
    is_earned_leave: Mapped[bool] = mapped_column(default=False)

class LeaveApplication(Base, TimestampMixin, AuditMixin):
    __tablename__ = "leave_applications"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("employees.id"))
    leave_type_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("leave_types.id"))
    from_date: Mapped[date] = mapped_column(Date, nullable=False)
    to_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_days: Mapped[float] = mapped_column(default=0.0)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="Open")
    approved_by: Mapped[str | None] = mapped_column(String(255))

class SalarySlip(Base, TimestampMixin, AuditMixin):
    __tablename__ = "salary_slips"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("employees.id"))
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_working_days: Mapped[float] = mapped_column(default=0.0)
    payment_days: Mapped[float] = mapped_column(default=0.0)
    gross_pay: Mapped[float] = mapped_column(Money, default=0.0)
    total_deduction: Mapped[float] = mapped_column(Money, default=0.0)
    net_pay: Mapped[float] = mapped_column(Money, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="Draft")

class ExpenseClaim(Base, TimestampMixin, AuditMixin):
    __tablename__ = "expense_claims"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("employees.id"))
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    total_sanctioned_amount: Mapped[float] = mapped_column(Money, default=0.0)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    approved_by: Mapped[str | None] = mapped_column(String(255))
