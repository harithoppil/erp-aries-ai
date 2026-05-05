"""Sales: Customers, Quotations, Orders, Delivery Notes, Invoices, Payments."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Text, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Customer(Base, TimestampMixin, AuditMixin):
    __tablename__ = "customers"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    tax_id: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[dict | None] = mapped_column(Text, default="{}")
    credit_limit: Mapped[float] = mapped_column(Money, default=0.0)
    payment_terms: Mapped[int] = mapped_column(default=30)  # days

class Quotation(Base, TimestampMixin, AuditMixin):
    __tablename__ = "quotations"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("customers.id"))
    series: Mapped[str] = mapped_column(String(50), default="QTN-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="Draft")  # Draft/Sent/Accepted/Rejected
    total_qty: Mapped[float] = mapped_column(default=0.0)
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Money, default=0.0)
    grand_total: Mapped[float] = mapped_column(Money, default=0.0)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text)
    items = relationship("QuotationItem", back_populates="quotation", cascade="all, delete-orphan")

class QuotationItem(Base, TimestampMixin):
    __tablename__ = "quotation_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    quotation_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("quotations.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("items.id"))
    description: Mapped[str | None] = mapped_column(String(500))
    qty: Mapped[float] = mapped_column(default=1.0)
    rate: Mapped[float] = mapped_column(Money, default=0.0)
    amount: Mapped[float] = mapped_column(Money, default=0.0)
    tax_rate: Mapped[float] = mapped_column(default=0.0)
    quotation = relationship("Quotation", back_populates="items")

class SalesOrder(Base, TimestampMixin, AuditMixin):
    __tablename__ = "sales_orders"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("customers.id"))
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("quotations.id"))
    series: Mapped[str] = mapped_column(String(50), default="SO-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="Draft")  # Draft/Confirmed/Completed/Cancelled
    total_qty: Mapped[float] = mapped_column(default=0.0)
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Money, default=0.0)
    grand_total: Mapped[float] = mapped_column(Money, default=0.0)
    per_billed: Mapped[float] = mapped_column(default=0.0)
    per_delivered: Mapped[float] = mapped_column(default=0.0)
    items = relationship("SalesOrderItem", back_populates="sales_order", cascade="all, delete-orphan")

class SalesOrderItem(Base, TimestampMixin):
    __tablename__ = "sales_order_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("sales_orders.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(default=1.0)
    delivered_qty: Mapped[float] = mapped_column(default=0.0)
    rate: Mapped[float] = mapped_column(Money, default=0.0)
    amount: Mapped[float] = mapped_column(Money, default=0.0)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("warehouses.id"))
    sales_order = relationship("SalesOrder", back_populates="items")

class DeliveryNote(Base, TimestampMixin, AuditMixin):
    __tablename__ = "delivery_notes"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("customers.id"))
    sales_order_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("sales_orders.id"))
    series: Mapped[str] = mapped_column(String(50), default="DN-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    total_qty: Mapped[float] = mapped_column(default=0.0)
    items = relationship("DeliveryNoteItem", back_populates="delivery_note", cascade="all, delete-orphan")

class DeliveryNoteItem(Base, TimestampMixin):
    __tablename__ = "delivery_note_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    delivery_note_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("delivery_notes.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(default=1.0)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("warehouses.id"))
    delivery_note = relationship("DeliveryNote", back_populates="items")

class SalesInvoice(Base, TimestampMixin, AuditMixin):
    __tablename__ = "sales_invoices"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    customer_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("customers.id"))
    sales_order_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("sales_orders.id"))
    delivery_note_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("delivery_notes.id"))
    series: Mapped[str] = mapped_column(String(50), default="SINV-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="Draft")  # Draft/Submitted/Paid/Overdue/Cancelled
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Money, default=0.0)
    grand_total: Mapped[float] = mapped_column(Money, default=0.0)
    paid_amount: Mapped[float] = mapped_column(Money, default=0.0)
    outstanding_amount: Mapped[float] = mapped_column(Money, default=0.0)
    is_return: Mapped[bool] = mapped_column(default=False)
    items = relationship("SalesInvoiceItem", back_populates="sales_invoice", cascade="all, delete-orphan")

class SalesInvoiceItem(Base, TimestampMixin):
    __tablename__ = "sales_invoice_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    sales_invoice_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("sales_invoices.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(default=1.0)
    rate: Mapped[float] = mapped_column(Money, default=0.0)
    amount: Mapped[float] = mapped_column(Money, default=0.0)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("warehouses.id"))
    cost_center: Mapped[str | None] = mapped_column(String(100))
    sales_invoice = relationship("SalesInvoice", back_populates="items")

class Payment(Base, TimestampMixin, AuditMixin):
    __tablename__ = "payments"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    party_type: Mapped[str] = mapped_column(String(50))  # Customer/Supplier
    party_id: Mapped[uuid.UUID] = mapped_column(GUID)
    payment_type: Mapped[str] = mapped_column(String(20))  # Receive/Pay
    mode_of_payment: Mapped[str | None] = mapped_column(String(50))
    amount: Mapped[float] = mapped_column(Money, default=0.0)
    reference_no: Mapped[str | None] = mapped_column(String(100))
    reference_date: Mapped[date | None] = mapped_column(Date)
    allocated_to: Mapped[dict | None] = mapped_column(Text, default="{}")
