# Phase 8+ Porting Plan: Remaining Python Backend → Next.js

> **Based on:** Comprehensive backend audit (May 2026)
> **Previous phases:** Phases 1-7 complete — ERP CRUD, AI Personas, RAG, MCP Gateway all ported
> **This document:** What's left, what can be ported, what must stay in Python

---

## Current State

### What's Done (Phases 1-7)

| Phase | What Was Ported | Key Files |
|-------|----------------|-----------|
| 1-4 | All ERP CRUD (12 modules) + Enquiries + Notebooks + Wiki + Workflows | 34 files, 1777 insertions |
| 5 | AI Personas CRUD + Chat (chat still proxies to Python AgentLoop) | `ai/actions.ts` |
| 6 | RAG search + indexing (direct Gemini embedding + pgvector) | `lib/rag-embed.ts`, `lib/rag-db.ts` |
| 7 | MCP Gateway (9 servers, 22 tools) | `lib/mcp-gateway.ts`, `api/mcp/*` |
| Post | Financial reports proxy to Python, Chart of Accounts proxy | `reports/actions.ts` |
| Post | Server component conversion (14 ERP pages) + loading.tsx + error.tsx | `*-client.tsx` files |
| Post | Custom skeletons, responsive hooks, useMediaQuery | All ERP pages |

### What Stays in Python (Permanent Microservice)

These endpoints require Python-native libraries, filesystem access, or credentials that can't run in Node.js:

| Module | Why It Stays | Key Python Dependencies |
|--------|-------------|------------------------|
| **AgentLoop** (`agent_loop.py`) | Gemini tool-calling loop + MCP dispatch | `@google/genai` SDK, Python async |
| **GeminiService** (`gemini.py`) | Image gen, TTS, structured output, vision | `@google/genai` SA auth |
| **GCS** (`gcs.py`) | Cloud Storage upload/download/signed URLs | `google-cloud-storage` SDK |
| **Document ingestion** (`ingestion.py`) | MarkItDown + git write | `markitdown`, `GitPython` |
| **Document upload** (`document_upload.py`) | GCS + Gemini vision + OCR | `gcs`, `gemini`, `markitdown` |
| **WikiService** (`wiki.py`) | Git-versioned wiki (filesystem + git) | `GitPython`, filesystem |
| **Workflow executor** (`workflow_executor.py`) | DAG walk → Gemini/wiki/rules/MCP | All Python services |
| **Pipeline** (`pipeline.py`) | Wiki→Classify→Rules→LLM→PolicyGate | `gemini`, `wiki`, `rules` |
| **Channel webhooks** (`channels.py`) | WhatsApp/Telegram/Slack inbound + outbound | `httpx`, platform APIs |
| **Document output** (`document_output_server.py`) | PDF (reportlab) + XLSX (openpyxl) | `reportlab`, `openpyxl` |
| **Media generation** (`media_server.py`) | Gemini image + TTS binary output | `gemini.py` SA auth |
| **OCR image indexing** | Reads image files from disk | filesystem + Gemini vision |

---

## Phase 8: Missing ERP Endpoints (Easy CRUD Ports)

> **Effort:** Low — all are simple Prisma queries
> **Impact:** Complete the ERP API surface — no more "that endpoint isn't implemented"

### 8.1 Journal Entries Create

**Current:** Frontend has `listJournalEntries()` but no `createJournalEntry()`
**Backend:** `POST /erp/journal-entries` creates entry + lines (debit/credit) + validates balance

```
File: src/app/erp/journal-entries/actions.ts
Add:  createJournalEntry(data: { entry_type, posting_date, lines: [...] })
```

### 8.2 Warehouses List (add to stock actions)

**Current:** `listWarehouses()` exists but returns raw Prisma objects
**Backend:** `GET /erp/warehouses` returns `{id, warehouse_name, warehouse_code}[]`

```
File: src/app/erp/stock/actions.ts
Fix:  Ensure listWarehouses returns ClientSafeWarehouse[] (already done by agent)
```

