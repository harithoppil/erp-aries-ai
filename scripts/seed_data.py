#!/usr/bin/env python3
"""Seed Aries ERP with historical invoice data, wiki pages, and RAG index.

Reads from:
- seed_data/filtered_invoices_nonocr/  → 1,714 historical invoices (already OCR'd)
- seed_data/companies.json             → 25 marine companies
- seed_data/projects.json              → 50 offshore projects
- seed_data/personnel.json             → 80 personnel
- seed_data/equipment.json             → 150 equipment items
- seed_data/invoices.json              → 22 Aries-style invoices (for ERP tables)

Writes to:
- wiki/ → entity pages, concept pages, outcome pages, source pages
- aries.db → ERP tables (accounts, invoices, suppliers, projects, personnel, assets)
- rag_store.db → RAG vector index (chunked wiki pages with embeddings)

The OCR folder (150 invoices) is deliberately NOT seeded — those are the
live OCR demo set where Gemini processes images in real-time.
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from collections import Counter

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

SEED_DIR = ROOT / "seed_data"
WIKI_ROOT = ROOT / "wiki"


def seed_wiki():
    """Create wiki pages from all seed data."""
    print("\n=== Seeding Wiki ===")

    # Load seed data
    companies = json.load(open(SEED_DIR / "companies.json"))
    projects = json.load(open(SEED_DIR / "projects.json"))
    personnel = json.load(open(SEED_DIR / "personnel.json"))
    equipment = json.load(open(SEED_DIR / "equipment.json"))

    # Load non-OCR invoices
    invoices = []
    with open(SEED_DIR / "filtered_invoices_nonocr" / "metadata" / "invoices.jsonl") as f:
        for line in f:
            invoices.append(json.loads(line))

    # Also load the Aries-style invoices
    aries_invoices = json.load(open(SEED_DIR / "invoices.json"))

    print(f"  Companies: {len(companies)}")
    print(f"  Projects: {len(projects)}")
    print(f"  Personnel: {len(personnel)}")
    print(f"  Equipment: {len(equipment)}")
    print(f"  Historical invoices: {len(invoices)}")
    print(f"  Aries invoices: {len(aries_invoices)}")

    # --- Entity pages (companies) ---
    entities_dir = WIKI_ROOT / "entities"
    entities_dir.mkdir(parents=True, exist_ok=True)

    for c in companies:
        path = f"entities/{c['name'].lower().replace(' ', '-').replace('/', '-')}.md"
        content = f"""# {c['name']}

| Field | Value |
|-------|-------|
| IMO Number | {c.get('imo_number', 'N/A')} |
| Country | {c.get('country', 'N/A')} |
| Address | {c.get('address', 'N/A')} |

## Overview

{c['name']} is a client/partner in the Aries Marine network.

## Related Projects

{chr(10).join(f'- [[{p.get("vessel_name", p["id"])}]]' for p in projects if p.get('client_id') == c['id']) or 'No linked projects yet.'}

## Invoice History

Total invoices: {sum(1 for i in invoices if _get_bill_to_name(i) == c['name'])}
"""
        _write_wiki_page(path, content)

    print(f"  Created {len(companies)} entity pages")

    # --- Concept pages ---
    concepts_dir = WIKI_ROOT / "concepts"
    concepts_dir.mkdir(parents=True, exist_ok=True)

    concepts = [
        ("margin-calculation.md", "Margin Calculation",
         """# Margin Calculation

## Aries Marine Margin Rules

### Minimum Margin
- **15% minimum** on all pre-sales quotations
- Margin = (Estimated Value - Estimated Cost) / Estimated Value × 100

### Approval Thresholds
- **Below AED 200,000**: Single approval sufficient
- **Above AED 200,000**: Two-person approval required

### Pricing Adjustments
- Offshore diving projects: +10% risk premium
- Emergency callout: +20% surcharge
- Long-term contracts (>6 months): -5% volume discount

## UAE VAT
- Standard rate: **5%**
- VAT registration threshold: AED 375,000
- All invoices must include VAT line item

## Day Rate Structure
- Standard team day rate: AED 900–1,200
- Senior team day rate: AED 1,100–1,500
- Equipment rental: AED 400–600/day
- Mob/Demob: AED 2,500–5,000 per mobilization
"""),
        ("offshore-diving.md", "Offshore Diving Operations",
         """# Offshore Diving Operations

## Certification Requirements

### IRATA Levels
- **Level 1**: Basic rope access technician
- **Level 2**: Intermediate (can rig and rescue)
- **Level 3**: Supervisor level

