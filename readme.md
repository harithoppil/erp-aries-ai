# Aries ERP AI

AI-powered Enterprise Resource Planning system built for the marine industry. Combines a full-featured ERP suite with intelligent AI assistants, document processing, and workflow automation.

## Quick Start

```bash
# Terminal 1 — Next.js frontend (port 3000)
bun install
bun run dev

# Terminal 2 — Python backend (port 8001) — required for AI/wiki/pipeline only
cd backend
source ../.venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

| Service | URL | Required For |
|---------|-----|-------------|
| Next.js | http://localhost:3000 | All ERP + UI |
| Python API | http://localhost:8001/api/v1 | AI chat, wiki, pipeline, MCP media |

## Commands

### Next.js (Bun)

```bash
bun install                    # Install dependencies
bun run dev                    # Dev server with hot reload (port 3000)
bun run build                  # Production build
bun run start                  # Production server (port 3000)
```

### Prisma (via npx — must use Node.js, not Bun runtime)

```bash
npx prisma generate            # Generate Prisma client from schema
npx prisma db push             # Push schema to database (no migrations)
npx prisma migrate dev         # Create and apply migrations
npx prisma studio              # Visual database browser
```

### Python Backend

```bash
cd backend
source ../.venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| **Runtime** | Bun (package manager), Node.js (execution runtime) |
| **ORM** | Prisma 5.22 (PostgreSQL) |
| **Backend** | FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| **AI / ML** | Google Gemini / Vertex AI, google-auth-library (local token minting) |
| **Document Processing** | MarkItDown (Node.js port — 9 converters, no Python dependency) |
| **Database** | PostgreSQL (production), SQLite (development) |
| **State** | Zustand (global), Server Actions + useEffect (data fetching) |

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router) — Bun + Node.js runtime        │
│  ┌──────────┬──────────┬──────────┬───────────────────┐ │
│  │ Dashboard │ ERP Mods │ AI Chat  │ Notebooks/Wiki     │ │
│  └──────────┴──────────┴──────────┴───────────────────┘ │
│         │ Server Actions   │ Tiptap Editor              │
│         │ + Prisma ORM     │ + AI Sidebar               │
│  ┌──────────────────────────────────────────────────────┐│
│  │ MarkItDown (9 converters: PDF, DOCX, XLSX, CSV,    ││
│  │  HTML, Image, ZIP, MSG, Text) — /api/markitdown     ││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │ AI Tool Adapters (Gemini / OpenAI / Anthropic)       ││
│  │ google-auth-library — local OAuth token minting      ││
│  └──────────────────────────────────────────────────────┘│
└─────────┬─────────────────────────────────────────────────┘
          │ Prisma (ERP + Enquiries + Notebooks) ✅ Ported
          │ REST proxy (AI chat, wiki, pipeline, MCP) ❌ Still Python
┌─────────▼─────────────────────────────────────────────────┐
│  FastAPI Backend (port 8001) — only for unported services  │
│  ┌──────────┬──────────┬──────────┬──────────────────┐   │
│  │ AgentLoop │ Wiki Svc │ Pipeline │ MCP Gateway       │   │
│  └──────────┴──────────┴──────────┴──────────────────┘   │
└─────────┬─────────────────────────────────────────────────┘
          │