### 8.3 Bins / Stock Levels

**Current:** No `listBins()` or stock level endpoint
**Backend:** `GET /erp/bins` returns stock quantities per item+warehouse

```
File: src/app/erp/stock/actions.ts
Add:  listBins() → { item_id, warehouse_id, quantity }[]
```

### 8.4 Calibration Due Assets

**Current:** No calibration tracking
**Backend:** `GET /erp/assets/calibration-due` returns assets where next_calibration_date < today

```
File: src/app/erp/assets/actions.ts
Add:  listCalibrationDue() → ClientSafeAsset[]
```

### 8.5 Personnel Compliance Alerts

**Current:** No compliance checking
**Backend:** `GET /erp/personnel/compliance-alerts` returns personnel with expired/expiring certs

```
File: src/app/erp/hr/actions.ts
Add:  getComplianceAlerts() → { personnel_id, name, cert_type, expiry_date }[]
```

### 8.6 Certifications Create

**Current:** No create endpoint
**Backend:** `POST /erp/certifications` creates cert + auto-sets status (valid/expired)

```
File: src/app/erp/hr/actions.ts
Add:  createCertification(data) → ClientSafeCertification
```

### 8.7 Purchase Order Create

**Current:** No create endpoint
**Backend:** `POST /erp/purchase-orders` creates PO + line items

```
File: src/app/erp/procurement/actions.ts
Add:  createPurchaseOrder(data) → ClientSafePurchaseOrder
```

### 8.8 Material Requests (NEW module)

**Current:** Nothing
**Backend:** `GET/POST /erp/material-requests` — simple CRUD

```
New:  src/app/erp/material-requests/actions.ts
      listMaterialRequests() + createMaterialRequest()
```

### 8.9 Project Assign with Compliance Check

**Current:** No assign endpoint
**Backend:** `POST /erp/projects/{id}/assign` assigns personnel + checks cert compliance

```
File: src/app/erp/projects/actions.ts
Add:  assignPersonnel(projectId, personnelId) with compliance validation
```

### 8.10 Channel Connectors CRUD

**Current:** Nothing
**Backend:** `GET/POST /channels/connectors` — stores webhook configs

```
New:  src/app/channels/actions.ts
      listConnectors() + createConnector()
```

### 8.11 Document List/Get (without GCS)

**Current:** Documents page uses raw fetch to Python
**Backend:** `GET /document-upload/` and `GET /document-upload/{id}` — simple Prisma queries

```
File: src/app/documents/actions.ts (NEW)
Add:  listDocuments() + getDocument(id) → Prisma queries only
      Upload/GCS/signed-URL stays in Python
```

---

## Phase 9: Financial Reports Direct SQL (Biggest Port)

> **Effort:** Medium-High — complex SQL with nested sets, running balances, aggregations
> **Impact:** Eliminates Python proxy for the 5 most-used report endpoints

Currently, these 5 endpoints proxy to Python which does complex SQL:

### 9.1 Chart of Accounts Tree (Nested Set)

**Current:** Proxies to `GET /erp/accounts/tree` → Python does nested set traversal
**Port approach:** Write raw SQL via Prisma `$queryRaw` that does the same nested set query

```sql
-- Python does this exact query:
SELECT id, name, account_number, account_type, root_type,
       parent_account, is_group, balance, lft, rgt, level,
       EXISTS(SELECT 1 FROM accounts c WHERE c.parent_account = a.id) as has_children
FROM accounts a
WHERE company = 'Aries Marine'
ORDER BY lft
```

```
File: src/app/erp/accounts/actions.ts
Replace: getAccountTree() — direct Prisma $queryRaw instead of Python proxy
```

### 9.2 General Ledger with Running Balance

**Current:** Proxies to `GET /erp/reports/general-ledger`
**Port approach:** Write raw SQL with window functions for running balance

```sql
-- Key SQL pattern:
SELECT *, SUM(debit - credit) OVER (PARTITION BY account ORDER BY posting_date) as balance
FROM gl_entries
WHERE posting_date BETWEEN $1 AND $2
ORDER BY posting_date
```

