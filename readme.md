# Aries ERP AI

AI-powered Enterprise Resource Planning system built for the marine industry. Combines a full-featured ERP suite with intelligent AI assistants, document processing, and workflow automation.

## Quick Start

```bash
# Terminal 1 — Backend (port 8001)
cd backend
source ../.venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 — Frontend (port 3000)
cd frontend
pnpm start
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8001/api/v1 |

## Overview

Aries ERP AI is a monorepo application with a FastAPI backend and Next.js frontend. It provides comprehensive business management — from accounting and invoicing to HR and procurement — augmented by a Gemini-powered AI layer that handles document extraction, knowledge retrieval, proposal drafting, and conversational assistance.

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| **AI / ML** | Google Gemini / Vertex AI, RAG pipeline (BM25 + sentence-transformers), MCP gateway |
| **Database** | PostgreSQL (production), SQLite (development), Redis + Celery (task queue) |
| **Infra** | Google Cloud Storage, Google Cloud Discovery Engine, OpenTelemetry |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Frontend (Next.js 16)                              │
│  ┌──────────┬──────────┬──────────┬───────────────┐ │
│  │ Dashboard │ ERP Mods │ AI Chat  │ Documents/Wiki│ │
│  └──────────┴──────────┴──────────┴───────────────┘ │
│         │ SWR + Zustand        │ Tiptap Editor      │
└─────────┼──────────────────────┼────────────────────┘
          │ REST /api/v1         │
┌─────────▼──────────────────────▼────────────────────┐
│  Backend (FastAPI)                                   │
│  ┌──────────┬──────────┬──────────┬───────────────┐ │
│  │ ERP Routes│ AI Svc   │ RAG Svc  │ Workflow Eng  │ │
│  └──────────┴──────────┴──────────┴───────────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │ MCP Gateway (Wiki, Gemini, ERP, SAP, Media...)  ││
│  └──────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────┐│
│  │ Agent Framework (Ingest, Query, Draft, Execute)  ││
│  └──────────────────────────────────────────────────┘│
└─────────┬───────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────┐
│  PostgreSQL / SQLite   │   Redis + Celery            │
│  Google Cloud Storage  │   Discovery Engine          │
└──────────────────────────────────────────────────────┘
```

---

## Backend

Located in `backend/`. A modular FastAPI application with business logic organized into routes, services, models, schemas, and agents.

### Key Directories

| Path | Purpose |
|------|---------|
| `app/api/routes/` | API endpoint definitions |
| `app/core/` | Config, database, auth, telemetry |
| `app/models/` | SQLAlchemy ORM models |
| `app/schemas/` | Pydantic validation schemas |
| `app/services/` | Business logic (Gemini, RAG, workflow) |
| `app/agents/` | Agent framework for multi-step workflows |
| `app/mcp_servers/` | Model Context Protocol server implementations |
| `migrations/` | Alembic database migrations |
| `tests/` | Test suite |

### API Routes

All endpoints are under `/api/v1`:

- **`/ai`** — AI personas, chat conversations, message history
- **`/erp`** — Full ERP: accounts, invoices, stock, projects, HR, procurement, payments
- **`/documents`** — Document CRUD and management
- **`/document-upload`** — Upload with structured extraction (invoices, receipts)
- **`/workflows`** — DAG-based workflow engine
- **`/enquiries`** — Customer enquiry lifecycle
- **`/mcp`** — MCP tool gateway

### AI & Intelligence

**Gemini Service** (`app/services/gemini.py`) — Enquiry classification, structured document extraction, proposal drafting, OCR/multimodal processing.

**RAG Pipeline** (`app/services/rag.py`) — Dual embedding models (Gemini embedding v2 and v1), chunking, hybrid search (full-text BM25 + semantic vector search).

**Agent Framework** (`app/agents/`):
- **Ingest Agent** — Document processing and wiki indexing
- **Query Agent** — Knowledge base Q&A
- **Drafting Agent** — Proposal generation with wiki context
- **Execute Agent** — Business process execution

**MCP Gateway** (`app/mcp_servers/gateway.py`) — Unified tool integration with discovery, auth, and rate limiting. Supports wiki, Gemini, ERP/SAP, document output, media, and Outlook integrations.

### Document Processing Pipeline

1. Upload files via `/api/v1/document-upload`
2. Store in Google Cloud Storage
3. Convert to markdown with MarkItDown
4. Index in wiki repository and search indexes
5. Support structured extraction via Gemini (invoices, receipts)

### ERP Models

Key SQLAlchemy models covering the full business domain:
- `Account` — Chart of accounts with nested-set tree for hierarchy traversal
- `SalesInvoice` — Invoicing with tax calculation and payment tracking
- `Project` — Project management with tasks and timesheets
- `Personnel` — Employee records and certifications
- `Workflow` — DAG-based workflow definitions
- `UploadedDocument` — Document processing status and metadata

---

## Frontend

Located in `frontend/`. A Next.js 16 App Router application with a nautical-inspired design system.

### Key Directories

