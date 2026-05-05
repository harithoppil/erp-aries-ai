"""Purchasing: Suppliers, POs, Receipts, Invoices."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Text, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Supplier(Base, TimestampMixin, AuditMixin):
    __tablename__ = "suppliers"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    tax_id: Mapped[str | None] = mapped_column(String(100))
    address: Mapped[dict | None] = mapped_column(Text, default="{}")

class PurchaseOrder(Base, TimestampMixin, AuditMixin):
    __tablename__ = "purchase_orders"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("suppliers.id"))
    series: Mapped[str] = mapped_column(String(50), default="PO-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    required_by_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    total_qty: Mapped[float] = mapped_column(default=0.0)
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Money, default=0.0)
    grand_total: Mapped[float] = mapped_column(Money, default=0.0)
    per_received: Mapped[float] = mapped_column(default=0.0)
    per_billed: Mapped[float] = mapped_column(default=0.0)
    items: Mapped[list["PurchaseOrderItem"]] = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")

class PurchaseOrderItem(Base, TimestampMixin):
    __tablename__ = "purchase_order_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("purchase_orders.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(default=1.0)
    received_qty: Mapped[float] = mapped_column(default=0.0)
    rate: Mapped[float] = mapped_column(Money, default=0.0)
    amount: Mapped[float] = mapped_column(Money, default=0.0)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")

class PurchaseReceipt(Base, TimestampMixin, AuditMixin):
    __tablename__ = "purchase_receipts"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("suppliers.id"))
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("purchase_orders.id"))
    series: Mapped[str] = mapped_column(String(50), default="PRE-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    total_qty: Mapped[float] = mapped_column(default=0.0)
    items: Mapped[list["PurchaseReceiptItem"]] = relationship("PurchaseReceiptItem", back_populates="purchase_receipt", cascade="all, delete-orphan")

class PurchaseReceiptItem(Base, TimestampMixin):
    __tablename__ = "purchase_receipt_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    purchase_receipt_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("purchase_receipts.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(default=1.0)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    accepted_qty: Mapped[float] = mapped_column(default=0.0)
    rejected_qty: Mapped[float] = mapped_column(default=0.0)
    purchase_receipt: Mapped["PurchaseReceipt"] = relationship("PurchaseReceipt", back_populates="items")

class PurchaseInvoice(Base, TimestampMixin, AuditMixin):
    __tablename__ = "purchase_invoices"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("companies.id"))
    supplier_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("suppliers.id"))
    purchase_order_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("purchase_orders.id"))
    purchase_receipt_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("purchase_receipts.id"))
    series: Mapped[str] = mapped_column(String(50), default="PINV-####")
    date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    total_amount: Mapped[float] = mapped_column(Money, default=0.0)
    tax_amount: Mapped[float] = mapped_column(Money, default=0.0)
    grand_total: Mapped[float] = mapped_column(Money, default=0.0)
    paid_amount: Mapped[float] = mapped_column(Money, default=0.0)
    outstanding_amount: Mapped[float] = mapped_column(Money, default=0.0)
    items: Mapped[list["PurchaseInvoiceItem"]] = relationship("PurchaseInvoiceItem", back_populates="purchase_invoice", cascade="all, delete-orphan")

class PurchaseInvoiceItem(Base, TimestampMixin):
    __tablename__ = "purchase_invoice_items"
    id: Mapped[uuid.UUID] = mapped_column(GUID(), primary_key=True, default=uuid.uuid4)
    purchase_invoice_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("purchase_invoices.id"))
    item_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(default=1.0)
    rate: Mapped[float] = mapped_column(Money, default=0.0)
    amount: Mapped[float] = mapped_column(Money, default=0.0)
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID(), ForeignKey("warehouses.id"))
    purchase_invoice: Mapped["PurchaseInvoice"] = relationship("PurchaseInvoice", back_populates="items")
