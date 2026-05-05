"""MarkItDown document ingestion service (Node 4)."""

import uuid
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.enquiry import Document
from backend.app.services.wiki import WikiService


async def ingest_document(
    doc_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    db: AsyncSession,
) -> Document:
    """Convert a document to markdown via MarkItDown and write to wiki."""
    doc = await db.get(Document, doc_id)
    if not doc:
        raise ValueError(f"Document {doc_id} not found")

    doc.processing_status = "processing"
    await db.commit()

    try:
        markdown = await _convert_to_markdown(file_bytes, filename)
        doc.markdown_content = markdown

        # Write source page to wiki
        wiki = WikiService()
        source_page_path = f"sources/{doc.enquiry_id}/{Path(filename).stem}.md"
        wiki_content = _build_source_page(doc.enquiry_id, filename, markdown)
        wiki.write_page(source_page_path, wiki_content, f"Ingest source: {filename}")
        wiki.update_index()
        wiki.append_to_log("ingest", filename, f"Enquiry {doc.enquiry_id}")

        doc.wiki_source_page = source_page_path
        doc.processing_status = "completed"
    except Exception as e:
        doc.processing_status = "failed"
        raise e
    finally:
        await db.commit()

    return doc


async def _convert_to_markdown(file_bytes: bytes, filename: str) -> str:
    """Convert file bytes to markdown using MarkItDown. Security: uses convert_local() pattern."""
    import tempfile

    from markitdown import MarkItDown

    md = MarkItDown()

    # Write to temp file for safe local conversion
    suffix = Path(filename).suffix or ".bin"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        result = md.convert_local(tmp_path)
        return result.text_content
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def _build_source_page(enquiry_id: uuid.UUID, filename: str, markdown: str) -> str:
    """Build a wiki source page with metadata header."""
    from datetime import datetime, timezone

    header = (
        f"---\n"
        f"type: source\n"
        f"enquiry_id: {enquiry_id}\n"
        f"file: {filename}\n"
        f"ingested: {datetime.now(timezone.utc).isoformat()}\n"
        f"---\n\n"
    )
    title = f"# Source: {filename}\n\n"
    return header + title + markdown