### CSWIP
- 3.1U: Underwater welder approval
- 3.2: Welding inspector
- 3.4U: Underwater welder (hyperbaric)

### BOSIET
- Basic Offshore Safety Induction & Emergency Training
- Required for ALL offshore personnel
- Valid for 4 years, then FOET refresher

## Typical Project Scope
1. Vessel mobilization (2-3 days)
2. Dive operations (5-45 days depending on scope)
3. Demobilization (1-2 days)
4. Report generation (3-5 days)

## Risk Categories
- **Low**: Visual inspection, light cleaning
- **Medium**: NDT, minor repairs
- **High**: Hyperbaric welding, structural repair
- **Critical**: Emergency salvage, deep water (>50m)
"""),
        ("ndt-inspection.md", "Non-Destructive Testing (NDT)",
         """# Non-Destructive Testing

## Common NDT Methods

### Magnetic Particle Inspection (MPI)
- Detects surface and near-surface flaws
- Used on ferromagnetic materials
- Requires CSWIP 3.1 certified inspector

### Ultrasonic Testing (UT)
- Detects internal flaws and measures thickness
- Used for corrosion mapping and weld inspection
- Requires specialized UT technician

### Visual Inspection (VI)
- Most basic NDT method
- All divers can perform basic VI
- Detailed VI requires CSWIP 3.4 certification

### Eddy Current Testing (ET)
- Used for tube inspection and surface flaws
- Common in heat exchanger inspection

## Reporting
- All NDT findings must be documented
- Reports follow ISO 17640 (UT) and ISO 17638 (MPI) standards
- Defects classified as: Acceptable, Conditionally Acceptable, Unacceptable
"""),
    ]

    for filename, title, content in concepts:
        _write_wiki_page(f"concepts/{filename}", content)

    print(f"  Created {len(concepts)} concept pages")

    # --- Source pages (historical invoices as reference cases) ---
    sources_dir = WIKI_ROOT / "sources"
    sources_dir.mkdir(parents=True, exist_ok=True)

    # Group invoices by company for summary pages
    company_invoices: dict[str, list] = {}
    for inv in invoices[:500]:  # Sample 500 for wiki pages (not all 1714 — that'd be too many pages)
        name = _get_bill_from_name(inv)
        if name:
            company_invoices.setdefault(name, []).append(inv)

    for company_name, invs in list(company_invoices.items())[:30]:
        safe_name = company_name.lower().replace(' ', '-').replace('/', '-')[:50]
        total_value = sum(i['data'].get('total_due', 0) or i['data'].get('total', 0) or 0 for i in invs)
        avg_value = total_value / len(invs) if invs else 0

        content = f"""# {company_name} — Invoice History

## Summary

| Metric | Value |
|--------|-------|
| Total Invoices | {len(invs)} |
| Total Value | ${total_value:,.2f} |
| Average Invoice | ${avg_value:,.2f} |

## Recent Invoices

| Invoice # | Date | Total | Status |
|-----------|------|-------|--------|
"""
        for inv in invs[:15]:
            d = inv['data']
            inv_num = d.get('invoice_number', 'N/A')
            inv_date = d.get('invoice_date', 'N/A')
            total = d.get('total_due', 0) or d.get('total', 0) or 0
            content += f"| {inv_num} | {inv_date} | ${total:,.2f} | Historical |\n"

        _write_wiki_page(f"sources/{safe_name}.md", content)

    print(f"  Created {min(len(company_invoices), 30)} source pages")

    # --- Outcome pages (Aries-style invoices as project outcomes) ---
    outcomes_dir = WIKI_ROOT / "outcomes"
    outcomes_dir.mkdir(parents=True, exist_ok=True)

    for inv in aries_invoices:
        safe_id = inv['id'].lower().replace(' ', '-')
        line_items_md = ""
        for item in inv.get('line_items', []):
            line_items_md += f"- **{item['description']}**: {item['quantity']} × ${item.get('unit_price', item.get('price', 0)):,.2f} = ${item.get('total', item['quantity'] * item.get('unit_price', item.get('price', 0))):,.2f}\n"

        margin = ((inv.get('subtotal', 0) - inv.get('subtotal', 0) * 0.7) / inv.get('subtotal', 1)) * 100 if inv.get('subtotal') else 0

        content = f"""# Invoice {inv['id']}

## Project: {inv.get('project_id', 'N/A')}
## Client: {inv.get('client_id', 'N/A')}

