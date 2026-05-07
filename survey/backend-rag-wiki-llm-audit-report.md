# Backend RAG / Wiki / LLM Architecture Audit

> **Date:** 2026-05-06  
> **Scope:** Complete inventory of AI, RAG, wiki, LLM, MCP, and document processing in `backend/`

---

## 1. RAG Pipeline

### Overview
Dual-route embedding system (v1 + v2) backed by **PostgreSQL + pgvector**. Supports text, image, and PDF embeddings with hybrid search (semantic + keyword).

### Key Files

| File | Purpose |
|---|---|
| `backend/app/services/rag.py` | Core RAG service: chunking, embedding, indexing, search |
| `backend/app/services/rag_postgres.py` | PostgreSQL/pgvector backend: schema, indexing, search |
| `backend/app/api/routes/ai.py` | HTTP endpoints for RAG search, wiki indexing, OCR image indexing |
| `backend/app/mcp_servers/search_server.py` | MCP server: `search_wiki`, `search_vertex`, `wiki_index_first` |
| `backend/app/mcp_servers/gateway.py` | Registers `rag_search` as MCP tool |

### Core Class: `RAGService` (`rag.py`)

| Method | Purpose |
|---|---|
| `chunk_markdown(text, source_path)` | Heading-aware chunking (1K chars, 200 overlap) |
| `embed_texts(texts, titles)` | Batch embeddings (v1: batches of 100; v2: individual) |
| `embed_query(query)` | Query embedding with LRU cache (max 500) |
| `embed_image(image_bytes, mime_type)` | Multimodal image embedding (v2 only) |
| `embed_pdf(pdf_bytes)` | Multimodal PDF embedding (v2 only) |
| `search(query, limit, method, modality)` | Hybrid/semantic/keyword search entrypoint |
| `index_wiki_page(path, content)` | Chunk + index a single wiki page |
| `index_wiki_all()` | Bulk index all wiki pages |
| `index_ocr_images(...)` | Index OCR-extracted image text |

### Embedding Models

| Route | Model | Provider | Dim | Features |
|---|---|---|---|---|
| **v2 (default)** | `gemini-embedding-2` | Vertex AI (SA + `us`) | 768 (truncated from 3072) | Multimodal: text, image, PDF |
| **v1** | `gemini-embedding-001` | Vertex AI (API key) | 768 | Text-only, batch up to 100 |

### Database: `rag_chunks` (PostgreSQL/pgvector)

```sql
id SERIAL PRIMARY KEY
source_path TEXT, heading TEXT, chunk_index INT, content TEXT
embedding VECTOR(768), char_start INT, char_end INT
modality TEXT DEFAULT 'text', tsv TSVECTOR, created_at TIMESTAMPTZ
```

Indexes: `ivfflat` on embedding, `GIN` on `tsv`.

### Search Strategies

1. **semantic** — cosine similarity (`embedding <=> vector`), threshold 0.3
2. **keyword** — PostgreSQL `ts_rank_cd` + `plainto_tsquery`
3. **hybrid (default)** — both, deduplicate by content prefix, sort by score

### External APIs
- Google Vertex AI Embeddings API (`genai.Client.models.embed_content`)

---

## 2. Wiki / Knowledge Base

### Overview
Git-versioned markdown repository on filesystem under `wiki/`. Four canonical folders + auto-indexed into RAG.

### Key Files

| File | Purpose |
|---|---|
| `backend/app/services/wiki.py` | Core wiki service: CRUD, search, git commit |
| `backend/app/services/wiki_loop.py` | Maintenance loop: scan → index.md → RAG re-index → orphan check |
| `backend/app/services/wiki_context.py` | Shared helper `build_wiki_context(query, limit)` |
| `backend/app/api/routes/wiki.py` | REST CRUD for wiki pages + search |
| `backend/app/mcp_servers/wiki_server.py` | MCP server: `wiki_read`, `wiki_write`, `wiki_search`, `wiki_list_pages` |

### Architecture

```
wiki/
├── index.md          # Auto-generated catalog
├── log.md            # Append-only change log
├── AGENTS.md         # Schema/conventions
├── entities/         # Clients, projects, products
├── concepts/         # Pricing, margins, templates
├── sources/          # Ingested documents
└── outcomes/         # Post-delivery learnings
```

