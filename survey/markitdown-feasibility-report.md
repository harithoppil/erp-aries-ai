# MarkItDown Integration Feasibility Report

> **Date:** 2026-05-06  
> **Context:** Aries ERP AI — Document Intelligence (Node 4) expansion  
> **Goal:** Enable `Any Document → Markdown → Rendered Preview + Side AI Analysis` workflow

---

## 1. What MarkItDown Is

[MarkItDown](https://github.com/microsoft/markitdown) is a lightweight Python utility built by Microsoft's AutoGen team for converting various file formats to Markdown. It is designed primarily for LLM consumption and text analysis pipelines — not high-fidelity human-readable conversion, but preserving headings, lists, tables, and links.

**Repository:** `/Users/harithoppil/Desktop/game/erp-aries-ai/tmp/markitdown-main/`

---

## 2. Coverage of Aries Flow Document Sources

The `aries_flow.md` (Node 4 — Document Intelligence) lists these input types:

| Source in `aries_flow.md` | MarkItDown Support | Converter |
|---|---|---|
| **PDF** | ✅ Native | `PdfConverter` (pdfminer + pdfplumber) |
| **Excel** | ✅ `.xlsx` & `.xls` | `XlsxConverter` / `XlsConverter` (pandas) |
| **Email** | ✅ Outlook `.msg` | `OutlookMsgConverter` (olefile) |
| **Word** | ✅ `.docx` | `DocxConverter` (mammoth) |
| **PowerPoint** | ✅ `.pptx` | `PptxConverter` (python-pptx) |
| **Images** | ✅ EXIF + optional LLM OCR | `ImageConverter` |
| **HTML** | ✅ Built-in | `HtmlConverter` |
| **ZIP** | ✅ Recursive iteration | `ZipConverter` |
| **Audio** | ✅ Transcription | `AudioConverter` (pydub + SpeechRecognition) |
| **YouTube** | ✅ Transcript fetch | `YouTubeConverter` |
| **CSV / JSON / XML** | ✅ Plain text | `PlainTextConverter` |

**Also supports:** EPUB, Jupyter notebooks, RSS feeds, Wikipedia URLs, Bing SERP.

**Conclusion:** MarkItDown covers **100%** of the document sources listed in `aries_flow.md` Node 4, plus additional formats.

---

## 3. Proposed Unified Document Flow

### Current Flow (Images Only)
```
File → GCS → Gemini Vision → JSON (invoice/receipt data)
                ↓
         Frontend: Image preview + JSON sidebar
```

### Proposed Unified Flow (Any Document)
```
Any Upload → GCS
     │
     ├─→ MarkItDown.convert_stream() ──→ Markdown ──→ DB (markdown_content)
     │                                          │
     │                                          └─→ RAG index (optional)
     │
     └─→ Gemini (conditional, by doc_type) ──→ Structured JSON ──→ DB (extracted_data)
```

### Frontend Display
Same tabbed layout as current document detail page:

| Tab | Content |
|---|---|
| **"Document"** | Rendered Markdown (headings, tables, lists) via `react-markdown` + `remark-gfm` |
| **"AI Analysis"** | Structured JSON (invoice fields, line items, etc.) — existing |
| **"Chat"** | AI assistant about the document — existing |

---

## 4. Integration Points

### 4.1 Backend Changes

| File | Change | Complexity |
|---|---|---|
| `pyproject.toml` | Add `markitdown[pdf,docx,xlsx,outlook]` dependency | Trivial |
| `backend/app/models/document.py` | Add `markdown_content: Mapped[Text]` to `UploadedDocument` | Trivial |
| Alembic migration | Auto-generate migration for new column | Trivial |
| `backend/app/services/ingestion.py` | Reuse existing `_convert_to_markdown()` — already uses MarkItDown! | Trivial |
| `backend/app/api/routes/document_upload.py` | Call MarkItDown after GCS upload, before/parallel to Gemini | Low |
| `backend/app/services/gcs.py` | Add `download_bytes()` (already exists) for stream conversion | Done ✅ |

### 4.2 Frontend Changes

| File | Change | Complexity |
|---|---|---|
| `documents/[id]/page.tsx` | Add "Document" tab with `ReactMarkdown` renderer | Low |
| `document-upload-panel.tsx` | Show file type icon + markdown preview option | Low |

### 4.3 Key API Usage

```python
from markitdown import MarkItDown
import io

md = MarkItDown()

# From bytes (our GCS download path)
stream = io.BytesIO(file_bytes)
result = md.convert_stream(stream)
markdown_text = result.markdown  # or result.text_content
```

---

## 5. Effort Estimate

| Task | Time |
|---|---|
| Install `markitdown` in `.venv` | 2 min |
| Add `markdown_content` column + Alembic migration | 10 min |
| Wire MarkItDown into upload processor | 20 min |
| Add Markdown preview tab to document viewer | 20 min |
| Test with PDF, Excel, Word, Image | 15 min |
| **Total** | **~1 hour** |

Out of scope (per request): Large document chunking, lazy rendering, pagination.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MarkItDown output not human-pretty | It's LLM-optimized; acceptable for our use case. Human users see the original file via download link. |
| Heavy dependencies (pandas, pdfplumber) | Install only needed extras: `[pdf,docx,xlsx,outlook]` |
| Large files (>10MB) slow conversion | Cap at 10MB inline; queue larger files for Celery (existing pattern) |
| Markdown tables render poorly | `remark-gfm` handles GitHub-flavored tables; already in deps |

---

## 7. Recommendation

**Proceed with integration.** MarkItDown is a perfect fit:

- ✅ Covers all document sources in `aries_flow.md`
- ✅ Python library → integrates directly into FastAPI
- ✅ Outputs Markdown → renders uniformly with `react-markdown`
- ✅ Bytes/stream API → works with our GCS download pipeline
- ✅ Already partially integrated (`ingestion.py` uses it)
- ✅ Low effort (~1 hour), high value (15+ formats in one pipeline)
