#!/usr/bin/env python3
"""
Migrate from SQLite to Azure PostgreSQL.
1. Creates all tables in Postgres
2. Seeds Chart of Accounts from Frappe/ERPNext
3. Creates default subsidiary + fiscal year
4. Migrates all existing SQLite data
"""

import asyncio
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, text

from backend.app.core.database import Base
from backend.app.models import erp  # noqa: F401
from backend.app.models.enquiry import Enquiry, Document, AuditLog  # noqa: F401
from backend.app.models.ai import Persona, AIConversation, AIMessage, ChannelConnector, UIDashboard  # noqa: F401
from backend.app.models.document import UploadedDocument  # noqa: F401
from backend.app.models.notebook import Notebook  # noqa: F401
from backend.app.models.workflow import Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, NodeExecution  # noqa: F401

SQLITE_URL = "sqlite+aiosqlite:///./aries.db"
POSTGRES_URL = "postgresql+asyncpg://postgres:Arieserp1!@aries-erp-ai.postgres.database.azure.com:5432/postgres"


async def create_tables():
    """Drop and recreate all tables in Postgres."""
    print("\n" + "="*60)
    print("Creating tables in Azure PostgreSQL...")
    print("="*60)
    engine = create_async_engine(POSTGRES_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("✅ All tables created")


async def seed_coa(pg_session: AsyncSession):
    """Seed Chart of Accounts from Frappe extract."""
    print("\n" + "="*60)
    print("Seeding Chart of Accounts from Frappe...")
    print("="*60)

    with open("/tmp/coa_data.json") as f:
        accounts = json.load(f)

    type_map = {
        "Receivable": erp.AccountType.RECEIVABLE,
        "Payable": erp.AccountType.PAYABLE,
        "Bank": erp.AccountType.ASSET,
        "Cash": erp.AccountType.ASSET,
        "Tax": erp.AccountType.LIABILITY,
        "Income Account": erp.AccountType.INCOME,
        "Cost of Goods Sold": erp.AccountType.EXPENSE,
        "Stock Adjustment": erp.AccountType.EXPENSE,
        "Expenses Included In Valuation": erp.AccountType.EXPENSE,
        "Depreciation": erp.AccountType.EXPENSE,
        "Accumulated Depreciation": erp.AccountType.ASSET,
        "Fixed Asset": erp.AccountType.ASSET,
        "Stock": erp.AccountType.ASSET,
        "Stock Received But Not Billed": erp.AccountType.LIABILITY,
        "Equity": erp.AccountType.EQUITY,
    }

    for a in accounts:
        atype = a.get("account_type", "")
        mapped_type = type_map.get(atype)

        account = erp.Account(
            name=a["account_name"],
            account_number=a.get("account_number") or None,
            account_type=mapped_type,
            root_type=a.get("root_type"),
            report_type=a.get("report_type"),
            parent_account=a.get("parent_account"),
            is_group=a.get("is_group", False),
            company=a.get("company", "Aries Marine"),
            account_currency=a.get("account_currency") or "AED",
            tax_rate=a.get("tax_rate", 0),
            balance_must_be=a.get("balance_must_be") or None,
            balance=0.0,
            lft=a.get("lft", 0),
            rgt=a.get("rgt", 0),
        )
        pg_session.add(account)

    await pg_session.commit()
    print(f"✅ Seeded {len(accounts)} accounts")


async def create_defaults(pg_session: AsyncSession):
    """Create default subsidiary and fiscal year."""
    print("\n" + "="*60)
    print("Creating default subsidiary + fiscal year...")
    print("="*60)

    sub = erp.Subsidiary(
        name="Aries Marine",
        abbr="ariesmar",
        default_currency="AED",
        country="United Arab Emirates",
        default_receivable_account="Trade Receivable",
        default_payable_account="Trade Payable",
        default_income_account="Sales Account",
        default_expense_account="Cost of Goods Sold in Trading",
        default_bank_account="Banks Current Accounts",
        default_cash_account="Petty Cash - Others",
        cost_center="Main",
    )
    pg_session.add(sub)
    await pg_session.flush()

    fy = erp.FiscalYear(
        year="2025-2026",
        year_start_date=datetime(2025, 12, 1),
        year_end_date=datetime(2026, 11, 30),
        disabled=False,
        is_short_year=False,
    )
    pg_session.add(fy)
    await pg_session.commit()
    print("✅ Created subsidiary: Aries Marine")
    print("✅ Created fiscal year: 2025-2026")


async def migrate_table(sqlite_session: AsyncSession, pg_session: AsyncSession, model_class):
    """Migrate a single table from SQLite to Postgres."""
    from sqlalchemy.orm import make_transient
    table_name = model_class.__tablename__
    try:
        result = await sqlite_session.execute(select(model_class))
        rows = result.scalars().all()

        if not rows:
            print(f"  ⏭️  {table_name}: empty")
            return 0

        count = 0
        for row in rows:
            # Detach from SQLite session and add to Postgres
            make_transient(row)
            pg_session.add(row)
            count += 1
            if count % 100 == 0:
                await pg_session.flush()

        await pg_session.commit()
        print(f"  ✅ {table_name}: {count} rows migrated")
        return count

    except Exception as e:
        await pg_session.rollback()
        print(f"  ❌ {table_name}: {e}")
        return 0


async def migrate_all_data():
    """Migrate all SQLite data to Postgres."""
    print("\n" + "="*60)
    print("Migrating data from SQLite...")
    print("="*60)

    sqlite_engine = create_async_engine(SQLITE_URL, echo=False)
    pg_engine = create_async_engine(POSTGRES_URL, echo=False)

    SQLiteSession = sessionmaker(sqlite_engine, class_=AsyncSession, expire_on_commit=False)
    PostgresSession = sessionmaker(pg_engine, class_=AsyncSession, expire_on_commit=False)

    # Order matters for FK constraints — parents before children
    models_ordered = [
        # No FK dependencies first
        erp.Subsidiary, erp.FiscalYear, erp.CostCenter,
        erp.Account, erp.TaxCategory,
        erp.Customer, erp.Supplier, erp.Item, erp.Warehouse,
        Enquiry,
        Persona, ChannelConnector, UIDashboard,
        Notebook, Workflow,
        # Second level (FK to above)
        erp.Project,  # FK: enquiries
        erp.Personnel,
        Document,  # FK: enquiries
        UploadedDocument,
        AIConversation,  # FK: ai_personas
        WorkflowNode, WorkflowEdge,  # FK: workflows
        # Third level
        erp.Asset,  # FK: warehouses, projects, personnel
        erp.Task, erp.Timesheet, erp.ProjectAssignment,  # FK: projects, personnel
        erp.Certification,  # FK: personnel
        erp.PurchaseOrder,  # FK: suppliers, projects
        erp.Quotation,  # FK: enquiries, customers
        erp.StockEntry,  # FK: items, warehouses
        erp.SalesInvoice,  # FK: enquiries
        AIMessage,  # FK: ai_conversations
        WorkflowExecution,  # FK: workflows, enquiries
        AuditLog,  # FK: enquiries
        # Fourth level
        erp.MaintenanceRecord,  # FK: assets
        erp.POItem,  # FK: purchase_orders
        erp.MaterialRequest,  # FK: projects
        erp.Bin,  # FK: items, warehouses
        erp.QuotationItem,  # FK: quotations
        erp.SalesOrder,  # FK: quotations, customers
        erp.InvoiceItem,  # FK: sales_invoices
        erp.PaymentEntry,  # FK: sales_invoices
        erp.JournalEntry,  # FK: subsidiaries
        NodeExecution,  # FK: workflow_executions
        # Fifth level
        erp.SalesOrderItem,  # FK: sales_orders
        erp.JournalEntryLine,  # FK: journal_entries, accounts, projects
        erp.GLEntry,  # FK: accounts, projects, subsidiaries
    ]

    async with SQLiteSession() as sqlite_session:
        async with PostgresSession() as pg_session:
            total = 0
            for model in models_ordered:
                total += await migrate_table(sqlite_session, pg_session, model)

    await sqlite_engine.dispose()
    await pg_engine.dispose()
    print(f"\n✅ Total rows migrated: {total}")


async def main():
    print("=" * 60)
    print("Aries ERP: SQLite → Azure PostgreSQL Migration")
    print("=" * 60)

    # Step 1: Create tables
    await create_tables()

    # Step 2: Seed CoA and defaults
    pg_engine = create_async_engine(POSTGRES_URL, echo=False)
    PostgresSession = sessionmaker(pg_engine, class_=AsyncSession, expire_on_commit=False)

    async with PostgresSession() as pg_session:
        await seed_coa(pg_session)
        await create_defaults(pg_session)

    await pg_engine.dispose()

    # Step 3: Migrate existing data
    await migrate_all_data()

    print("\n" + "="*60)
    print("🎉 ALL DONE! Backend is now on Azure PostgreSQL.")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
