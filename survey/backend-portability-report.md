# Backend → Next.js API Routes Portability Report

> **Date:** 2026-05-06  
> **Scope:** Full audit of `/backend/app/` for migration to Next.js API routes  
> **Key constraint:** Next.js API routes have ~10–60s timeout on Vercel; persistent connections (WebSockets) are problematic.

---

## Executive Summary

**Verdict: HYBRID architecture is optimal.**

Move ~70% of the backend (stateless CRUD, ERP logic, workflows, AI chat orchestration, wiki management) to Next.js API routes. Keep a thin Python microservice for document ingestion (MarkItDown dependency) and PDF/Excel generation (reportlab/openpyxl).

---

## 1. API Routes (`app/api/routes/`)

| Route | Verdict | Rationale |
|---|---|---|
| `enquiries.py`, `erp.py`, `erp_financial_reports.py`, `notebooks.py`, `wiki.py`, `workflow.py` | **PORT** | Standard CRUD + pagination. Prisma + Next.js handles these natively. Financial reports use aggregates (`func.sum`, `group_by`) — Prisma `$queryRaw` or aggregate API covers this. |
| `ai.py` (personas, chat, dashboards) | **HYBRID** | Chat endpoint calls `AgentLoop` + `GeminiService`. The orchestration logic can move to TS, but the route currently saves messages to PostgreSQL inside the loop — doable with Prisma, but the tool-calling loop is complex to port. |
| `channels.py` (WhatsApp/Telegram/Slack webhooks) | **PORT** | Pure HTTP request/response. Node.js `fetch` replaces `httpx.AsyncClient`. HMAC verification is trivial in crypto. |
| `document_upload.py` | **KEEP** | Mixes `UploadFile` handling, GCS upload, **MarkItDown** conversion, and Gemini vision extraction in a single synchronous handler. MarkItDown is Python-only. |
| `documents.py` | **HYBRID** | Simple enquiry-document CRUD is portable. PDF-processing endpoints (`process-pdf`, `process-pdf-structured`) depend on `GeminiService` (portable) but also use in-memory job tracking that should move to Redis/BullMQ. |
| `pipeline.py` | **PORT** | Thin wrapper around `run_pipeline` service. |

**Blockers for full port:**
- FastAPI's `Depends(get_db)` DI pattern has no direct Next.js equivalent; you'll pass Prisma client explicitly.
- `UploadFile` + synchronous heavy processing in `document_upload.py` exceeds Next.js API route timeout limits (Vercel: 10–60 s). This needs to become an async job queue anyway.

---

## 2. Services (`app/services/`)

| Service | Verdict | Blockers |
|---|---|---|
| `rules.py` | **PORT** | Pure dataclasses + arithmetic. |
| `pipeline.py` | **PORT** | Orchestrates wiki + gemini + rules. No Python-specific deps. |
| `execution.py` | **PORT** | Parallel fan-out with `asyncio.gather`. Node.js `Promise.all` equivalent. |
| `workflow_executor.py` | **PORT** | DAG traversal + DB state machine. Pure logic. |
| `wiki.py` | **HYBRID** | Uses `gitpython` for repo operations. Node.js has `simple-git` or can shell out to `git`. However, wiki I/O is blocking and filesystem-bound; keeping it in a sidecar or using Node's `child_process` is fine. |
| `wiki_context.py`, `wiki_loop.py` | **PORT** | Depend only on `WikiService`. |
| `agent_loop.py` | **PORT** | Uses `google-genai` Python SDK for tool-calling (`types.FunctionDeclaration`, `types.Part.from_function_response`). The Node.js `@google/genai` SDK (already in frontend `package.json`) supports the same patterns. Retry logic (`tenacity`) → `p-retry` or `async-retry`. |
| `gemini.py` | **PORT** | Heavy use of `google-genai`: structured outputs (`response_json_schema`), image generation (`response_modalities=["IMAGE"]`), TTS (`response_modalities=["AUDIO"]`), PDF vision (`Part.from_bytes`). Node.js SDK supports these. **Minor friction:** config object shapes differ slightly between Python/TS. |
| `rag.py` | **HYBRID** | Chunking logic is pure text (portable). Uses `numpy` for L2 normalization on v1 embeddings. Node.js can normalize vectors natively or with `mathjs`. |
| `rag_postgres.py` | **HYBRID** | Direct `asyncpg` pool + raw SQL for pgvector (`embedding <=> $1::vector(768)`), `to_tsvector`, and `copy_records_to_table`. Prisma does not natively support the `vector` type or `COPY` protocol. You'd need `$queryRaw` + `pg` driver extensions. |
| `ingestion.py` | **KEEP** | Hard dependency on **`markitdown`** (Python-only). Converts Word/Excel/PPT → markdown. No mature Node.js equivalent. |
| `gcs.py` | **PORT** | Node.js `@google-cloud/storage` SDK is production-ready. |