```
File: src/app/erp/reports/actions.ts
Replace: getGeneralLedger() — direct Prisma $queryRaw
```

### 9.3 Trial Balance (Opening + Period + Closing)

**Current:** Proxies to `GET /erp/reports/trial-balance`
**Port approach:** Aggregate SQL queries against accounts + journal_entry_lines

```
File: src/app/erp/reports/actions.ts
Replace: getTrialBalance() — 3 queries (opening, period, closing) via $queryRaw
```

### 9.4 Balance Sheet (Hierarchical Sections)

**Current:** Proxies to `GET /erp/reports/balance-sheet`
**Port approach:** Nested set query grouping by root_type → sections → accounts

```
File: src/app/erp/reports/actions.ts
Replace: getBalanceSheet() — direct Prisma $queryRaw with nested set traversal
```

### 9.5 Profit & Loss (Income vs Expense)

**Current:** Proxies to `GET /erp/reports/profit-and-loss`
**Port approach:** Similar to balance sheet but filtered by root_type IN ('Income', 'Expense')

```
File: src/app/erp/reports/actions.ts
Replace: getProfitAndLoss() — direct Prisma $queryRaw
```

---

## Phase 10: Business Rules Port

> **Effort:** Medium — pure logic, no external deps
> **Impact:** Enables server-side validation in Next.js without Python proxy

### 10.1 Rules Engine (`rules.py` → `lib/rules.ts`)

Python `rules.py` contains deterministic business rules:
- **Margin check**: `min_margin_pct` — reject if margin < threshold
- **Approval routing**: `approval_threshold` — auto-approve vs require manual
- **Tax calculation**: `default_tax_rate` — apply VAT
- **Credit limit**: `credit_limit` — check customer outstanding vs limit

All pure math. No API calls. Easy TypeScript port.

```
File: src/lib/rules.ts (NEW)
Functions:
  - checkMargin(quotationItems, minMarginPct) → { pass: boolean, margin: number }
  - routeApproval(amount, threshold) → 'auto' | 'manual'
  - calculateTax(subtotal, taxRate) → { tax: number, total: number }
  - checkCreditLimit(customerId, outstanding, limit) → { withinLimit: boolean }
```

---

## Phase 11: MCP Tool Handler Full Ports

> **Effort:** Low-Medium — tool handlers that currently proxy to Python
> **Impact:** Reduces Python dependency for common AI tool calls

### 11.1 Wiki MCP Tools (currently proxy to Python wiki API)

The 4 wiki tools in `mcp-gateway.ts` call `wikiApiFetch()` → Python backend.
Since wiki filesystem/git ops MUST stay in Python, these tools should KEEP proxying.
**Verdict: NO CHANGE** — wiki tools must stay as Python proxies.

### 11.2 Gemini MCP Tools (currently proxy to Python GeminiService)

The 3 Gemini tools proxy to Python. We already have `@google/genai` SDK in Next.js.
Could port `gemini_classify`, `gemini_draft`, `gemini_query` to call Gemini directly.

```
File: src/lib/mcp-gateway.ts
Change: gemini server tool handlers → direct @google/genai SDK calls
        instead of proxying to Python /ai/gemini/*
```

### 11.3 Search MCP Tool (already direct RAG search)

`search_wiki` already calls `ragSearch()` Server Action directly. ✅ No change needed.

### 11.4 Mutator MCP Tools (already direct Prisma)

All 4 mutator tools already use `prisma.ui_dashboards.create()` directly. ✅ No change needed.

---

## Phase 12: Frontend Pattern Completion

> **Effort:** Medium — per-page work
> **Impact:** Mobile UX + code maintainability

### 12.1 Mobile/Desktop Split (P1 from audit)

12 ERP pages still use Tailwind `sm:`/`lg:` prefixes. Apply the `useMediaQuery` pattern:

