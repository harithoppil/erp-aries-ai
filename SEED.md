# Seed Data Generation Guide

> **Two-script workflow: GENERATE JSON via LLM → REVIEW → IMPORT to PostgreSQL**
>
> `seed-generate.ts` creates JSON files in `seed-output/`.  
> `seed-import.ts` reads those JSON files and inserts into `erpnext_port` schema.

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ seed-generate.ts │ ──► │  seed-output/    │ ──► │ seed-import.ts  │
│  (LLM → JSON)    │     │  (review JSON)   │     │  (JSON → DB)     │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Why two scripts?**
- You can review/edit the generated JSON before touching the database
- Re-run generation without wiping existing data
- Import is idempotent — duplicate keys are caught and skipped
- Dry-run mode lets you validate without any DB writes

---

## File Structure

| File | Purpose |
|------|---------|
| `scripts/seed-generate.ts` | **Generator** — calls DeepSeek V4 Flash, validates with Zod, saves JSON |
| `scripts/seed-import.ts` | **Importer** — reads JSON, batch inserts into PostgreSQL |
| `seed-output/` | Generated JSON files + `_cost-report.json` + `_summary.json` |
| `lib/azure-openai.ts` | Azure OpenAI client |
| `prisma/schema.prisma` | Schema with 517 `erpnext_port` models + `@@map` table names |

---

## Step 1: Generate JSON

```bash
cd /Users/harithoppil/Desktop/game/erp-aries/tmp/erp-aries-ai
npx tsx scripts/seed-generate.ts
```

### What it does
- Groups 517 models into 22 business modules
- Generates in priority order (Setup → Accounts → Stock → Selling → Buying → …)
- Validates each LLM response with hardened Zod schema
- Retries with error feedback if validation fails (max 2 retries, temperature decay)
- Saves each module as `seed-output/{Module}.json`
- Writes `_cost-report.json` and `_summary.json`

### Output

```
--- CRITICAL (5 modules) ---

Setup (40 tables, 8 rows)...
  💾 Saved 320 rows (12 models) → seed-output/Setup.json | $0.0234 total
...

═══════════════════════════════════════════════════════
              GENERATION REPORT
═══════════════════════════════════════════════════════

=== DONE in 45.2s ===
Modules generated: 22
Total rows: 2,890
Output dir: /.../seed-output
COST: $0.1283

💰 Cost report saved → seed-output/_cost-report.json
📋 Summary saved     → seed-output/_summary.json
```

### Review the JSON

```bash
ls seed-output/
# Setup.json  Accounts.json  Stock.json  ...  _cost-report.json  _summary.json

cat seed-output/_summary.json | jq
# See total rows, cost, file map

cat seed-output/Selling.json | jq 'keys'
# See which models were generated

cat seed-output/Selling.json | jq '.SalesOrder[0]'
# Inspect a specific row
```

---

## Step 2: Import to Database

### Prerequisites

```bash
# Ensure tables exist
npx prisma db push --accept-data-loss
```

### Import all modules

```bash
npx tsx scripts/seed-import.ts
```

### Import specific modules only

```bash
npx tsx scripts/seed-import.ts Setup Accounts
```

### Dry run (validate without DB write)

```bash
npx tsx scripts/seed-import.ts --dry-run
```

### Output

```
=== SEED DATA IMPORTER ===
Reading from: /.../seed-output
Schema models loaded: 517
Modules to import: 22

Setup (12 models, 320 rows)...
  ✅ 320 inserted | 0 FK errs | 0 skipped
Accounts (48 models, 552 rows)...
  ✅ 552 inserted | 0 FK errs | 0 skipped
...

═══════════════════════════════════════════════════════
              IMPORT REPORT
═══════════════════════════════════════════════════════
┌─────────┬────────┬──────────┬─────────┬─────────┐
│ Module  │ Models │ Inserted │ FK Errs │ Skipped │
├─────────┼────────┼──────────┼─────────┼─────────┤
│ Setup   │ 12     │ 320      │ 0       │ 0       │
│ ...     │ ...    │ ...      │ ...     │ ...     │
└─────────┴────────┴──────────┴─────────┴─────────┘

=== DONE in 12.5s ===
Modules imported: 22
Total rows inserted: 2,890
Total FK errors:     0
Total skipped (dup): 0
```