| Field | Value |
|-------|-------|
| Issue Date | {inv.get('issue_date', 'N/A')} |
| Due Date | {inv.get('due_date', 'N/A')} |
| Subtotal | ${inv.get('subtotal', 0):,.2f} |
| Tax (5% UAE VAT) | ${inv.get('tax', 0):,.2f} |
| **Total** | **${inv.get('total', 0):,.2f}** |
| Status | {inv.get('status', 'N/A')} |
| Est. Margin | {margin:.1f}% |

## Line Items

{line_items_md}

## Lessons Learned

- Standard day-rate project with equipment rental
- VAT applied at UAE standard rate of 5%
- Margin within acceptable range per [Margin Calculation](/concepts/margin-calculation)
"""
        _write_wiki_page(f"outcomes/{safe_id}.md", content)

    print(f"  Created {len(aries_invoices)} outcome pages")

    # --- Personnel pages ---
    for p in personnel[:20]:
        name = f"{p.get('first_name', '')} {p.get('last_name', '')}".strip()
        if not name:
            continue
        safe_name = name.lower().replace(' ', '-')
        certs = p.get('certifications', [])
        certs_md = ""
        for c in certs:
            certs_md += f"- {c.get('type', 'Certification')}: {c.get('status', 'Unknown')} (exp: {c.get('expiry_date', 'N/A')})\n"

        content = f"""# {name}

| Field | Value |
|-------|-------|
| Role | {p.get('role', 'N/A')} |
| Email | {p.get('email', 'N/A')} |
| Department | {p.get('department', 'N/A')} |
| Status | {p.get('status', 'Active')} |

## Certifications

{certs_md or 'No certifications on file.'}

## Compliance Status

{'✅ All certifications current' if not certs else '⚠️ Check certification expiry dates'}
"""
        _write_wiki_page(f"entities/{safe_name}.md", content)

    print(f"  Created {min(len(personnel), 20)} personnel entity pages")

    # --- Equipment pages ---
    equip_by_cat = Counter(e.get('category', 'Other') for e in equipment)
    for cat, count in equip_by_cat.most_common():
        safe_cat = cat.lower().replace(' ', '-').replace('/', '-')
        items = [e for e in equipment if e.get('category') == cat]
        items_md = ""
        for item in items[:20]:
            items_md += f"- **{item.get('name', 'N/A')}** (S/N: {item.get('serial_number', 'N/A')}) — {item.get('status', 'Active')}\n"

        content = f"""# {cat} Equipment

## Inventory ({count} items)

{items_md}

## Maintenance Notes