### Wiki ↔ RAG Integration
- `RAGService.index_wiki_page()` — chunks + stores in `rag_chunks`
- `RAGService.index_wiki_all()` — bulk re-index
- AI chat flow: **first tries RAG semantic search**, falls back to wiki keyword search

---

## 3. LLM / AI Services

### Overview
All LLM interactions through **Google Gemini (Vertex AI)**. Tiered model strategy by task complexity.

### Key Files

| File | Purpose |
|---|---|
| `backend/app/services/gemini.py` | Classification, drafting, Q&A, PDF/image processing, image gen, TTS |
| `backend/app/services/agent_loop.py` | Full ReAct-style tool-calling agent loop |
| `backend/app/services/pipeline.py` | Hardcoded presales pipeline (Nodes 9–13) |
| `backend/app/agents/base.py` | Base agent + Ingest/Query/Drafting/Execute agents |
| `backend/app/api/routes/ai.py` | Persona CRUD, chat, RAG, image/speech generation |
| `backend/app/api/routes/channels.py` | Multi-channel webhooks (WhatsApp, Telegram, Slack) |

### Model Strategy

| Model | Role | Context |
|---|---|---|
| `gemini-3-flash-preview` | Classification, OCR, extraction | Fast, cheap, multimodal |
| `gemini-3.1-pro-preview` | Proposal drafting, reasoning, multi-PDF | Most capable, 1M token |
| `gemini-3.1-flash-image-preview` | Image generation | SA + global |
| `gemini-3.1-flash-tts-preview` | Text-to-speech | Audio output |

### Structured Output Schemas

- `EnquiryClassification` — category, subdivision, complexity, required docs, resource profile
- `StructuredProposal` — executive_summary, scope, deliverables, assumptions, pricing, timeline
- `INVOICE_SCHEMA` / `AUTO_DETECT_SCHEMA` — document upload extraction

### Database Models (`models/ai.py`)

| Model | Table | Key Fields |
|---|---|---|
| `Persona` | `ai_personas` | system prompt, model, temp, allowed_tools, allowed_mcp_servers, enable_knowledge_base |
| `AIConversation` | `ai_conversations` | persona_id, channel, title |
| `AIMessage` | `ai_messages` | role, content, tool_calls, tool_name, metadata_json |
| `ChannelConnector` | `channel_connectors` | channel_type, webhook_url, default_persona_id |
| `UIDashboard` | `ui_dashboards` | schema_json, ui_type, created_by_persona |

---

## 4. Document Processing (Two Pipelines)

### Pipeline A: Enquiry Documents (`documents.py` + `ingestion.py`)

```
Upload → MarkItDown → Markdown → Wiki sources/ → DB (markdown_content)
```

**Already uses MarkItDown!** `_convert_to_markdown()` calls `markitdown.MarkItDown.convert_local()`.

### Pipeline B: Entity-Agnostic Uploads (`document_upload.py`)

```
Upload → GCS → Gemini Vision → Structured JSON (invoice/receipt data)
                ↓
         Frontend: Image preview + JSON sidebar
```

**Does NOT use MarkItDown.** Only handles images/PDFs via Gemini structured extraction.

### Database: `UploadedDocument`

| Field | Purpose |
|---|---|
| `original_filename`, `content_type`, `file_size` | File metadata |
| `gcs_bucket`, `gcs_path` | GCS location |
| `doc_type` / `auto_detected_type` | invoice/receipt/contract/etc |
| `entity_type`, `entity_id` | Generic ERP linkage |
| `processing_status` | pending/processing/completed/failed |
| `extracted_data` | JSON string from Gemini |
| `confidence_score`, `error_message` | Quality metrics |

**Missing:** `markdown_content` — this is the integration point for unifying pipelines.

---

## 5. MCP (Model Context Protocol) Gateway

### Overview
Central tool registry with 9 MCP servers. Agents dynamically discover and call tools.

### Key File: `backend/app/mcp_servers/gateway.py`

