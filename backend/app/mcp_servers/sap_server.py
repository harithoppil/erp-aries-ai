"""SAP MCP Server — read-only ERP query tools.

All tools are read-only: they query the live database and return formatted
string results. No mutations, no stubs, no hardcoded data.
"""

import uuid
import json
import logging

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.database import async_session
from backend.app.models.sales import Customer, SalesInvoice, SalesOrder
from backend.app.models.purchasing import Supplier, PurchaseOrder, PurchaseInvoice
from backend.app.models.inventory import Item, StockLedgerEntry
from backend.app.models.marine import Vessel, CharterContract
from backend.app.models.hr import Employee
from backend.app.models.projects import Project
from backend.app.models.accounting import Account, GeneralLedgerEntry
from backend.app.models.assets import FixedAsset

logger = logging.getLogger("aries.mcp.sap")


def _serialize(obj) -> dict:
    """Serialize a SQLAlchemy row to a dict."""
    from datetime import date, datetime
    result = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        if val is None:
            result[col.name] = None
        elif isinstance(val, (datetime, date)):
            result[col.name] = val.isoformat()
        elif isinstance(val, uuid.UUID):
            result[col.name] = str(val)
        else:
            result[col.name] = val
    return result


async def sap_material_master(query: str = "", company_id: str = "", limit: int = 20) -> str:
    """Search SAP material master (read-only) — returns items matching query."""
    async with async_session() as db:
        q = select(Item).where(Item.is_active == True)
        if company_id:
            q = q.where(Item.company_id == uuid.UUID(company_id))
        if query:
            q = q.where(
                (Item.item_name.ilike(f"%{query}%")) | (Item.item_code.ilike(f"%{query}%"))
            )
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Material Master: {len(data)} items found:\n" + json.dumps(data, indent=2, default=str)


async def sap_stock(sku: str = "", company_id: str = "") -> str:
    """Check SAP stock for a SKU (read-only) — returns stock ledger summary."""
    async with async_session() as db:
        if sku:
            item = (await db.execute(select(Item).where(Item.item_code == sku, Item.is_active == True))).scalar_one_or_none()
            if not item:
                return f"SKU '{sku}' not found in material master."
            item_id = item.id
            q = select(
                StockLedgerEntry.warehouse_id,
                func.sum(StockLedgerEntry.qty_change).label("qty"),
                func.max(StockLedgerEntry.valuation_rate).label("rate"),
            ).where(StockLedgerEntry.item_id == item_id)
            if company_id:
                q = q.where(StockLedgerEntry.company_id == uuid.UUID(company_id))
            rows = (await db.execute(q.group_by(StockLedgerEntry.warehouse_id))).all()
            data = [
                {"warehouse_id": str(r.warehouse_id), "qty": float(r.qty or 0), "rate": float(r.rate or 0)}
                for r in rows
            ]
            return f"Stock for SKU '{sku}' ({item.item_name}):\n" + json.dumps(data, indent=2, default=str)
        else:
            if not company_id:
                return "Please provide either a SKU or a company_id."
            q = select(
                StockLedgerEntry.item_id,
                StockLedgerEntry.warehouse_id,
                func.sum(StockLedgerEntry.qty_change).label("qty"),
                func.max(StockLedgerEntry.valuation_rate).label("rate"),
            ).where(StockLedgerEntry.company_id == uuid.UUID(company_id)).group_by(
                StockLedgerEntry.item_id, StockLedgerEntry.warehouse_id
            )
            rows = (await db.execute(q)).all()
            data = [
                {"item_id": str(r.item_id), "warehouse_id": str(r.warehouse_id), "qty": float(r.qty or 0), "rate": float(r.rate or 0)}
                for r in rows
            ]
            return f"SAP Stock overview: {len(data)} item/warehouse combinations:\n" + json.dumps(data, indent=2, default=str)


async def sap_customer_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only list of customers."""
    async with async_session() as db:
        q = select(Customer).where(Customer.is_active == True)
        if company_id:
            q = q.where(Customer.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Customer List ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_invoice_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only list of sales invoices."""
    async with async_session() as db:
        q = select(SalesInvoice).where(SalesInvoice.is_active == True)
        if company_id:
            q = q.where(SalesInvoice.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(SalesInvoice.date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Invoice List ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_purchase_order_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only list of purchase orders."""
    async with async_session() as db:
        q = select(PurchaseOrder).where(PurchaseOrder.is_active == True)
        if company_id:
            q = q.where(PurchaseOrder.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(PurchaseOrder.date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Purchase Order List ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_project_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only list of projects."""
    async with async_session() as db:
        q = select(Project).where(Project.is_active == True)
        if company_id:
            q = q.where(Project.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Project List ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_vessel_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only list of vessels."""
    async with async_session() as db:
        q = select(Vessel).where(Vessel.is_active == True)
        if company_id:
            q = q.where(Vessel.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Vessel List ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_employee_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only list of employees."""
    async with async_session() as db:
        q = select(Employee).where(Employee.is_active == True)
        if company_id:
            q = q.where(Employee.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Employee List ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_account_list(company_id: str = "", limit: int = 50) -> str:
    """Read-only chart of accounts."""
    async with async_session() as db:
        q = select(Account).where(Account.is_active == True)
        if company_id:
            q = q.where(Account.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(Account.code).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Chart of Accounts ({len(data)}):\n" + json.dumps(data, indent=2, default=str)


async def sap_general_ledger(company_id: str = "", limit: int = 50) -> str:
    """Read-only general ledger entries."""
    async with async_session() as db:
        q = select(GeneralLedgerEntry)
        if company_id:
            q = q.where(GeneralLedgerEntry.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.order_by(GeneralLedgerEntry.posting_date.desc()).limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP General Ledger ({len(data)} entries):\n" + json.dumps(data, indent=2, default=str)


async def sap_asset_list(company_id: str = "", limit: int = 20) -> str:
    """Read-only fixed assets list."""
    async with async_session() as db:
        q = select(FixedAsset).where(FixedAsset.is_active == True)
        if company_id:
            q = q.where(FixedAsset.company_id == uuid.UUID(company_id))
        rows = (await db.execute(q.limit(limit))).scalars().all()
        data = [_serialize(r) for r in rows]
        return f"SAP Fixed Assets ({len(data)}):\n" + json.dumps(data, indent=2, default=str)