| Path | Purpose |
|------|---------|
| `src/app/` | App Router pages (dashboard, ERP modules, AI, wiki) |
| `src/components/desktop/` | Desktop sidebar and layout |
| `src/components/mobile/` | Mobile navigation |
| `src/components/ui/` | Reusable shadcn/ui components |
| `src/hooks/` | Custom React hooks |
| `src/lib/` | API client (SWR), utilities, throttled fetch |
| `src/store/` | Zustand global state |
| `src/types/` | TypeScript API types |

### App Router Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard — command center with stats, heatmap, pipeline |
| `/ai` | Standalone AI chat with persona selection |
| `/enquiries` | Customer enquiry management with status tracking |
| `/erp/customers` | Customer and contact management |
| `/erp/quotations` | Quotation creation and tracking |
| `/erp/sales-orders` | Sales order processing |
| `/erp/stock` | Inventory and stock management |
| `/erp/finance` | Financial accounts and reporting |
| `/erp/journal-entries` | Journal entry management |
| `/erp/reports` | Financial report generation |
| `/erp/hr` | Personnel and HR management |
| `/erp/projects` | Project and timesheet tracking |
| `/erp/procurement` | Purchase orders and procurement |
| `/erp/payments` | Payment processing |
| `/documents` | Document management |
| `/notebooks` | Rich text editor (Tiptap) |
| `/wiki` | Knowledge base with search |
| `/pipeline` | Workflow automation |
| `/settings` | System settings |

### Design System

- Nautical color palette (sonar cyan, amber warnings, navy structural)
- Glass-morphism card design with subtle shadows
- Responsive three-panel desktop layout (sidebar + content + AI chat)
- Mobile-optimized with bottom navigation
- Dark mode by default
- Lucide icons throughout

### State Management

- **Zustand** — Global UI state (sidebar/chat visibility, chat history)
- **SWR** — Data fetching with automatic revalidation and caching
- **Custom throttled fetch** — Prevents API rate limiting

### Key Components

- **AppLayout** — Responsive three-panel layout with sidebar and chat toggle
- **Sidebar** — 20+ ERP module navigation, collapsible with active route highlighting
- **AiChatPanel** — Floating AI chat available on every page, with persona selection and quick actions
- **DocumentUploadPanel** — File upload with extraction progress

---

## Survey

Located in `survey/`. Contains UX/UI research documentation captured from a local ERPNext instance for the Phase 1 financial accounting module.

### Phase 1 Scope

The initial implementation focuses on core financial infrastructure:

1. **Chart of Accounts** — Tree view with nested hierarchy (AED currency)
2. **General Ledger** — Filterable report with date range and account selection
3. **Trial Balance** — Opening/closing balances with filter options
4. **Balance Sheet** — Asset/liability/equity reporting
5. **Profit & Loss** — Income statement with period comparison

### Key Files

| File | Content |
|------|---------|
| `phase1/1.0-accounting-invoicing-dashboard.md` | Accounting dashboard UI survey |
| `phase1/1.1-chart-of-accounts.md` | Chart of Accounts with sidebar and tree view |
| `phase1/1.2-financial-reports-list.md` | Financial reports landing page |
| `phase1/1.3-general-ledger.md` | General Ledger report with filters |
| `phase1/1.4-trial-balance.md` | Trial Balance report with filters |
| `phase1/phase1-analysis.md` | Full implementation plan — schemas, filters, build priorities |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+ and pnpm
- PostgreSQL (production) or SQLite (development)
- Redis (for Celery task queue)
- Google Cloud credentials (for AI/storage features)

### Backend Setup

```bash
# The project uses a shared virtualenv at the repo root
cd backend
source ../.venv/bin/activate

# Configure environment
cp .env.example .env
# Edit .env with your database URL, Gemini API key, GCS credentials, etc.

# Run database migrations
alembic upgrade head

# Start the server (port 8001)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend Setup

```bash
cd frontend
pnpm install

# Production build + start (recommended — lighter memory usage)
pnpm build && pnpm start

# Or dev mode (heavier memory, hot reload)
pnpm dev
```

| Service | URL | Command |
|---------|-----|---------|
| Frontend | http://localhost:3000 | `cd frontend && pnpm start` |
| Backend API | http://localhost:8001 | `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload` |

### Environment Variables

Key variables for the backend `.env` file:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL or SQLite connection string |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GOOGLE_CLOUD_PROJECT` | GCP project ID |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket |
| `REDIS_URL` | Redis connection for Celery |
| `CORS_ORIGINS` | Allowed CORS origins |

---

## Project Structure

```
erp-aries-ai/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # API endpoints
│   │   ├── agents/          # AI agent framework
│   │   ├── core/            # Config, database, auth
│   │   ├── models/          # SQLAlchemy models
│   │   ├── mcp_servers/     # MCP tool servers
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic
│   ├── migrations/          # Alembic migrations
│   └── tests/               # Test suite
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router pages
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # API client, utilities
│   │   ├── store/           # Zustand state
│   │   └── types/           # TypeScript types
│   └── prisma/              # Prisma schema
├── survey/
│   └── phase1/              # Phase 1 UX/UI research
├── scripts/                 # Migration and seed scripts
├── seed_data/               # Initial data
└── wiki/                    # Knowledge base content
```