---

## Script 1: `seed-generate.ts`

### Self-Correcting Loop

```
1. System prompt + schemas + FK hints → LLM
2. LLM returns JSON
3. JSON.parse() ──► Zod validation
   ├─ enforces non-empty "name" PK on every row
   ├─ validates date formats (YYYY-MM-DD or ISO-8601)
   └─ rejects null, objects, arrays, empty strings, NaN, Infinity
4. If Zod error:
   └── Send ONLY first 10 error messages back (not full raw response)
   └── Temperature decays: 1.0 → 0.5
   └── Exponential backoff: 2s, 4s
   └── Up to 2 retries per module
5. If valid → save JSON file + update cost tracking
6. Track generated names for FK hints in subsequent modules
```

### Module-Scoped FK Hints

Instead of passing ALL previously generated names (huge token bloat), only names from modules the current module **depends on** are passed:

```
Selling module sees:
  Company: [Neokli India Pvt Ltd, Neokli Trading LLC]
  Item: [ITEM-0001, ITEM-0002, ...]
  Customer: [Acme Corp India, Global Traders LLC]
```

### Comprehensive Prompts (22 modules)

| Module | Rows | Key Details |
|--------|------|-------------|
| **Setup** | 8 | NIPL + NTL companies, fiscal years, payment modes, brands, shareholders |
| **Accounts** | 6 | CoA nested-set lft/rgt, journal entries MUST balance, GLEntry mirroring, GST/VAT accounts |
| **Stock** | 5 | Warehouses per company, UOMs, items, bin consistency formula, stock ledger mirroring |
| **Selling** | 5 | Quotation→SO→DN→SI cycle, status progression, CGST+SGST/IGST/VAT, one credit note |
| **Buying** | 5 | RFQ→SQ→PO→PR→PI cycle, per_billed/per_received alignment |
| **Manufacturing** | 3 | BOM qty logic, operations with time/rate, job cards, downtime reasons |
| **Regional** | 4 | India GSTIN format, 6-digit HSN, UAE TRN 15-digit, tax rule logic |
| **Quality** | 3 | 7 inspection parameters with tolerances, Accepted/Rejected cascade rule |
| **Subcontracting** | 3 | Supplied qty = BOM qty × order qty, partial receipt proportionality |
| **CRM/Projects/Assets/HR/Support** | 2 | DORMANT with specific example rows |
| **8 dormant modules** | 1 | Minimal data, saved as JSON for completeness |

---

## Script 2: `seed-import.ts`

### Insertion Strategy

| Feature | Implementation |
|---------|---------------|
| **Batch size** | 100 rows per INSERT query |
| **Transactions** | Each module wrapped in `prisma.$transaction()` |
| **Rollback** | Entire module rolls back on unknown errors |
| **Parent-first** | Self-referencing tables (Account, ItemGroup, etc.) insert parents before children |
| **Table names** | Reads `@@map` from schema — inserts into actual `snake_case` table names |
| **FK errors** | Caught and counted (module continues, other rows still insert) |
| **Duplicates** | Caught and skipped (unique constraint violations) |
| **Dry run** | `--dry-run` flag validates file structure without any DB writes |

### Import Order

Modules are imported in the same dependency order as generation:

```
1. Setup          (masters, no FK deps)
2. Accounts       (depends on Setup)
3. Stock          (depends on Setup, Buying, Selling)
4. Selling        (depends on Setup, Stock, Accounts)
5. Buying         (depends on Setup, Stock, Accounts)
6. Manufacturing  (depends on Setup, Stock, Buying)
7. Regional       (depends on Setup, Accounts)
8. Quality        (depends on Setup, Stock)
9. Subcontracting (depends on Setup, Stock, Buying, Manufacturing)
... etc
```

---

## JSON File Format

### Module file: `seed-output/{Module}.json`

```json
{
  "_meta": {
    "module": "Selling",
    "generatedAt": "2025-01-09T07:45:12.000Z",
    "model": "DeepSeek-V4-Flash",
    "tables": 8,
    "totalRows": 40
  },
  "Customer": [
    { "name": "Acme Corp India", "customer_group": "Commercial", "territory": "India", ... }
  ],
  "SalesOrder": [
    { "name": "SAL-ORD-2025-00001", "customer": "Acme Corp India", ... }
  ],
  ...
}
```