---

## 3. Database

**Verdict: HYBRID**

- **Already mirrored in Prisma:** The frontend has a full `schema.prisma` matching every SQLAlchemy model (enquiries, ERP tables, workflows, AI personas, etc.). Standard CRUD, relations, and transactions map cleanly.
- **Blockers:**
  1. **pgvector:** Prisma has no native `vector` type. You must use `$queryRaw` for cosine-similarity search (`ORDER BY embedding <=> $1`), IVFFlat index creation, and `vector_cosine_ops`.
  2. **Bulk COPY:** `rag_postgres.py` uses `asyncpg.copy_records_to_table` for fast RAG indexing. Node.js `pg` requires `pg-copy-streams` or manual `COPY FROM STDIN` plumbing.
  3. **Complex aggregates:** Financial reports do nested-set tree traversal (`lft`/`rgt`) and running totals in application code, not SQL — that's portable. But some GL reports use `func.sum(...).group_by(...)` which is easier in Prisma's aggregate API or `$queryRaw`.

---

## 4. AI / LLM

**Verdict: PORT**

- **Gemini SDK parity:** Frontend already installs `@google/genai` (`^1.51.0`). The Node.js SDK supports:
  - Vertex AI (`vertexai: true`)
  - Tool calling / function declarations
  - Structured outputs (`responseSchema`)
  - Embeddings (`embedContent`)
  - Image generation (`generateContent` with `responseModalities: ["Image"]`)
  - TTS (`responseModalities: ["Audio"]` + `speechConfig`)
- **Agent loop:** The loop in `agent_loop.py` builds `types.Content` arrays and handles `function_call` / `function_response` parts. The Node.js SDK exposes equivalent `Content`, `Part`, `FunctionCall`, and `FunctionResponse` objects.
- **Blockers:**
  - `response_json_schema` (Python) vs `responseSchema` (Node.js) — verify exact field names in v1.51.
  - `tenacity` retry decorators → replace with `async-retry` or `p-retry`.
  - Service-account credential loading for embeddings (GCA_KEY JSON) works in Node.js via `google-auth-library`.

---

## 5. RAG Pipeline

**Verdict: HYBRID**

| Component | Portability |
|---|---|
| Text chunking (`chunk_markdown`) | **PORT** — regex + string ops. |
| Embedding generation (`embed_texts`, `embed_query`, `embed_image`) | **PORT** — Node.js `@google/genai` handles text + image + PDF embeddings. |
| Vector storage (`rag_chunks` table) | **HYBRID** — Prisma schema must store `embedding` as a raw string or use an extension; queries need `$queryRaw`. |
| Hybrid search (semantic + keyword) | **HYBRID** — semantic uses raw pgvector SQL; keyword uses `plainto_tsquery` / `ts_rank_cd`, also raw SQL. |
| Bulk indexing | **KEEP/HYBRID** — `copy_records_to_table` is fastest in Python; Node.js bulk insert is slower unless you use `pg-copy-streams`. |

**Blockers:**
- Prisma does not natively support `vector` or `tsvector` types. You'll need a custom type or raw SQL.
- `numpy` L2 normalization in v1 embeddings is trivial in JS (`vec.map(v => v / Math.sqrt(vec.reduce((a,b)=>a+b*b,0)))`).

---

## 6. Document Processing

**Verdict: KEEP** (or microservice)

| Step | Portability |
|---|---|
| Upload to GCS | **PORT** (`@google-cloud/storage`) |
| Gemini vision extraction (images/PDFs) | **PORT** (`@google/genai` with `Part.fromBytes`) |
| MarkItDown conversion (text docs) | **KEEP** — `markitdown` is Python-only. No Node.js package handles Word/Excel/PowerPoint → Markdown with the same fidelity. |
| Signed URL generation | **PORT** |

