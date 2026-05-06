"""Complete ERP data models — Accounts, Assets, Stock, Projects, HR, Procurement.

Ported from ERPNext DocTypes, adapted for Aries Marine context.
"""

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, Text, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base, GUID


# ═══════════════════════════════════════════════════════════════════
# ACCOUNTS MODULE
# ═══════════════════════════════════════════════════════════════════

class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    INCOME = "income"
    EXPENSE = "expense"
    EQUITY = "equity"
    RECEIVABLE = "receivable"
    PAYABLE = "payable"


class Account(Base):
    """Chart of Accounts — General Ledger accounts with nested set tree."""
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    account_number: Mapped[str | None] = mapped_column(String(50))
    account_type: Mapped[AccountType | None] = mapped_column(SAEnum(AccountType), nullable=True)
    root_type: Mapped[str | None] = mapped_column(String(20))  # Asset, Liability, Equity, Income, Expense
    report_type: Mapped[str | None] = mapped_column(String(50))  # Balance Sheet, Profit and Loss
    parent_account: Mapped[str | None] = mapped_column(String(200))
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    company: Mapped[str] = mapped_column(String(200), default="Aries Marine")
    account_currency: Mapped[str] = mapped_column(String(3), default="AED")
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0)
    balance_must_be: Mapped[str | None] = mapped_column(String(10))
    balance: Mapped[float] = mapped_column(Float, default=0.0)
    # Nested set for fast tree traversal
    lft: Mapped[int] = mapped_column(Integer, default=0)
    rgt: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subsidiary(Base):
    """Subsidiary / Company — default accounts and settings."""
    __tablename__ = "subsidiaries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    abbr: Mapped[str | None] = mapped_column(String(20))
    default_currency: Mapped[str] = mapped_column(String(3), default="AED")
    country: Mapped[str | None] = mapped_column(String(100))
    tax_id: Mapped[str | None] = mapped_column(String(50))

    # Default accounts
    default_receivable_account: Mapped[str | None] = mapped_column(String(200))
    default_payable_account: Mapped[str | None] = mapped_column(String(200))
    default_income_account: Mapped[str | None] = mapped_column(String(200))
    default_expense_account: Mapped[str | None] = mapped_column(String(200))
    default_bank_account: Mapped[str | None] = mapped_column(String(200))
    default_cash_account: Mapped[str | None] = mapped_column(String(200))
    cost_center: Mapped[str | None] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class FiscalYear(Base):
    """Fiscal Year configuration."""
    __tablename__ = "fiscal_years"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    year: Mapped[str] = mapped_column(String(20))
    year_start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    year_end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_short_year: Mapped[bool] = mapped_column(Boolean, default=False)
    subsidiary_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subsidiaries.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CostCenter(Base):
    """Cost Centers for reporting dimensions."""
    __tablename__ = "cost_centers"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    cost_center_number: Mapped[str | None] = mapped_column(String(50))
    parent_cost_center: Mapped[str | None] = mapped_column(String(200))
    subsidiary_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subsidiaries.id"), nullable=True)
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    disabled: Mapped[bool] = mapped_column(Boolean, default=False)
    lft: Mapped[int] = mapped_column(Integer, default=0)
    rgt: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class GLEntry(Base):
    """General Ledger Entry — unified transaction log. All invoices, payments, journal entries post here."""
    __tablename__ = "gl_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    posting_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    fiscal_year: Mapped[str | None] = mapped_column(String(20))

    # Account
    account_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("accounts.id"), nullable=True, index=True)
    account_currency: Mapped[str | None] = mapped_column(String(3))

    # Party
    party_type: Mapped[str | None] = mapped_column(String(50))  # Customer, Supplier, Employee
    party_name: Mapped[str | None] = mapped_column(String(255))

    # Source document
    voucher_type: Mapped[str | None] = mapped_column(String(50))  # Sales Invoice, Purchase Invoice, Journal Entry, Payment Entry
    voucher_no: Mapped[str | None] = mapped_column(String(100))
    voucher_detail_no: Mapped[str | None] = mapped_column(String(100))
    against_voucher_type: Mapped[str | None] = mapped_column(String(50))
    against_voucher: Mapped[str | None] = mapped_column(String(100))

    # Amounts
    debit: Mapped[float] = mapped_column(Float, default=0.0)
    credit: Mapped[float] = mapped_column(Float, default=0.0)
    debit_in_account_currency: Mapped[float] = mapped_column(Float, default=0.0)
    credit_in_account_currency: Mapped[float] = mapped_column(Float, default=0.0)

    # Dimensions
    cost_center: Mapped[str | None] = mapped_column(String(200))
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"), nullable=True)
    subsidiary_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subsidiaries.id"), nullable=True)

    # Flags
    is_opening: Mapped[str | None] = mapped_column(String(10), default="No")
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    remarks: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class JournalEntryLine(Base):
    """Journal Entry line items — debit/credit lines per journal entry."""
    __tablename__ = "journal_entry_lines"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    journal_entry_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("journal_entries.id"), index=True)

    account_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("accounts.id"), nullable=True)
    party_type: Mapped[str | None] = mapped_column(String(50))
    party_name: Mapped[str | None] = mapped_column(String(255))

    debit: Mapped[float] = mapped_column(Float, default=0.0)
    credit: Mapped[float] = mapped_column(Float, default=0.0)

    cost_center: Mapped[str | None] = mapped_column(String(200))
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"), nullable=True)

    reference_type: Mapped[str | None] = mapped_column(String(50))
    reference_name: Mapped[str | None] = mapped_column(String(100))
    user_remark: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="lines")


class SalesInvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PAID = "paid"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class SalesInvoice(Base):
    """Sales Invoice — convert approved proposals to invoices."""
    __tablename__ = "sales_invoices"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    invoice_number: Mapped[str] = mapped_column(String(50), unique=True)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    customer_name: Mapped[str] = mapped_column(String(255))
    customer_email: Mapped[str | None] = mapped_column(String(255))
    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SalesInvoiceStatus] = mapped_column(SAEnum(SalesInvoiceStatus), default=SalesInvoiceStatus.DRAFT)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=5.0)  # UAE VAT 5%
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    paid_amount: Mapped[float] = mapped_column(Float, default=0.0)
    outstanding_amount: Mapped[float] = mapped_column(Float, default=0.0)
    document_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("uploaded_documents.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["InvoiceItem"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["PaymentEntry"]] = relationship(back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base):
    """Line items on a Sales Invoice."""
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sales_invoices.id"))
    item_code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)

    invoice: Mapped["SalesInvoice"] = relationship(back_populates="items")


class JournalEntryType(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class JournalEntry(Base):
    """Journal Entries — double-entry bookkeeping header."""
    __tablename__ = "journal_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    entry_number: Mapped[str] = mapped_column(String(50), unique=True)
    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reference: Mapped[str | None] = mapped_column(String(200))
    # Legacy flat fields (kept for compatibility with existing data)
    account: Mapped[str | None] = mapped_column(String(255))  # Account name/code
    party_type: Mapped[str | None] = mapped_column(String(50))
    party_name: Mapped[str | None] = mapped_column(String(255))
    entry_type: Mapped[JournalEntryType | None] = mapped_column(SAEnum(JournalEntryType), nullable=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="AED")
    notes: Mapped[str | None] = mapped_column(Text)
    # New header fields
    total_debit: Mapped[float] = mapped_column(Float, default=0.0)
    total_credit: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, submitted, cancelled
    subsidiary_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("subsidiaries.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lines: Mapped[list["JournalEntryLine"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")


class PaymentEntry(Base):
    """Payment entries — track receipts and payments."""
    __tablename__ = "payment_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("sales_invoices.id"))
    payment_type: Mapped[str] = mapped_column(String(50))  # receive, pay, internal
    party_type: Mapped[str] = mapped_column(String(50))  # customer, supplier
    party_name: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="AED")
    reference_number: Mapped[str | None] = mapped_column(String(100))
    reference_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    invoice: Mapped["SalesInvoice | None"] = relationship(back_populates="payments")


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class Quotation(Base):
    """Quotations / Proposals to customers."""
    __tablename__ = "quotations"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    quotation_number: Mapped[str] = mapped_column(String(50), unique=True)
    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("customers.id"))
    customer_name: Mapped[str] = mapped_column(String(255))
    project_type: Mapped[str | None] = mapped_column(String(100))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[QuotationStatus] = mapped_column(SAEnum(QuotationStatus), default=QuotationStatus.DRAFT)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=5.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["QuotationItem"]] = relationship(back_populates="quotation", cascade="all, delete-orphan")


class QuotationItem(Base):
    """Line items on a Quotation."""
    __tablename__ = "quotation_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    quotation_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("quotations.id"))
    item_code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)

    quotation: Mapped["Quotation"] = relationship(back_populates="items")


class SalesOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    TO_DELIVER = "to_deliver"
    TO_BILL = "to_bill"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class SalesOrder(Base):
    """Sales Orders — confirmed customer orders."""
    __tablename__ = "sales_orders"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    order_number: Mapped[str] = mapped_column(String(50), unique=True)
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("quotations.id"))
    customer_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("customers.id"))
    customer_name: Mapped[str] = mapped_column(String(255))
    project_type: Mapped[str | None] = mapped_column(String(100))
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[SalesOrderStatus] = mapped_column(SAEnum(SalesOrderStatus), default=SalesOrderStatus.DRAFT)

    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=5.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["SalesOrderItem"]] = relationship(back_populates="sales_order", cascade="all, delete-orphan")


class SalesOrderItem(Base):
    """Line items on a Sales Order."""
    __tablename__ = "sales_order_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("sales_orders.id"))
    item_code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)
    delivered_qty: Mapped[int] = mapped_column(Integer, default=0)

    sales_order: Mapped["SalesOrder"] = relationship(back_populates="items")


class TaxCategory(Base):
    """Tax categories (UAE VAT, Withholding Tax, etc.)."""
    __tablename__ = "tax_categories"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    rate: Mapped[float] = mapped_column(Float)
    description: Mapped[str | None] = mapped_column(Text)


# ═══════════════════════════════════════════════════════════════════
# ASSETS & EQUIPMENT MODULE
# ═══════════════════════════════════════════════════════════════════

class AssetStatus(str, enum.Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    UNDER_MAINTENANCE = "under_maintenance"
    CALIBRATION_DUE = "calibration_due"
    DECOMMISSIONED = "decommissioned"


class Asset(Base):
    """Equipment & Fixed Assets — UT kits, gas monitors, ROVs, etc."""
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    asset_name: Mapped[str] = mapped_column(String(255))
    asset_code: Mapped[str] = mapped_column(String(100), unique=True)
    asset_category: Mapped[str] = mapped_column(String(100))  # ndt_equipment, rov, safety, vehicle, vessel
    status: Mapped[AssetStatus] = mapped_column(SAEnum(AssetStatus), default=AssetStatus.AVAILABLE)

    location: Mapped[str | None] = mapped_column(String(200))  # Sharjah warehouse, Rig A, MV Explorer
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"), index=True)

    purchase_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    purchase_cost: Mapped[float | None] = mapped_column(Float)
    current_value: Mapped[float | None] = mapped_column(Float)
    depreciation_rate: Mapped[float] = mapped_column(Float, default=10.0)  # % per year

    # Calibration & Certification
    calibration_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_calibration_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    calibration_certificate: Mapped[str | None] = mapped_column(String(500))
    certification_body: Mapped[str | None] = mapped_column(String(200))

    # Assignment
    assigned_to_project: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)
    assigned_to_personnel: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("personnel.id"), index=True)

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    maintenance_records: Mapped[list["MaintenanceRecord"]] = relationship(back_populates="asset", cascade="all, delete-orphan")


class MaintenanceRecord(Base):
    """Maintenance & calibration history."""
    __tablename__ = "maintenance_records"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("assets.id"))
    maintenance_type: Mapped[str] = mapped_column(String(50))  # calibration, repair, inspection, preventive
    description: Mapped[str] = mapped_column(Text)
    performed_by: Mapped[str] = mapped_column(String(255))
    performed_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    next_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cost: Mapped[float] = mapped_column(Float, default=0.0)

    asset: Mapped["Asset"] = relationship(back_populates="maintenance_records")


# ═══════════════════════════════════════════════════════════════════
# STOCK & INVENTORY MODULE
# ═══════════════════════════════════════════════════════════════════

class ItemGroup(str, enum.Enum):
    CONSUMABLE = "consumable"
    EQUIPMENT = "equipment"
    SERVICE = "service"
    RAW_MATERIAL = "raw_material"
    SPARE_PART = "spare_part"


class StockValuationMethod(str, enum.Enum):
    FIFO = "fifo"
    MOVING_AVERAGE = "moving_average"


class Item(Base):
    """Items — products, consumables, services in the catalog."""
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    item_code: Mapped[str] = mapped_column(String(100), unique=True)
    item_name: Mapped[str] = mapped_column(String(255))
    item_group: Mapped[ItemGroup] = mapped_column(SAEnum(ItemGroup))
    description: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(20), default="Nos")
    has_batch: Mapped[bool] = mapped_column(Boolean, default=False)
    has_serial: Mapped[bool] = mapped_column(Boolean, default=False)
    valuation_method: Mapped[StockValuationMethod] = mapped_column(SAEnum(StockValuationMethod), default=StockValuationMethod.FIFO)

    standard_rate: Mapped[float | None] = mapped_column(Float)
    min_order_qty: Mapped[float | None] = mapped_column(Float)
    safety_stock: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Warehouse(Base):
    """Multi-warehouse inventory locations."""
    __tablename__ = "warehouses"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    warehouse_name: Mapped[str] = mapped_column(String(200))
    warehouse_code: Mapped[str] = mapped_column(String(50), unique=True)
    location: Mapped[str] = mapped_column(String(200))  # Sharjah, Dubai, Rig, Vessel
    is_group: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_warehouse: Mapped[str | None] = mapped_column(String(200))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StockEntryType(str, enum.Enum):
    RECEIPT = "receipt"
    DELIVERY = "delivery"
    TRANSFER = "transfer"
    MANUFACTURE = "manufacture"