```tsx
// Current (bad):
<div className="flex flex-col sm:flex-row sm:items-center">

// Target (good):
const isMobile = useMediaQuery('(max-width: 768px)');
return isMobile ? <MobileAssetCard /> : <DesktopAssetTable />;
```

Priority pages: customers, accounts, assets, hr, payments, quotations, sales-orders

### 12.2 Shared Layout Components (P3 from audit)

Extract repeated patterns into `components/layout/`:

```
components/layout/
  page-header.tsx         // Title + subtitle + action button
  stat-grid.tsx           // Responsive stat card grid (2/3/4/5 cols)
  data-table.tsx          // Table with mobile card fallback
  search-bar.tsx          // Search + filter + refresh
```

### 12.3 Add loading.tsx + error.tsx for remaining pages

| Page | Status |
|------|--------|
| `app/enquiries/loading.tsx` | ❌ Missing |
| `app/enquiries/[id]/loading.tsx` | ❌ Missing |
| `app/notebooks/loading.tsx` | ❌ Missing |
| `app/notebooks/editor/[id]/loading.tsx` | ❌ Missing |
| `app/wiki/loading.tsx` | ❌ Missing |
| `app/documents/loading.tsx` | ❌ Missing |
| `app/ai/loading.tsx` | ❌ Missing |
| `app/settings/loading.tsx` | ❌ Missing |

---

## Priority Matrix

| Priority | Phase | Description | Effort | Impact |
|----------|-------|-------------|--------|--------|
| **P0** | 8 | Missing ERP endpoints (create actions) | Low | Medium — feature completeness |
| **P0** | 9 | Financial reports direct SQL | Medium-High | High — eliminates 5 Python proxies |
| **P1** | 10 | Business rules engine | Medium | Medium — server-side validation |
| **P1** | 12.1 | Mobile/Desktop split | Medium | Medium — mobile UX |
| **P2** | 11 | MCP tool handler full ports | Low | Low — minor latency improvement |
| **P2** | 12.2 | Shared layout components | Medium | Low — code cleanliness |
| **P2** | 12.3 | Remaining loading/error boundaries | Low | Low — polish |

---

## Architecture After All Phases

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS (PORT 3000)                          │
│                                                                 │
│  Server Components ─→ Server Actions ─→ Prisma (PostgreSQL)    │
│  ├── ERP pages (14 pages, all server components)               │
│  ├── Financial reports (5 direct SQL queries)                   │
│  ├── AI personas + chat UI                                     │
│  ├── RAG search (direct Gemini + pgvector)                      │
│  ├── MCP Gateway (9 servers, 22 tools)                          │
│  ├── Business rules engine                                     │
│  └── Wiki/Enquiry/Notebook CRUD                                │
│                                                                 │
│  API Routes (only for webhooks + file proxy)                    │
│  ├── /api/mcp/* (tool discovery + dispatch)                     │
│  ├── /api/webhooks/whatsapp (inbound)                           │
│  └── /api/document-image/[id] (file proxy)                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│               PYTHON MICROSERVICE (PORT 8001)                   │
│                                                                 │
│  Permanent responsibilities:                                    │
│  ├── /ai/chat/{id}     — AgentLoop (Gemini tool-calling)       │
│  ├── /ai/token         — Ephemeral Gemini token                │
│  ├── /ai/ui-plan       — Fast-track UI planning                │
│  ├── /ai/generate-*    — Image + TTS generation                │
│  ├── /document-upload  — GCS + Gemini vision + MarkItDown      │
│  ├── /wiki/maintenance — Git repo operations                   │
│  ├── /workflows/exec   — DAG execution engine                  │
│  ├── /pipeline/run     — Decisioning pipeline                  │
│  ├── /channels/webhook — WhatsApp/Telegram/Slack               │
│  ├── /py/generate-doc  — PDF (reportlab) + XLSX (openpyxl)    │
│  └── /ai/rag/ocr       — OCR image indexing                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**The Python backend becomes a thin, stateless AI/media/document microservice.**
**All CRUD, reporting, and business logic lives in Next.js.**