**Blockers:**
- `MarkItDown` is the single hardest dependency. If you must eliminate Python, you'd need to chain separate Node.js libraries (`mammoth` for Word, `xlsx` for Excel, `pdf-parse` for PDF) — but you'll lose unified formatting and Markdown quality.
- Current `document_upload.py` does processing **synchronously inside the HTTP handler**. Even in Python this should be a background job. In Next.js, this definitely needs a queue (BullMQ / Inngest / QStash) to avoid Vercel timeouts.

---

## 7. Workflow Engine

**Verdict: PORT**

- `workflow_executor.py` is a pure DAG walker. It loads nodes/edges from PostgreSQL, executes node handlers by `node_type`, and updates execution state.
- Node handlers call `GeminiService`, `WikiService`, `apply_rules`, etc. — all of which are portable.
- No Python-specific libraries.
- **Blocker:** `_node_execution` calls `execute_enquiry_actions` which fans out to MCP servers. If MCP servers stay in Python, the workflow executor in Node.js would call them via HTTP over the gateway — adds latency but works.

---

## 8. MCP Gateway

**Verdict: PORT** (with effort)

- The gateway (`gateway.py`) is a simple in-memory registry (`dict` of servers/tools). Trivial to rewrite.
- **MCP SDK:** Python uses `mcp.server.fastmcp`. There is an official **`@modelcontextprotocol/sdk`** TypeScript package. You can define MCP servers in Node.js.
- **Blockers:**
  - `document_output_server.py` uses **reportlab** (PDF) and **openpyxl** (Excel). These are Python-only. If you port the gateway, you either lose PDF/Excel generation or must keep a Python sidecar for those two tools.
  - Rewriting all ~9 MCP servers (wiki, gemini, erp, sap, outlook, search, mutator, media, document_output) is a large migration.

---

## 9. Real-time / Streaming

**Verdict: PORT**

- The backend currently has **zero** WebSocket or Server-Sent Event usage.
- Chat (`/ai/chat/{persona_id}`) returns a complete JSON response after the full agent loop finishes.
- WhatsApp/Telegram/Slack handlers are HTTP webhooks.
- **No blockers.** Next.js API routes handle this perfectly.

---

## 10. External APIs

| API | Node.js SDK | Status |
|-----|-------------|--------|
| Google Cloud Storage | `@google-cloud/storage` | ✅ Available |
| Vertex AI / Gemini | `@google/genai` | ✅ Already in frontend deps |
| Azure PostgreSQL | `pg` / `@prisma/client` | ✅ Already in use |
| Redis | `ioredis` / `redis` | ✅ Available |
| Outlook / Microsoft Graph | `@azure/msal-node` + Graph REST | ✅ Available |
| SAP | HTTP/ODATA clients (`axios`) | ✅ Available |

**No blockers.** All external services have mature Node.js SDKs.

---

## Recommended Architecture

```
┌─────────────────────────────────────────┐
│           Next.js Frontend              │
│  (React UI + Next.js API Routes)        │
├─────────────────────────────────────────┤
│  PORTED TO NEXT.JS                      │
│  • ERP CRUD (accounts, stock, HR, ...)  │
│  • Enquiries, Notebooks, Wiki pages     │
│  • Workflow engine & pipeline           │
│  • AI Chat + Agent Loop (Gemini TS SDK) │
│  • RAG search (Prisma + raw pgvector)   │
│  • Channels webhooks (WhatsApp/Slack)   │
│  • MCP Gateway (TS SDK)                 │
│  • Dashboards / Mutator UI schemas      │
├─────────────────────────────────────────┤
│  PYTHON SIDECAR (kept minimal)          │
│  • Document Ingestion (MarkItDown)      │
│  • PDF/Excel generation (reportlab,     │
│    openpyxl) if not replaced by TS libs │
│  • Optional: heavy async job worker     │
└─────────────────────────────────────────┘
```

### Migration Priority
1. **Phase 1:** Move all ERP CRUD + enquiries + notebooks to Next.js API routes (low risk, high value).
2. **Phase 2:** Port AI personas, chat, and RAG search (requires testing Node.js Gemini SDK parity).
3. **Phase 3:** Port workflow engine + MCP gateway.
4. **Phase 4:** Keep Python as a dedicated **document-ingestion microservice** exposing a single `/ingest` endpoint called by Next.js.