class StockEntry(Base):
    """Stock movements — receipts, deliveries, transfers."""
    __tablename__ = "stock_entries"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    entry_type: Mapped[StockEntryType] = mapped_column(SAEnum(StockEntryType))
    item_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("items.id"), index=True)
    quantity: Mapped[float] = mapped_column(Float)
    source_warehouse: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    target_warehouse: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    serial_number: Mapped[str | None] = mapped_column(String(100))
    batch_number: Mapped[str | None] = mapped_column(String(100))
    valuation_rate: Mapped[float | None] = mapped_column(Float)
    reference: Mapped[str | None] = mapped_column(String(200))  # PO number, SO number, etc.

    posting_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Bin(Base):
    """Current stock levels per warehouse per item."""
    __tablename__ = "bins"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("items.id"), index=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("warehouses.id"), index=True)
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    valuation_rate: Mapped[float] = mapped_column(Float, default=0.0)
    stock_value: Mapped[float] = mapped_column(Float, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ═══════════════════════════════════════════════════════════════════
# PROJECTS & OPERATIONS MODULE
# ═══════════════════════════════════════════════════════════════════

class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ProjectType(str, enum.Enum):
    SURVEY = "survey"
    INSPECTION = "inspection"
    NDT = "ndt"
    INSTALLATION = "installation"
    MAINTENANCE = "maintenance"
    CONSULTING = "consulting"


class Project(Base):
    """Projects — post-approval operations tracking."""
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_name: Mapped[str] = mapped_column(String(255))
    project_code: Mapped[str] = mapped_column(String(50), unique=True)
    project_type: Mapped[str] = mapped_column(String(100))
    status: Mapped[ProjectStatus] = mapped_column(SAEnum(ProjectStatus), default=ProjectStatus.PLANNING)

    enquiry_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("enquiries.id"))
    customer_name: Mapped[str] = mapped_column(String(255))
    expected_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expected_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Location / vessel
    project_location: Mapped[str | None] = mapped_column(String(200))
    vessel_name: Mapped[str | None] = mapped_column(String(200))

    # Financials
    estimated_cost: Mapped[float | None] = mapped_column(Float)
    actual_cost: Mapped[float] = mapped_column(Float, default=0.0)
    day_rate: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    tasks: Mapped[list["Task"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    timesheets: Mapped[list["Timesheet"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    assignments: Mapped[list["ProjectAssignment"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class Task(Base):
    """Tasks within a project."""
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)

    subject: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(SAEnum(TaskStatus), default=TaskStatus.TODO)
    assigned_to: Mapped[str | None] = mapped_column(String(255))
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    progress: Mapped[float] = mapped_column(Float, default=0.0)

    project: Mapped["Project"] = relationship(back_populates="tasks")


class Timesheet(Base):
    """Daily timesheets for day-rate billing."""
    __tablename__ = "timesheets"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)
    personnel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("personnel.id"))
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    hours: Mapped[float] = mapped_column(Float, default=8.0)
    activity_type: Mapped[str] = mapped_column(String(100))  # ndt_inspection, rope_access, survey, reporting
    description: Mapped[str | None] = mapped_column(Text)
    billable: Mapped[bool] = mapped_column(Boolean, default=True)

    project: Mapped["Project"] = relationship(back_populates="timesheets")


class ProjectAssignment(Base):
    """Personnel assigned to projects — with compliance checking."""
    __tablename__ = "project_assignments"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("projects.id"), index=True)
    personnel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("personnel.id"), index=True)
    role: Mapped[str] = mapped_column(String(100))  # ndt_technician, rope_access_tech, project_manager
    compliance_checked: Mapped[bool] = mapped_column(Boolean, default=False)
    compliance_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    compliance_issues: Mapped[str | None] = mapped_column(Text)  # any flagged cert expirations

    project: Mapped["Project"] = relationship(back_populates="assignments")


# ═══════════════════════════════════════════════════════════════════
# HR & COMPLIANCE MODULE
# ═══════════════════════════════════════════════════════════════════

class PersonnelStatus(str, enum.Enum):
    ACTIVE = "active"
    ON_PROJECT = "on_project"
    ON_LEAVE = "on_leave"
    INACTIVE = "inactive"


class Personnel(Base):
    """Personnel / Employees — with certification tracking."""
    __tablename__ = "personnel"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[str] = mapped_column(String(50), unique=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[PersonnelStatus] = mapped_column(SAEnum(PersonnelStatus), default=PersonnelStatus.ACTIVE)
    designation: Mapped[str | None] = mapped_column(String(100))  # NDT Technician, Rope Access Tech, Surveyor
    department: Mapped[str | None] = mapped_column(String(100))

    # Day rate for billing
    day_rate: Mapped[float | None] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    certifications: Mapped[list["Certification"]] = relationship(back_populates="personnel", cascade="all, delete-orphan")


class CertStatus(str, enum.Enum):
    VALID = "valid"
    EXPIRING_SOON = "expiring_soon"  # within 90 days
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class Certification(Base):
    """Personnel certifications — IRATA, CSWIP, BOSIET, HUET, offshore medicals."""
    __tablename__ = "certifications"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    personnel_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("personnel.id"), index=True)
    cert_type: Mapped[str] = mapped_column(String(100))  # IRATA, CSWIP_3.1, BOSIET, HUET, offshore_medical, first_aid
    cert_number: Mapped[str | None] = mapped_column(String(100))
    issuing_body: Mapped[str | None] = mapped_column(String(200))
    issue_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[CertStatus] = mapped_column(SAEnum(CertStatus), default=CertStatus.VALID, index=True)

    personnel: Mapped["Personnel"] = relationship(back_populates="certifications")


class QualityInspection(Base):
    """Quality management — ISO compliance tracking."""
    __tablename__ = "quality_inspections"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    inspection_type: Mapped[str] = mapped_column(String(100))  # internal_audit, ndt_report_review, equipment_check
    reference: Mapped[str | None] = mapped_column(String(200))  # project code, asset code
    status: Mapped[str] = mapped_column(String(50), default="open")  # open, passed, failed, corrective_action
    findings: Mapped[str | None] = mapped_column(Text)
    corrective_action: Mapped[str | None] = mapped_column(Text)
    inspected_by: Mapped[str] = mapped_column(String(255))
    inspection_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# ═══════════════════════════════════════════════════════════════════
# PROCUREMENT MODULE
# ═══════════════════════════════════════════════════════════════════

class POStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    RECEIVED = "received"
    CANCELLED = "cancelled"


class Supplier(Base):
    """Suppliers / Vendors."""
    __tablename__ = "suppliers"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    supplier_name: Mapped[str] = mapped_column(String(255))
    supplier_code: Mapped[str] = mapped_column(String(50), unique=True)
    contact_person: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))  # ndt_equipment, rope_access, marine_services
    rating: Mapped[float | None] = mapped_column(Float)
    document_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("uploaded_documents.id"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Customer(Base):
    """Customers / Clients for marine services."""
    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    customer_name: Mapped[str] = mapped_column(String(255))
    customer_code: Mapped[str] = mapped_column(String(50), unique=True)
    contact_person: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    industry: Mapped[str | None] = mapped_column(String(100))  # oil_gas, marine, renewable, etc.
    tax_id: Mapped[str | None] = mapped_column(String(50))  # TRN for UAE VAT
    credit_limit: Mapped[float | None] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="active")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PurchaseOrder(Base):
    """Purchase Orders to suppliers."""
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    po_number: Mapped[str] = mapped_column(String(50), unique=True)
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("suppliers.id"))
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"))
    status: Mapped[POStatus] = mapped_column(SAEnum(POStatus), default=POStatus.DRAFT)

    order_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expected_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    total: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(3), default="AED")

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items: Mapped[list["POItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")


class POItem(Base):
    """Purchase Order line items."""
    __tablename__ = "po_items"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    po_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("purchase_orders.id"))
    item_code: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    rate: Mapped[float] = mapped_column(Float)
    amount: Mapped[float] = mapped_column(Float)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")


class MaterialRequest(Base):
    """Material Requests from project teams."""
    __tablename__ = "material_requests"

    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    request_number: Mapped[str] = mapped_column(String(50), unique=True)
    project_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("projects.id"))
    requested_by: Mapped[str] = mapped_column(String(255))
    purpose: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, approved, ordered, fulfilled

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