### Cost report: `seed-output/_cost-report.json`

```json
{
  "generatedAt": "2025-01-09T07:45:12.000Z",
  "model": "DeepSeek-V4-Flash",
  "pricing": { "inputPer1M": 0.19, "outputPer1M": 0.51 },
  "totals": {
    "calls": 22,
    "retries": 1,
    "inputTokens": 142300,
    "outputTokens": 198500,
    "costUsd": 0.1283,
    "costInr": 10.71
  },
  "modules": [
    { "module": "Setup", "tables": 40, "models": 12, "rows": 96, "file": "Setup.json" }
  ]
}
```

### Summary: `seed-output/_summary.json`

```json
{
  "_meta": {
    "generatedAt": "2025-01-09T07:45:12.000Z",
    "totalModules": 22,
    "totalModels": 450,
    "totalRows": 2890,
    "costUsd": 0.1283,
    "costInr": 10.71
  },
  "files": {
    "Setup": "Setup.json",
    "Accounts": "Accounts.json",
    "Stock": "Stock.json",
    ...
  }
}
```

---

## Cost Estimate

| Module | Tables | Rows | Est. Input tok | Est. Output tok | Est. Cost |
|--------|--------|------|----------------|-----------------|-----------|
| Setup | 40 | 8 | 15,000 | 28,000 | $0.017 |
| Accounts | 92 | 6 | 28,000 | 62,000 | $0.037 |
| Stock | 55 | 5 | 12,000 | 20,000 | $0.013 |
| Selling | 35 | 5 | 10,000 | 12,000 | $0.008 |
| Buying | 30 | 5 | 10,000 | 12,000 | $0.008 |
| Manufacturing | 47 | 3 | 10,000 | 16,000 | $0.010 |
| Regional | 26 | 4 | 6,000 | 7,000 | $0.005 |
| Quality | 23 | 3 | 7,000 | 8,000 | $0.005 |
| Subcontracting | 14 | 3 | 5,000 | 6,000 | $0.004 |
| CRM | 27 | 2 | 4,000 | 5,000 | $0.003 |
| Projects | 15 | 2 | 3,000 | 3,500 | $0.002 |
| Assets | 17 | 2 | 3,500 | 4,000 | $0.002 |
| HR | 11 | 2 | 2,500 | 3,000 | $0.002 |
| Support | 11 | 2 | 2,500 | 3,000 | $0.002 |
| 8 dormant | ~70 | 1 | ~8,000 | ~8,500 | $0.006 |
| **TOTAL** | **~450** | | **~125K** | **~185K** | **~$0.12** |

---

## One-Liners

```bash
# Full workflow: generate + import
cd /Users/harithoppil/Desktop/game/erp-aries/tmp/erp-aries-ai && \
  npx tsx scripts/seed-generate.ts && \
  npx tsx scripts/seed-import.ts

# Generate only (review JSON first)
npx tsx scripts/seed-generate.ts

# Dry-run import (validate without DB writes)
npx tsx scripts/seed-import.ts --dry-run

# Import specific modules
npx tsx scripts/seed-import.ts Setup Accounts Stock

# Re-generate a single module (e.g. after editing its prompt)
# 1. Delete its JSON: rm seed-output/Selling.json
# 2. Re-run generator: npx tsx scripts/seed-generate.ts
# 3. Re-import:      npx tsx scripts/seed-import.ts Selling
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Missing AZURE_OPENAI_API_KEY` | Check `.env` has the key |
| `JSON parse failed` on generate | Retry loop handles automatically (2 retries) |
| `All 2 attempts failed` on generate | Check `seed-output/debug-{module}.json` for raw LLM output |
| `relation "account" does not exist` on import | Run `npx prisma db push --accept-data-loss` first |
| `violates foreign key constraint` on import | Normal if importing out of order — use default priority order |
| `unique constraint` on import | Rows already exist — skipped automatically |
| Too expensive on generate | Reduce `rows` in PROMPTS or skip dormant modules |
| Want to edit generated data | Just edit the JSON files in `seed-output/`, then re-import |
