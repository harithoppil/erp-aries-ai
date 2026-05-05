"""Double-entry accounting — immutable GL entries."""
import uuid
from datetime import date, datetime, timezone
from sqlalchemy import ForeignKey, String, Date, CheckConstraint, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Account(Base, TimestampMixin, AuditMixin):
    __tablename__ = "accounts"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False)  # Asset/Liability/Equity/Income/Expense
    parent_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("accounts.id"))
    is_group: Mapped[bool] = mapped_column(default=False)
    root_type: Mapped[str | None] = mapped_column(String(50))  # Asset/Liability/Equity/Income/Expense
    lft: Mapped[int | None] = mapped_column(default=0)
    rgt: Mapped[int | None] = mapped_column(default=0)

class FiscalYear(Base, TimestampMixin):
    __tablename__ = "fiscal_years"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    year_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    year_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_closed: Mapped[bool] = mapped_column(default=False)

class JournalEntry(Base, TimestampMixin, AuditMixin):
    __tablename__ = "journal_entries"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    entry_number: Mapped[str] = mapped_column(String(100), nullable=False)
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(100))
    reference_id: Mapped[uuid.UUID | None] = mapped_column(GUID())
    total_debit: Mapped[float] = mapped_column(Money, default=0.0)
    total_credit: Mapped[float] = mapped_column(Money, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="Draft")  # Draft/Submitted/Cancelled
    notes: Mapped[str | None] = mapped_column(Text)
    lines: Mapped[list["JournalEntryLine"]] = relationship("JournalEntryLine", back_populates="journal_entry", cascade="all, delete-orphan")

class JournalEntryLine(Base, TimestampMixin):
    __tablename__ = "journal_entry_lines"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("journal_entries.id"))
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"))
    debit: Mapped[float] = mapped_column(Money, default=0.0)
    credit: Mapped[float] = mapped_column(Money, default=0.0)
    description: Mapped[str | None] = mapped_column(String(500))
    cost_center: Mapped[str | None] = mapped_column(String(100))
    journal_entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")
    __table_args__ = (CheckConstraint("(debit = 0 AND credit > 0) OR (debit > 0 AND credit = 0) OR (debit = 0 AND credit = 0)", name="check_one_side_zero"),)

class GeneralLedgerEntry(Base, TimestampMixin):
    """Immutable ledger entry. Balances computed by summing these, never stored as mutable."""
    __tablename__ = "general_ledger_entries"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("accounts.id"))
    voucher_type: Mapped[str] = mapped_column(String(100), nullable=False)
    voucher_id: Mapped[uuid.UUID] = mapped_column(GUID(), nullable=False)
    debit: Mapped[float] = mapped_column(Money, default=0.0)
    credit: Mapped[float] = mapped_column(Money, default=0.0)
    description: Mapped[str | None] = mapped_column(String(500))
    against_voucher: Mapped[str | None] = mapped_column(String(100))
    against_voucher_id: Mapped[uuid.UUID | None] = mapped_column(GUID())
    fiscal_year_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("fiscal_years.id"))