| Server | Tools | Status |
|---|---|---|
| **wiki** | `wiki_read`, `wiki_write`, `wiki_search`, `wiki_list` | ✅ Active |
| **gemini** | `gemini_query`, `gemini_classify`, `gemini_draft` | ✅ Active |
| **erp** | Customer lookup, product catalog, stock, pricing | 🟡 Stub |
| **sap** | Material master, stock, sales order | 🟡 Stub |
| **outlook** | Send proposal, schedule meeting | 🟡 Stub |
| **document_output** | Generate PDF, quote, summary, document | ✅ Active |
| **search** | `rag_search`, `search_wiki`, `search_vertex`, `wiki_index_first` | ✅ Partially active |
| **mutator** | Generate UI form, dashboard, report, kanban | ✅ Active |
| **media** | `generate_image`, `generate_speech` | ✅ Active |

### Agent Loop Integration
- `AgentLoop._get_tool_declarations()` — builds Gemini `FunctionDeclaration` from gateway registry
- `AgentLoop._execute_tool()` — routes through `gateway.call_tool()`
- Personas filter tools via `allowed_tools` and `allowed_mcp_servers`

---

## 6. Supporting Systems

### Workflow / DAG Engine
- `models/workflow.py` — `Workflow`, `WorkflowNode`, `WorkflowEdge`, `WorkflowExecution`
- `services/workflow_executor.py` — topological execution with MCP tool nodes
- `api/routes/workflow.py` — CRUD + execution trigger

### Rules Engine
- `services/rules.py` — deterministic margin, approval, template, policy checks
- Runs **before** LLM in both hardcoded pipeline and DAG executor

### Notebooks
- `models/notebook.py` — Rich text documents stored in PostgreSQL
- `api/routes/notebooks.py` — CRUD (separate from wiki)

---

## 7. Configuration Map

| Env Var | Used By |
|---|---|
| `DATABASE_URL` | SQLAlchemy async engine |
| `GOOGLE_CLOUD_API_KEY` | Gemini generation client |
| `GCA_KEY` (SA JSON) | Embeddings, GCS, media generation |
| `GCP_PROJECT_ID` | GCP project |
| `GCS_BUCKET_NAME` | GCS uploads (default: `aries-raw-sources`) |
| `gemini_model` | Legacy default (`gemini-3-flash-preview`) |

---

## 8. Summary Matrix

| Capability | Files | External APIs | DB |
|---|---|---|---|
| **RAG (vector search)** | `rag.py`, `rag_postgres.py` | Vertex AI Embeddings | `rag_chunks` (pgvector) |
| **RAG (keyword search)** | `rag_postgres.py` | — | PostgreSQL `tsvector` |
| **Wiki** | `wiki.py`, `wiki_loop.py` | — | Filesystem + `rag_chunks` |
| **LLM Generation** | `gemini.py` | Vertex AI Generative AI | — |
| **LLM Agent Loop** | `agent_loop.py` | Vertex AI (tool calling) | `ai_messages` |
| **Structured Extraction** | `gemini.py`, `document_upload.py` | Vertex AI (JSON mode) | `uploaded_documents.extracted_data` |
| **Document → Markdown** | `ingestion.py` | — | `documents.markdown_content` |
| **MCP Tools** | `gateway.py` + 9 servers | Various | `ai_personas.allowed_tools` |
| **Workflow Engine** | `workflow_executor.py` | — | `workflow_*` tables |
| **Rules Engine** | `rules.py` | — | — |

---

## 9. Gaps & Opportunities

| # | Gap | Opportunity |
|---|---|---|
| 1 | **Pipeline A uses MarkItDown, Pipeline B does not** | Unify both under MarkItDown → Markdown + conditional Gemini JSON |
| 2 | **`UploadedDocument` has no `markdown_content`** | Add column; render Markdown in document viewer |
| 3 | **Document viewer only shows images + JSON** | Add Markdown tab for non-image docs (Word, Excel, PDF text) |
| 4 | **RAG only indexes wiki + OCR images** | Index `UploadedDocument` markdown_content for document search |
| 5 | **MCP search server has `search_vertex` stub** | Implement or remove |
| 6 | **ERP/SAP/Outlook MCP servers are stubs** | Implement with real API calls |
