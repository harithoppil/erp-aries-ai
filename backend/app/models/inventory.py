"""Inventory: Items, Stock Ledger, Transfers, Reconciliations."""
import uuid
from datetime import date
from sqlalchemy import ForeignKey, String, Date, Text
from sqlalchemy.orm import Mapped, mapped_column
from backend.app.core.database import Base, GUID, Money, TimestampMixin, AuditMixin

class Item(Base, TimestampMixin, AuditMixin):
    __tablename__ = "items"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    item_code: Mapped[str] = mapped_column(String(100), nullable=False)
    item_name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    item_group: Mapped[str | None] = mapped_column(String(100))
    is_stock_item: Mapped[bool] = mapped_column(default=True)
    default_warehouse_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("warehouses.id"))
    stock_uom: Mapped[str] = mapped_column(String(50), default="Nos")
    min_order_qty: Mapped[float] = mapped_column(default=0.0)
    valuation_method: Mapped[str] = mapped_column(String(20), default="FIFO")

class ItemGroup(Base, TimestampMixin, AuditMixin):
    __tablename__ = "item_groups"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(GUID, ForeignKey("item_groups.id"))
    is_group: Mapped[bool] = mapped_column(default=False)

class StockLedgerEntry(Base, TimestampMixin):
    """Immutable stock transaction record."""
    __tablename__ = "stock_ledger_entries"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    item_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("items.id"))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("warehouses.id"))
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    voucher_type: Mapped[str] = mapped_column(String(100), nullable=False)
    voucher_id: Mapped[uuid.UUID] = mapped_column(GUID, nullable=False)
    qty_change: Mapped[float] = mapped_column(default=0.0)
    rate: Mapped[float] = mapped_column(Money, default=0.0)
    valuation_rate: Mapped[float] = mapped_column(Money, default=0.0)
    qty_after_transaction: Mapped[float] = mapped_column(default=0.0)
    balance_value: Mapped[float] = mapped_column(Money, default=0.0)

class StockTransfer(Base, TimestampMixin, AuditMixin):
    __tablename__ = "stock_transfers"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    from_warehouse_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("warehouses.id"))
    to_warehouse_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("warehouses.id"))
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="Draft")
    total_qty: Mapped[float] = mapped_column(default=0.0)

class StockReconciliation(Base, TimestampMixin, AuditMixin):
    __tablename__ = "stock_reconciliations"
    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("companies.id"))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(GUID, ForeignKey("warehouses.id"))
    posting_date: Mapped[date] = mapped_column(Date, nullable=False)
    purpose: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="Draft")