- Calibration per manufacturer schedule
- Annual inspection required for offshore equipment
- See [Assets Module](/erp/assets) for current status
"""
        _write_wiki_page(f"entities/equipment-{safe_cat}.md", content)

    print(f"  Created {len(equip_by_cat)} equipment category pages")

    # --- Update index ---
    _update_wiki_index()

    return {
        "companies": len(companies),
        "concepts": len(concepts),
        "sources": min(len(company_invoices), 30),
        "outcomes": len(aries_invoices),
        "personnel": min(len(personnel), 20),
        "equipment_categories": len(equip_by_cat),
    }


def _get_bill_from_name(invoice: dict) -> str:
    bf = invoice.get('data', {}).get('bill_from', '')
    if isinstance(bf, dict):
        return bf.get('name', '')
    return str(bf)[:50] if bf else ''


def _get_bill_to_name(invoice: dict) -> str:
    bt = invoice.get('data', {}).get('bill_to', '')
    if isinstance(bt, dict):
        return bt.get('name', '')
    return str(bt)[:50] if bt else ''


def _write_wiki_page(path: str, content: str):
    full_path = WIKI_ROOT / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content)


def _update_wiki_index():
    """Regenerate the wiki index.md with all pages."""
    pages = []
    for p in WIKI_ROOT.rglob("*.md"):
        if p.name in ("index.md", "AGENTS.md", "log.md"):
            continue
        rel_path = str(p.relative_to(WIKI_ROOT))
        pages.append(rel_path)

    # Categorize
    categories: dict[str, list[str]] = {
        "Entities": [],
        "Concepts": [],
        "Sources": [],
        "Outcomes": [],
        "Other": [],
    }
    for p in pages:
        if p.startswith("entities/"):
            categories["Entities"].append(p)
        elif p.startswith("concepts/"):
            categories["Concepts"].append(p)
        elif p.startswith("sources/"):
            categories["Sources"].append(p)
        elif p.startswith("outcomes/"):
            categories["Outcomes"].append(p)
        else:
            categories["Other"].append(p)

    lines = [
        "# Aries Knowledge Base Index",
        "",
        f"_Last updated: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M UTC')}_",
        "",
        f"_Total pages: {len(pages)}_",
        "",
    ]

    for cat, items in categories.items():
        if not items:
            continue
        lines.append(f"## {cat} ({len(items)})")
        lines.append("")
        for item in sorted(items):
            title = item.replace(".md", "").split("/")[-1].replace("-", " ").title()
            lines.append(f"- [{title}]({item})")
        lines.append("")

    _write_wiki_page("index.md", "\n".join(lines))
    print(f"  Updated index.md with {len(pages)} pages")


def seed_erp_tables():
    """Seed ERP database tables with invoice, company, and project data."""
    print("\n=== Seeding ERP Tables ===")
    # This runs as an async operation against the live DB
    import asyncio

    async def _seed():
        from sqlalchemy import select
        from backend.app.core.database import async_session, engine, Base
        from backend.app.models.erp import (
            Account, Supplier, Item, Warehouse, Project, Personnel, Asset, Certification,
        )
        from backend.app.models.enquiry import Enquiry
        from backend.app.models.workflow import Workflow, WorkflowNode, WorkflowEdge
        from backend.app.models.ai import Persona, AIConversation, AIMessage, ChannelConnector, UIDashboard

        # Create all tables first
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("  Database tables created")

        companies = json.load(open(SEED_DIR / "companies.json"))
        aries_invoices = json.load(open(SEED_DIR / "invoices.json"))
        personnel_data = json.load(open(SEED_DIR / "personnel.json"))
        equipment_data = json.load(open(SEED_DIR / "equipment.json"))
        projects_data = json.load(open(SEED_DIR / "projects.json"))

        async with async_session() as db:
            # Seed suppliers from companies
            existing = (await db.execute(select(Supplier))).scalars().all()
            existing_names = {s.supplier_name for s in existing}

            added = 0
            for c in companies:
                if c['name'] not in existing_names:
                    supplier = Supplier(
                        supplier_name=c['name'],
                        supplier_code=f"SUP-{c['id'][-4:]}",
                        email=c.get('email', ''),
                        address=c.get('address', ''),
                    )
                    db.add(supplier)
                    added += 1

            await db.commit()
            print(f"  Suppliers: {added} added ({len(existing)} already existed)")

            # Seed personnel
            existing = (await db.execute(select(Personnel))).scalars().all()
            existing_ids = {str(p.id) for p in existing}

            added = 0
            for p in personnel_data:
                if p['id'] not in existing_ids:
                    import uuid
                    pid = uuid.UUID(p['id']) if len(p['id']) == 36 else uuid.uuid4()
                    person = Personnel(
                        id=pid,
                        employee_id=f"EMP-{str(pid)[:8]}",
                        first_name=p.get('first_name', 'Unknown'),
                        last_name=p.get('last_name', ''),
                        email=p.get('email', ''),
                        designation=p.get('role', 'Technician'),
                        department=p.get('department', 'Operations'),
                    )
                    db.add(person)
                    added += 1

                    # Add certifications
                    for cert in p.get('certifications', []):
                        from datetime import datetime as dt
                        exp_date = cert.get('expiry_date')
                        if isinstance(exp_date, str) and exp_date:
                            try:
                                exp_date = dt.fromisoformat(exp_date.replace('Z', '+00:00'))
                            except (ValueError, TypeError):
                                exp_date = None
                        else:
                            exp_date = None
                        c = Certification(
                            personnel_id=person.id,
                            cert_type=cert.get('type', 'General'),
                            cert_number=cert.get('number', ''),
                            issuing_body=cert.get('issuing_body'),
                            expiry_date=exp_date,
                        )
                        db.add(c)

            await db.commit()
            print(f"  Personnel: {added} added")

            # Seed equipment as assets
            existing = (await db.execute(select(Asset))).scalars().all()
            existing_serials = {a.serial_number for a in existing if a.serial_number}

            added = 0
            for e in equipment_data:
                sn = e.get('serial_number', '')
                if sn and sn not in existing_serials:
                    asset = Asset(
                        asset_name=e.get('name', 'Unknown Equipment'),
                        asset_code=f"AST-{e.get('id', '0')[-4:]}",
                        asset_category=e.get('category', 'General'),
                        location=e.get('location', 'Main Warehouse'),
                    )
                    db.add(asset)
                    added += 1

            await db.commit()
            print(f"  Assets: {added} added")

            # Seed accounts (Chart of Accounts)
            existing = (await db.execute(select(Account))).scalars().all()
            if not existing:
                accounts = [
                    Account(name="Accounts Receivable", account_type="receivable"),
                    Account(name="Accounts Payable", account_type="payable"),
                    Account(name="Revenue - Diving Services", account_type="income"),
                    Account(name="Revenue - NDT Inspection", account_type="income"),
                    Account(name="Revenue - Equipment Rental", account_type="income"),
                    Account(name="Cost - Personnel", account_type="expense"),
                    Account(name="Cost - Equipment", account_type="expense"),
                    Account(name="Cost - Operations", account_type="expense"),
                    Account(name="VAT Receivable", account_type="asset"),
                    Account(name="VAT Payable", account_type="liability"),
                    Account(name="Cash - AED", account_type="asset"),
                    Account(name="Cash - USD", account_type="asset"),
                    Account(name="Retained Earnings", account_type="equity"),
                ]
                for a in accounts:
                    db.add(a)
                await db.commit()
                print(f"  Accounts: {len(accounts)} added (Chart of Accounts)")

            # Seed warehouse
            existing = (await db.execute(select(Warehouse))).scalars().all()
            if not existing:
                warehouses = [
                    Warehouse(warehouse_name="Main Warehouse - Dubai", warehouse_code="WH-DXB", location="Dubai"),
                    Warehouse(warehouse_name="Offshore Supply Base", warehouse_code="WH-OSB", location="Abu Dhabi"),
                    Warehouse(warehouse_name="Workshop - Jebel Ali", warehouse_code="WH-JAFZ", location="Jebel Ali"),
                ]
                for w in warehouses:
                    db.add(w)
                await db.commit()
                print(f"  Warehouses: {len(warehouses)} added")

            # Seed sample enquiries from Aries invoices
            existing = (await db.execute(select(Enquiry))).scalars().all()
            if len(existing) < 5:
                for inv in aries_invoices[:5]:
                    enquiry = Enquiry(
                        client_name=inv.get('client_id', 'Unknown Client'),
                        channel="erp",
                        industry="Marine & Offshore",
                        description=f"Project {inv.get('project_id', 'N/A')} — Diving and inspection services",
                        estimated_value=inv.get('subtotal', 0),
                        estimated_cost=inv.get('subtotal', 0) * 0.7,
                        estimated_margin=30.0,
                    )
                    db.add(enquiry)
                await db.commit()
                print(f"  Sample enquiries: {min(5, len(aries_invoices))} added")

    asyncio.run(_seed())


def seed_rag():
    """Index all wiki pages into the RAG vector store."""
    print("\n=== Seeding RAG Vector Store ===")
    import asyncio

    async def _seed():
        from backend.app.services.rag import RAGService
        from backend.app.services.wiki import WikiService

        wiki = WikiService()
        rag = RAGService()

        pages = wiki.list_pages()
        print(f"  Found {len(pages)} wiki pages to index")

        total_chunks = 0
        indexed = 0
        errors = []

        for page_path in pages:
            page = wiki.read_page(page_path)
            if not page:
                continue
            try:
                count = await rag.index_wiki_page(page_path, page.content)
                total_chunks += count
                indexed += 1
                if indexed % 20 == 0:
                    print(f"  Progress: {indexed}/{len(pages)} pages, {total_chunks} chunks")
            except Exception as e:
                errors.append(f"{page_path}: {e}")

        print(f"  RAG indexing complete: {indexed} pages, {total_chunks} chunks")
        if errors:
            print(f"  Errors: {len(errors)}")
            for e in errors[:5]:
                print(f"    {e}")

        return {"indexed_pages": indexed, "total_chunks": total_chunks, "errors": len(errors)}

    return asyncio.run(_seed())


def main():
    print("=" * 60)
    print("ARIES ERP — Seed Data Loader")
    print("=" * 60)

    # Step 1: Wiki pages from seed data
    wiki_stats = seed_wiki()

    # Step 2: ERP database tables
    seed_erp_tables()

    # Step 3: RAG vector index
    rag_stats = seed_rag()

    print("\n" + "=" * 60)
    print("SEED COMPLETE")
    print("=" * 60)
    print(f"""
Wiki pages created:
  - Entities: {wiki_stats['companies']}
  - Concepts: {wiki_stats['concepts']}
  - Sources: {wiki_stats['sources']}
  - Outcomes: {wiki_stats['outcomes']}
  - Personnel: {wiki_stats['personnel']}
  - Equipment categories: {wiki_stats['equipment_categories']}

RAG index: {rag_stats['indexed_pages']} pages → {rag_stats['total_chunks']} chunks

OCR Demo Set: 150 invoices in seed_data/filtered_invoices_ocr/
  → Use Gemini OCR to process these live (ground truth in metadata/ground_truth.jsonl)
  → POST /api/v1/documents/process-pdf with the invoice images
""")


if __name__ == "__main__":
    main()
