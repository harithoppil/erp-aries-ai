#!/usr/bin/env python3
"""
Seed realistic Aries Marine data into Azure PostgreSQL.
Covers all empty tables with domain-realistic values.
"""

import asyncio
import os
import sys
import uuid
from datetime import datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from backend.app.models import erp
from backend.app.models.enquiry import Enquiry, AuditLog
from backend.app.models.ai import Persona, ChannelConnector, UIDashboard
from backend.app.models.notebook import Notebook
from backend.app.models.workflow import Workflow, WorkflowNode, WorkflowEdge, WorkflowExecution, NodeExecution

# Alias for convenience
EnquiryModel = Enquiry

POSTGRES_URL = "postgresql+asyncpg://postgres:Arieserp1!@aries-erp-ai.postgres.database.azure.com:5432/postgres"

engine = create_async_engine(POSTGRES_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed_tax_categories(session: AsyncSession):
    r = await session.execute(select(erp.TaxCategory))
    if r.scalars().first():
        print("Seeding tax_categories... ⏭️  already has data")
        return
    print("Seeding tax_categories...")
    cats = [
        erp.TaxCategory(name="UAE VAT 5%", rate=5.0, description="Standard UAE VAT"),
        erp.TaxCategory(name="UAE VAT 0%", rate=0.0, description="Zero-rated VAT"),
        erp.TaxCategory(name="UAE VAT Exempt", rate=0.0, description="VAT Exempt"),
        erp.TaxCategory(name="Withholding Tax 5%", rate=5.0, description="WHT on contractor payments"),
    ]
    for c in cats:
        session.add(c)
    await session.commit()
    print(f"  ✅ {len(cats)} tax categories")


async def seed_items(session: AsyncSession):
    r = await session.execute(select(erp.Item))
    if r.scalars().first():
        print("Seeding items... ⏭️  already has data")
        return
    print("Seeding items...")
    items = [
        erp.Item(item_code="SKU-UT-001", item_name="Ultrasonic Thickness Gauge - Cygnus 4+", item_group=erp.ItemGroup.EQUIPMENT, unit="Nos", standard_rate=18500.0, safety_stock=2),
        erp.Item(item_code="SKU-PAUT-001", item_name="Phased Array UT Probe - 5MHz 64elem", item_group=erp.ItemGroup.EQUIPMENT, unit="Nos", standard_rate=42000.0, safety_stock=1),
        erp.Item(item_code="SKU-ROPE-001", item_name="IRATA Rope Access Kit - Full Set", item_group=erp.ItemGroup.EQUIPMENT, unit="Set", standard_rate=8500.0, safety_stock=5),
        erp.Item(item_code="SKU-ROV-001", item_name="ROV Tether Cable 500m", item_group=erp.ItemGroup.SPARE_PART, unit="Nos", standard_rate=12500.0, safety_stock=3),
        erp.Item(item_code="SKU-ROV-002", item_name="Hydraulic Pump Assembly - Triton XL", item_group=erp.ItemGroup.SPARE_PART, unit="Nos", standard_rate=28000.0, safety_stock=2),
        erp.Item(item_code="SKU-CPLG-001", item_name="Cathodic Protection Probe", item_group=erp.ItemGroup.CONSUMABLE, unit="Nos", standard_rate=3500.0, safety_stock=10),
        erp.Item(item_code="SKU-FILM-001", item_name="Radiographic Film AGFA D7", item_group=erp.ItemGroup.CONSUMABLE, unit="Box", standard_rate=1200.0, safety_stock=20),
        erp.Item(item_code="SKU-CHEM-001", item_name="Penetrant Testing Kit - Solvent Removable", item_group=erp.ItemGroup.CONSUMABLE, unit="Kit", standard_rate=850.0, safety_stock=15),
        erp.Item(item_code="SKU-SVC-001", item_name="Offshore NDT Inspection - Per Day Rate", item_group=erp.ItemGroup.SERVICE, unit="Day", standard_rate=4500.0),
        erp.Item(item_code="SKU-SVC-002", item_name="ROV Pipeline Inspection - Per KM", item_group=erp.ItemGroup.SERVICE, unit="KM", standard_rate=85000.0),
        erp.Item(item_code="SKU-SVC-003", item_name="Naval Architecture Consultancy - Per Hour", item_group=erp.ItemGroup.SERVICE, unit="Hour", standard_rate=650.0),
    ]
    for i in items:
        session.add(i)
    await session.commit()
    print(f"  ✅ {len(items)} items")


async def seed_bins(session: AsyncSession):
    r = await session.execute(select(erp.Bin))
    if r.scalars().first():
        print("Seeding bins... ⏭️  already has data")
        return
    print("Seeding bins...")
    # Get items and warehouses
    r = await session.execute(select(erp.Item))
    items = r.scalars().all()
    r = await session.execute(select(erp.Warehouse))
    warehouses = r.scalars().all()

    bins = []
    wh_map = {w.warehouse_code: w for w in warehouses}
    item_map = {i.item_code: i for i in items}

    stock_data = [
        ("SKU-UT-001", "JEB-01", 12, 18500),
        ("SKU-UT-001", "MUS-01", 5, 18500),
        ("SKU-PAUT-001", "JEB-01", 3, 42000),
        ("SKU-ROPE-001", "JEB-01", 18, 8500),
        ("SKU-ROPE-001", "DAS-01", 8, 8500),
        ("SKU-ROV-001", "JEB-01", 6, 12500),
        ("SKU-ROV-002", "JEB-01", 2, 28000),
        ("SKU-CPLG-001", "JEB-01", 25, 3500),
        ("SKU-FILM-001", "JEB-01", 40, 1200),
        ("SKU-CHEM-001", "MUS-01", 22, 850),
    ]

    for code, wh_code, qty, rate in stock_data:
        item = item_map.get(code)
        wh = wh_map.get(wh_code)
        if item and wh:
            bins.append(erp.Bin(
                item_id=item.id,
                warehouse_id=wh.id,
                quantity=qty,
                valuation_rate=rate,
                stock_value=qty * rate,
            ))

    for b in bins:
        session.add(b)
    await session.commit()
    print(f"  ✅ {len(bins)} bins")


async def seed_cost_centers(session: AsyncSession):
    r = await session.execute(select(erp.CostCenter))
    if r.scalars().first():
        print("Seeding cost_centers... ⏭️  already has data")
        return
    print("Seeding cost_centers...")
    cc = [
        erp.CostCenter(name="Main", cost_center_number="CC-001", is_group=True, lft=1, rgt=8),
        erp.CostCenter(name="Operations", cost_center_number="CC-002", parent_cost_center="Main", lft=2, rgt=3),
        erp.CostCenter(name="Engineering", cost_center_number="CC-003", parent_cost_center="Main", lft=4, rgt=5),
        erp.CostCenter(name="Projects", cost_center_number="CC-004", parent_cost_center="Main", lft=6, rgt=7),
    ]
    for c in cc:
        session.add(c)
    await session.commit()
    print(f"  ✅ {len(cc)} cost centers")


async def seed_purchase_orders(session: AsyncSession):
    r = await session.execute(select(erp.PurchaseOrder))
    if r.scalars().first():
        print("Seeding purchase_orders + po_items... ⏭️  already has data")
        return
    print("Seeding purchase_orders + po_items...")
    r = await session.execute(select(erp.Supplier).limit(5))
    suppliers = r.scalars().all()
    r = await session.execute(select(erp.Project).limit(3))
    projects = r.scalars().all()
    r = await session.execute(select(erp.Item))
    items = r.scalars().all()

    po_data = [
        ("PO-2025-003", suppliers[0].id if suppliers else None, projects[0].id if projects else None,
         "Oceaneering International", [
             (items[0].id if items else None, "Ultrasonic Thickness Gauge", 2, 18500),
             (items[2].id if len(items) > 2 else None, "IRATA Rope Access Kit", 5, 8500),
         ]),
        ("PO-2025-004", suppliers[1].id if len(suppliers) > 1 else None, projects[1].id if len(projects) > 1 else None,
         "Trelleborg Marine Systems", [
             (items[4].id if len(items) > 4 else None, "Hydraulic Pump Assembly", 1, 28000),
         ]),
    ]

    for po_num, sup_id, proj_id, sup_name, lines in po_data:
        subtotal = sum(qty * rate for _, _, qty, rate in lines)
        tax = subtotal * 0.05
        po = erp.PurchaseOrder(
            po_number=po_num,
            supplier_id=sup_id,
            project_id=proj_id,
            status=erp.POStatus.APPROVED,
            subtotal=subtotal,
            tax_amount=tax,
            total=subtotal + tax,
            currency="AED",
        )
        session.add(po)
        await session.flush()

        for item_id, desc, qty, rate in lines:
            if item_id:
                session.add(erp.POItem(
                    po_id=po.id,
                    item_code=desc,
                    description=desc,
                    quantity=qty,
                    rate=rate,
                    amount=qty * rate,
                ))
    await session.commit()
    print(f"  ✅ 2 purchase orders with items")


async def seed_sales_invoices(session: AsyncSession):
    r = await session.execute(select(erp.SalesInvoice))
    if r.scalars().first():
        print("Seeding sales_invoices + invoice_items... ⏭️  already has data")
        return
    print("Seeding sales_invoices + invoice_items...")
    r = await session.execute(select(erp.Customer))
    customers = r.scalars().all()
    r = await session.execute(select(EnquiryModel))
    enquiries = r.scalars().all()

    inv_data = [
        ("INV-2025-003", enquiries[0].id if enquiries else None, "ADNOC Offshore", 285000, [
            ("ROV Pipeline Inspection - 3km", 1, 255000),
            ("CP Survey - Cathodic Protection", 1, 30000),
        ]),
        ("INV-2025-004", enquiries[1].id if len(enquiries) > 1 else None, "ZADCO", 180000, [
            ("Platform Structural Inspection", 1, 180000),
        ]),
        ("INV-2025-005", None, "GASCO", 95000, [
            ("NGL Train PAUT Inspection", 1, 95000),
        ]),
    ]

    for inv_num, enq_id, client, subtotal, lines in inv_data:
        tax = subtotal * 0.05
        inv = erp.SalesInvoice(
            invoice_number=inv_num,
            enquiry_id=enq_id,
            customer_name=client,
            status=erp.SalesInvoiceStatus.SUBMITTED,
            subtotal=subtotal,
            tax_rate=5.0,
            tax_amount=tax,
            total=subtotal + tax,
            paid_amount=0,
            outstanding_amount=subtotal + tax,
            currency="AED",
        )
        session.add(inv)
        await session.flush()

        for desc, qty, rate in lines:
            session.add(erp.InvoiceItem(
                invoice_id=inv.id,
                description=desc,
                quantity=qty,
                rate=rate,
                amount=qty * rate,
            ))
    await session.commit()
    print(f"  ✅ 3 sales invoices with items")


async def seed_payment_entries(session: AsyncSession):
    r = await session.execute(select(erp.PaymentEntry))
    if r.scalars().first():
        print("Seeding payment_entries... ⏭️  already has data")
        return
    print("Seeding payment_entries...")
    r = await session.execute(select(erp.SalesInvoice))
    invoices = r.scalars().all()

    payments = [
        erp.PaymentEntry(
            payment_type="receive",
            party_type="customer",
            party_name="ADNOC Offshore",
            amount=450000,
            currency="AED",
            reference_number="ADNOC/EFT/2026/0410",
        ),
        erp.PaymentEntry(
            payment_type="receive",
            party_type="customer",
            party_name="ZADCO",
            amount=140000,
            currency="AED",
            reference_number="CHQ-789456",
        ),
        erp.PaymentEntry(
            payment_type="pay",
            party_type="supplier",
            party_name="Oceaneering International",
            amount=125000,
            currency="AED",
            reference_number="PO-2025-001/PAY",
        ),
    ]
    for p in payments:
        session.add(p)
    await session.commit()
    print(f"  ✅ {len(payments)} payment entries")


async def seed_journal_entries(session: AsyncSession):
    r = await session.execute(select(erp.JournalEntry))
    if r.scalars().first():
        print("Seeding journal_entries + journal_entry_lines... ⏭️  already has data")
        return
    print("Seeding journal_entries + journal_entry_lines...")
    r = await session.execute(select(erp.Account).where(erp.Account.name.in_([
        "Trade Receivable", "Sales Account", "VAT 5%", "Bank Charges",
        "Basic Salary", "Accrued - Salaries", "Petty Cash - Others"
    ])))
    accts = {a.name: a for a in r.scalars().all()}

    # JE 1: Sales invoice posting
    je1 = erp.JournalEntry(
        entry_number="JV-2025-001",
        reference="Sales Invoice INV-2025-003",
        total_debit=299250,
        total_credit=299250,
        status="submitted",
        notes="Sales invoice posting for ADNOC ROV inspection",
    )
    session.add(je1)
    await session.flush()

    lines1 = [
        erp.JournalEntryLine(journal_entry_id=je1.id, account_id=accts.get("Trade Receivable").id if accts.get("Trade Receivable") else None, debit=299250, credit=0),
        erp.JournalEntryLine(journal_entry_id=je1.id, account_id=accts.get("Sales Account").id if accts.get("Sales Account") else None, debit=0, credit=285000),
        erp.JournalEntryLine(journal_entry_id=je1.id, account_id=accts.get("VAT 5%").id if accts.get("VAT 5%") else None, debit=0, credit=14250),
    ]
    for l in lines1:
        session.add(l)

    # JE 2: Salary accrual
    je2 = erp.JournalEntry(
        entry_number="JV-2025-002",
        reference="Monthly Salary Accrual - May 2026",
        total_debit=420000,
        total_credit=420000,
        status="submitted",
        notes="Salary accrual for offshore personnel",
    )
    session.add(je2)
    await session.flush()

    lines2 = [
        erp.JournalEntryLine(journal_entry_id=je2.id, account_id=accts.get("Basic Salary").id if accts.get("Basic Salary") else None, debit=420000, credit=0),
        erp.JournalEntryLine(journal_entry_id=je2.id, account_id=accts.get("Accrued - Salaries").id if accts.get("Accrued - Salaries") else None, debit=0, credit=420000),
    ]
    for l in lines2:
        session.add(l)

    await session.commit()
    print(f"  ✅ 2 journal entries with lines")


async def seed_gl_entries(session: AsyncSession):
    r = await session.execute(select(erp.GLEntry))
    if r.scalars().first():
        print("Seeding gl_entries... ⏭️  already has data")
        return
    print("Seeding gl_entries...")
    r = await session.execute(select(erp.Account).where(erp.Account.name.in_([
        "Trade Receivable", "Sales Account", "VAT 5%", "Bank Charges",
        "Basic Salary", "Accrued - Salaries", "Trade Payable",
        "Banks Current Accounts", "Petty Cash - Others"
    ])))
    accts = {a.name: a for a in r.scalars().all()}

    entries = [
        # Sales Invoice INV-2025-003 posting
        ("2026-04-15", accts.get("Trade Receivable"), "Customer", "ADNOC Offshore", "Sales Invoice", "INV-2025-003", 299250, 0),
        ("2026-04-15", accts.get("Sales Account"), None, None, "Sales Invoice", "INV-2025-003", 0, 285000),
        ("2026-04-15", accts.get("VAT 5%"), None, None, "Sales Invoice", "INV-2025-003", 0, 14250),
        # Payment received
        ("2026-04-20", accts.get("Banks Current Accounts"), None, None, "Payment Entry", "PAY-001", 450000, 0),
        ("2026-04-20", accts.get("Trade Receivable"), "Customer", "ADNOC Offshore", "Payment Entry", "PAY-001", 0, 450000),
        # Salary accrual
        ("2026-04-30", accts.get("Basic Salary"), None, None, "Journal Entry", "JV-2025-002", 420000, 0),
        ("2026-04-30", accts.get("Accrued - Salaries"), None, None, "Journal Entry", "JV-2025-002", 0, 420000),
        # PO received
        ("2026-04-10", accts.get("Stock in Hand"), None, None, "Purchase Invoice", "PINV-001", 125000, 0),
        ("2026-04-10", accts.get("Trade Payable"), "Supplier", "Oceaneering International", "Purchase Invoice", "PINV-001", 0, 125000),
    ]

    for date_str, acct, pt, pn, vtype, vno, dr, cr in entries:
        if acct:
            session.add(erp.GLEntry(
                posting_date=datetime.strptime(date_str, "%Y-%m-%d"),
                account_id=acct.id,
                party_type=pt,
                party_name=pn,
                voucher_type=vtype,
                voucher_no=vno,
                debit=dr,
                credit=cr,
                remarks=f"{vtype} {vno}",
            ))

    await session.commit()
    print(f"  ✅ {len(entries)} GL entries")


async def seed_stock_entries(session: AsyncSession):
    r = await session.execute(select(erp.StockEntry))
    if r.scalars().first():
        print("Seeding stock_entries... ⏭️  already has data")
        return
    print("Seeding stock_entries...")
    r = await session.execute(select(erp.Item).limit(5))
    items = r.scalars().all()
    r = await session.execute(select(erp.Warehouse))
    warehouses = r.scalars().all()

    if items and warehouses:
        entries = [
            erp.StockEntry(entry_type=erp.StockEntryType.RECEIPT, item_id=items[0].id, quantity=10, target_warehouse=warehouses[0].id, reference="GRN-001", valuation_rate=18500),
            erp.StockEntry(entry_type=erp.StockEntryType.RECEIPT, item_id=items[2].id, quantity=15, target_warehouse=warehouses[0].id, reference="GRN-002", valuation_rate=8500),
            erp.StockEntry(entry_type=erp.StockEntryType.TRANSFER, item_id=items[0].id, quantity=3, source_warehouse=warehouses[0].id, target_warehouse=warehouses[1].id if len(warehouses) > 1 else warehouses[0].id, reference="ST-001"),
        ]
        for e in entries:
            session.add(e)
        await session.commit()
        print(f"  ✅ {len(entries)} stock entries")
    else:
        print("  ⏭️  skipping (no items/warehouses)")


async def seed_material_requests(session: AsyncSession):
    r = await session.execute(select(erp.MaterialRequest))
    if r.scalars().first():
        print("Seeding material_requests... ⏭️  already has data")
        return
    print("Seeding material_requests...")
    r = await session.execute(select(erp.Project).limit(2))
    projects = r.scalars().all()

    if projects:
        mrs = [
            erp.MaterialRequest(request_number="MR-2025-001", project_id=projects[0].id, requested_by="John Smith", purpose="ROV inspection spare parts for ADNOC pipeline survey", status="approved"),
            erp.MaterialRequest(request_number="MR-2025-002", project_id=projects[1].id if len(projects) > 1 else projects[0].id, requested_by="Sarah Johnson", purpose="PAUT probes for platform structural inspection", status="fulfilled"),
        ]
        for m in mrs:
            session.add(m)
        await session.commit()
        print(f"  ✅ {len(mrs)} material requests")


async def seed_maintenance_records(session: AsyncSession):
    r = await session.execute(select(erp.MaintenanceRecord))
    if r.scalars().first():
        print("Seeding maintenance_records... ⏭️  already has data")
        return
    print("Seeding maintenance_records...")
    r = await session.execute(select(erp.Asset).limit(5))
    assets = r.scalars().all()

    if assets:
        records = [
            erp.MaintenanceRecord(asset_id=assets[0].id, maintenance_type="calibration", description="Annual calibration of Triton XL ROV system - depth sensor and navigation verification", performed_by="Oceaneering Service Center", performed_date=datetime(2026, 1, 15), next_due_date=datetime(2026, 7, 15), cost=12500),
            erp.MaintenanceRecord(asset_id=assets[1].id if len(assets) > 1 else assets[0].id, maintenance_type="inspection", description="Hydraulic system pressure test and seal replacement", performed_by="Aries Marine Workshop", performed_date=datetime(2026, 2, 20), next_due_date=datetime(2026, 8, 20), cost=8500),
        ]
        for rec in records:
            session.add(rec)
        await session.commit()
        print(f"  ✅ {len(records)} maintenance records")


async def seed_project_assignments(session: AsyncSession):
    r = await session.execute(select(erp.ProjectAssignment))
    if r.scalars().first():
        print("Seeding project_assignments... ⏭️  already has data")
        return
    print("Seeding project_assignments...")
    r = await session.execute(select(erp.Project).limit(2))
    projects = r.scalars().all()
    r = await session.execute(select(erp.Personnel).limit(10))
    personnel = r.scalars().all()

    if projects and personnel:
        assignments = [
            erp.ProjectAssignment(project_id=projects[0].id, personnel_id=personnel[0].id, role="project_manager", compliance_checked=True, compliance_passed=True),
            erp.ProjectAssignment(project_id=projects[0].id, personnel_id=personnel[1].id, role="ndt_technician", compliance_checked=True, compliance_passed=True),
            erp.ProjectAssignment(project_id=projects[0].id, personnel_id=personnel[2].id, role="rope_access_tech", compliance_checked=True, compliance_passed=False, compliance_issues="BOSIET expires in 12 days"),
        ]
        for a in assignments:
            session.add(a)
        await session.commit()
        print(f"  ✅ {len(assignments)} project assignments")


async def seed_notebooks(session: AsyncSession):
    r = await session.execute(select(Notebook))
    if r.scalars().first():
        print("Seeding notebooks... ⏭️  already has data")
        return
    print("Seeding notebooks...")
    nbs = [
        Notebook(title="Offshore Safety Procedures", content="# BOSIET Requirements\nAll personnel must hold valid BOSIET...", metadata_json='{"category":"safety","author":"James Wilson"}'),
        Notebook(title="ROV Pre-Dive Checklist", content="# Pre-Dive Checks\n1. Tether integrity\n2. Hydraulic pressure test...", metadata_json='{"category":"technical","author":"John Smith"}'),
    ]
    for n in nbs:
        session.add(n)
    await session.commit()
    print(f"  ✅ {len(nbs)} notebooks")


async def seed_channel_connectors(session: AsyncSession):
    r = await session.execute(select(ChannelConnector))
    if r.scalars().first():
        print("Seeding channel_connectors... ⏭️  already has data")
        return
    print("Seeding channel_connectors...")
    ch = [
        ChannelConnector(channel_type="email", name="Operations Email", enabled=True, config='{"server":"imap.ariesmarine.com","port":993,"ssl":true}', webhook_url="https://api.ariesmarine.com/webhooks/email"),
        ChannelConnector(channel_type="whatsapp", name="WhatsApp Business", enabled=True, config='{"phone":"+971 50 000 0001","api_version":"v18.0"}', webhook_url="https://api.ariesmarine.com/webhooks/whatsapp"),
        ChannelConnector(channel_type="slack", name="Project Alerts", enabled=False, config='{"workspace":"aries-marine","channel":"projects"}'),
    ]
    for c in ch:
        session.add(c)
    await session.commit()
    print(f"  ✅ {len(ch)} channel connectors")


async def seed_ui_dashboards(session: AsyncSession):
    r = await session.execute(select(UIDashboard))
    if r.scalars().first():
        print("Seeding ui_dashboards... ⏭️  already has data")
        return
    print("Seeding ui_dashboards...")
    dash = [
        UIDashboard(name="Executive Overview", ui_type="dashboard", schema_json='{"widgets":[{"type":"kpi","title":"Active Projects","value":4},{"type":"chart","title":"Monthly Revenue","data":[450,380,520,610]}]}', is_active=True),
        UIDashboard(name="Asset Health", ui_type="dashboard", schema_json='{"widgets":[{"type":"table","title":"Calibration Due","columns":["Asset","Date","Status"]},{"type":"alert","title":"Expiring Certifications","count":3}]}', is_active=True),
    ]
    for d in dash:
        session.add(d)
    await session.commit()
    print(f"  ✅ {len(dash)} dashboards")


async def seed_quality_inspections(session: AsyncSession):
    r = await session.execute(select(erp.QualityInspection))
    if r.scalars().first():
        print("Seeding quality_inspections... ⏭️  already has data")
        return
    print("Seeding quality_inspections...")
    qis = [
        erp.QualityInspection(inspection_type="ndt_report_review", reference="PRJ-001", status="passed", findings="All weld reports comply with ASME standards. No rejectable indications found.", inspected_by="QA Manager - Ahmed Hassan", inspection_date=datetime(2026, 4, 10)),
        erp.QualityInspection(inspection_type="equipment_check", reference="AST-001", status="corrective_action", findings="ROV depth sensor calibration drift detected. Requires re-calibration before next deployment.", corrective_action="Send to Oceaneering Service Center for calibration", inspected_by="Equipment Supervisor - James Wilson", inspection_date=datetime(2026, 4, 12)),
    ]
    for q in qis:
        session.add(q)
    await session.commit()
    print(f"  ✅ {len(qis)} quality inspections")


async def seed_workflow_executions(session: AsyncSession):
    r = await session.execute(select(WorkflowExecution))
    if r.scalars().first():
        print("Seeding workflow_executions + node_executions... ⏭️  already has data")
        return
    print("Seeding workflow_executions + node_executions...")
    r = await session.execute(select(Workflow).limit(1))
    workflows = r.scalars().all()
    r = await session.execute(select(Enquiry).limit(2))
    enquiries = r.scalars().all()

    if workflows and enquiries:
        we = WorkflowExecution(workflow_id=workflows[0].id, enquiry_id=enquiries[0].id, status="completed", current_node_key="end", started_at=datetime(2026, 4, 20, 9, 0), completed_at=datetime(2026, 4, 20, 9, 5))
        session.add(we)
        await session.flush()

        nodes = [
            NodeExecution(execution_id=we.id, node_key="trigger", status="completed", input_data='{"enquiry_id":"ENQ-001"}', output_data='{"triggered":true}', duration_ms=150, started_at=datetime(2026, 4, 20, 9, 0), completed_at=datetime(2026, 4, 20, 9, 0)),
            NodeExecution(execution_id=we.id, node_key="send_email", status="completed", input_data='{"template":"acknowledgment"}', output_data='{"sent":true}', duration_ms=3200, started_at=datetime(2026, 4, 20, 9, 0), completed_at=datetime(2026, 4, 20, 9, 3)),
            NodeExecution(execution_id=we.id, node_key="assign_user", status="completed", input_data='{"service":"ROV"}', output_data='{"assigned_to":"sales_team"}', duration_ms=800, started_at=datetime(2026, 4, 20, 9, 4), completed_at=datetime(2026, 4, 20, 9, 5)),
        ]
        for n in nodes:
            session.add(n)
        await session.commit()
        print(f"  ✅ 1 workflow execution with 3 node executions")


async def seed_audit_logs(session: AsyncSession):
    r = await session.execute(select(AuditLog))
    if r.scalars().first():
        print("Seeding audit_log... ⏭️  already has data")
        return
    print("Seeding audit_log...")
    r = await session.execute(select(Enquiry).limit(3))
    enquiries = r.scalars().all()

    if enquiries:
        logs = [
            AuditLog(enquiry_id=enquiries[0].id, action="created", actor="system", details="Enquiry received via email from ADNOC", node="trigger"),
            AuditLog(enquiry_id=enquiries[0].id, action="assigned", actor="John Smith", details="Assigned to Sales Team - ROV specialist", node="assign_user"),
            AuditLog(enquiry_id=enquiries[0].id, action="approved", actor="Manager", details="Technical proposal approved by ADNOC engineering team", node="approval"),
        ]
        for l in logs:
            session.add(l)
        await session.commit()
        print(f"  ✅ {len(logs)} audit logs")


async def main():
    print("=" * 60)
    print("Aries Marine: Seeding Realistic Data")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        await seed_tax_categories(session)
        await seed_items(session)
        await seed_bins(session)
        await seed_cost_centers(session)
        await seed_purchase_orders(session)
        await seed_sales_invoices(session)
        await seed_payment_entries(session)
        await seed_journal_entries(session)
        await seed_gl_entries(session)
        await seed_stock_entries(session)
        await seed_material_requests(session)
        await seed_maintenance_records(session)
        await seed_project_assignments(session)
        await seed_notebooks(session)
        await seed_channel_connectors(session)
        await seed_ui_dashboards(session)
        await seed_quality_inspections(session)
        await seed_workflow_executions(session)
        await seed_audit_logs(session)

    print("\n" + "=" * 60)
    print("🎉 Seed complete! All tables now have Aries Marine data.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