┌─────────▼─────────────────────────────────────────────────┐
│  PostgreSQL  │  Google Cloud Storage  │  Discovery Engine  │
└───────────────────────────────────────────────────────────┘
```

## What's Ported to Next.js (No Python Needed)

| Feature | Implementation | Details |
|---------|---------------|---------|
| **ERP Modules** (12) | Prisma Server Actions | Customers, invoices, quotations, sales orders, stock, procurement, projects, assets, HR, payments, timesheets, journal entries |
| **Financial Reports** | Prisma raw SQL | General ledger, trial balance, balance sheet, profit & loss |
| **Enquiries** | Prisma Server Actions | CRUD + status transitions + approval (actions.ts) |
| **Notebooks** | Prisma Server Actions | CRUD with Tiptap rich-text editor (actions.ts) |
| **Gemini Token** | google-auth-library | Local OAuth minting from GCA_KEY — no Python proxy |
| **MarkItDown** | Node.js API route | 9 converters (PDF, DOCX, XLSX, CSV, HTML, Image, ZIP, MSG, Text) |
| **Auth** | NextAuth.js | Session management |
| **Business Rules** | Zod validators | Client-side + server-side |
| **RAG Search** | pgvector + Prisma | Vector search + keyword search (wiki content fetch still Python) |

## What Still Needs the Python Backend

| Feature | Python Endpoint | Blocker |
|---------|----------------|---------|
| **AI Chat (AgentLoop)** | `/ai/chat/{personaId}` | Multi-step Gemini orchestration loop |
| **Wiki CRUD** | `/wiki/*` | Git-vaulted markdown repo — not in Postgres |
| **Pipeline Execution** | `/pipeline/*` | Multi-step AI orchestration (classify → draft → review → approve) |
| **Document Upload/OCR** | `/document-upload/*` | Upload → MarkItDown → Gemini extract → DB write |
| **Notebook AI Assist** | `/ai/chat/presales_assistant` | SSE streaming chat (editor sidebar) |
| **MCP: Media Gen** | `/ai/generate-media` | Gemini Imagen + TTS from Node.js |
| **MCP: Doc Output** | `/documents/generate` | PDF/Excel generation |

---

## Project Structure

```
erp-aries-ai/
├── app/                        # Next.js App Router
│   ├── page.tsx                # Dashboard (command center)
│   ├── ai/                     # AI chat page + actions
│   ├── api/                    # API routes
│   │   ├── auth/               # NextAuth session
│   │   ├── markitdown/         # Document conversion endpoint
│   │   ├── mcp/                # MCP gateway proxy
│   │   └── document-image/     # Document image serving
│   ├── auth/                   # Auth pages
│   ├── channels/               # Channel connectors
│   ├── documents/              # Document management
│   ├── enquiries/              # Enquiry CRUD + status workflow
│   ├── erp/                    # 12 ERP modules + reports
│   ├── notebooks/              # Tiptap rich-text editor + AI sidebar
│   ├── pipeline/               # Workflow automation
│   ├── settings/               # System + RAG settings
│   └── wiki/                   # Knowledge base
├── components/                 # Shared React components
│   ├── desktop/                # Desktop sidebar + layout
│   ├── mobile/                 # Mobile navigation
│   ├── ui/                     # shadcn/ui primitives
│   └── document-upload-panel.tsx
├── hooks/                      # Custom React hooks
├── lib/                        # Core libraries
│   ├── prisma.ts               # Prisma client singleton
│   ├── api-base.ts             # Python backend URL
│   ├── api.ts                  # Legacy SWR hooks (being phased out)
│   ├── gemini-client.ts        # Gemini API + UI action planner
│   ├── ai-tool-adapters.ts    # Provider-agnostic tool conversion
│   ├── markitdown/             # MarkItDown engine + 9 converters
│   └── mcp-gateway.ts          # MCP tool gateway
├── store/                      # Zustand global state
│   ├── useAppStore.ts          # App state + page context
│   └── useActionDispatcher.ts  # AI action registry (typed JSON Schema)
├── types/                      # TypeScript type declarations
│   ├── api.ts                  # API types + STATUS_COLORS
│   └── turndown-plugin-gfm.d.ts
├── prisma/                     # Prisma schema + migrations
│   └── schema.prisma
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/routes/         # API endpoints
│   │   ├── agents/             # AI agent framework
│   │   ├── core/               # Config, database, auth
│   │   ├── models/             # SQLAlchemy models
│   │   ├── mcp_servers/        # MCP tool servers
│   │   ├── schemas/            # Pydantic schemas
│   │   └── services/           # Business logic (Gemini, RAG, wiki)
│   ├── migrations/             # Alembic migrations
│   └── tests/
├── survey/                     # UX/UI research (Phase 1 accounting)
├── scripts/                    # Migration and seed scripts
├── seed_data/                  # Initial data
├── tmp/                        # Temporary / scratch files
└── wiki/                       # Knowledge base content (git-vaulted)
```

---

## Environment Variables

| Variable | Where Used | Description |
|----------|-----------|-------------|
| `DATABASE_URL` | Next.js + Backend | PostgreSQL connection string |
| `GEMINI_API_KEY` | Next.js | Google Gemini API key |
| `GCA_KEY` | Next.js | Google service account JSON (for local OAuth token minting) |
| `GOOGLE_CLOUD_PROJECT` | Backend | GCP project ID |
| `GCS_BUCKET_NAME` | Backend | Google Cloud Storage bucket |
| `NEXTAUTH_SECRET` | Next.js | NextAuth encryption key |
| `NEXT_PUBLIC_API_URL` | Next.js | Python backend URL (default: http://localhost:8001/api/v1) |

---

## Backend (Python)

Located in `backend/`. A modular FastAPI application with business logic organized into routes, services, models, schemas, and agents. Only needed for features not yet ported to Next.js.

### API Routes (under `/api/v1`)

- **`/ai`** — AI personas, chat conversations, message history, token minting
- **`/erp`** — Full ERP: accounts, invoices, stock, projects, HR, procurement, payments (legacy — superseded by Prisma Server Actions)
- **`/enquiries`** — Customer enquiry lifecycle (legacy — superseded by Prisma Server Actions)
- **`/notebooks`** — Notebook CRUD (legacy — superseded by Prisma Server Actions)
- **`/documents`** — Document CRUD and management
- **`/document-upload`** — Upload with structured extraction (invoices, receipts)
- **`/wiki`** — Git-vaulted wiki CRUD + search
- **`/pipeline`** — Enquiry pipeline execution
- **`/mcp`** — MCP tool gateway (media generation, document output)

### AI & Intelligence

**Gemini Service** — Enquiry classification, structured document extraction, proposal drafting, OCR/multimodal processing.

**RAG Pipeline** — Dual embedding models, chunking, hybrid search (full-text BM25 + semantic vector search).

**Agent Framework** — Ingest Agent (document processing), Query Agent (knowledge Q&A), Drafting Agent (proposal generation), Execute Agent (business process execution).

**MCP Gateway** — Unified tool integration with wiki, Gemini, ERP/SAP, document output, media, and Outlook integrations.

---

## Survey

Located in `survey/`. Contains UX/UI research documentation captured from a local ERPNext instance for the Phase 1 financial accounting module.

### Phase 1 Scope

1. **Chart of Accounts** — Tree view with nested hierarchy
2. **General Ledger** — Filterable report with date range and account selection
3. **Trial Balance** — Opening/closing balances with filter options
4. **Balance Sheet** — Asset/liability/equity reporting
5. **Profit & Loss** — Income statement with period comparison
