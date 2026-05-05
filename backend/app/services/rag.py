"""RAG Pipeline — chunking, embeddings, and vector search.

Dual embedding routes:
- gemini-embedding-2 (v2): Multimodal (text + images), prompt-based task instructions,
  auto-normalized, SA + location='us', individual calls.
- gemini-embedding-001 (v1): Text-only, task_type based, manual normalization,
  API key + no location, batch (up to 100).

Both share the same chunking, FTS5 keyword search, and cosine similarity logic.
Each route has its own DB table to keep embedding spaces separate.
"""

import asyncio
import json
import logging
import re
import sqlite3
from pathlib import Path
from typing import NamedTuple

import numpy as np
from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable

from backend.app.core.config import settings

logger = logging.getLogger("aries.rag")

# --- Embedding retry config ---
_embedding_retry = retry(
    retry=retry_if_exception_type((ResourceExhausted, ServiceUnavailable, Exception)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    before_sleep=lambda rs: logger.warning(
        "Embedding API rate limit hit on attempt %d for %s, retrying in %ss",
        rs.attempt_number,
        rs.fn.__name__ if rs.fn else "unknown",
        rs.next_action.sleep if rs.next_action else 0,
    ),
    reraise=True,
)

# --- Embedding models ---
# v2: Multimodal (text + images), prompt-based, auto-normalized, SA + 'us'
EMBEDDING_MODEL_V2 = "gemini-embedding-2"
# v1: Text-only, task_type based, manual normalization, API key + no location
EMBEDDING_MODEL_V1 = "gemini-embedding-001"
EMBEDDING_DIM = 768  # truncated from 3072 via output_dimensionality

# Chunking parameters
CHUNK_SIZE = 1000  # target characters per chunk
CHUNK_OVERLAP = 200  # overlap characters between chunks
MIN_CHUNK_SIZE = 100  # don't create chunks smaller than this


class Chunk(NamedTuple):
    content: str
    metadata: dict  # source_path, heading, chunk_index, char_start, char_end


class SearchResult(NamedTuple):
    content: str
    score: float
    metadata: dict


# --- v2 prompt-based helpers (gemini-embedding-2) ---

def _prepare_document_v2(title: str, content: str) -> str:
    """Format a document for v2 embedding — prompt-based task instruction.

    Format: "title: {title} | text: {content}"
    """
    title = title or "none"
    return f"title: {title} | text: {content}"


def _prepare_query_v2(query: str) -> str:
    """Format a query for v2 embedding — prompt-based task instruction.

    Format: "task: search result | query: {query}"
    """
    return f"task: search result | query: {query}"


# --- v1 task_type helpers (gemini-embedding-001) ---
# No special formatting needed — raw text + task_type parameter handles it.


class RAGService:
    """RAG pipeline: chunk → embed → store → search.

    Supports two embedding routes:
    - v2 (default): gemini-embedding-2 — multimodal, prompt-based, auto-normalized
    - v1: gemini-embedding-001 — text-only, task_type, manual normalization, batch

    Each route has its own DB table (chunks_v2 / chunks_v1) to keep
    embedding spaces separate and avoid cross-contamination.
    """

    # Allowlist of valid table/FTS names — prevents SQL injection via f-strings
    _VALID_TABLES = {"chunks_v1", "chunks_v2"}
    _VALID_FTS = {"chunks_v1_fts", "chunks_v2_fts"}

    def __init__(self, route: str = "v2"):
        """Initialize RAG service with the specified embedding route.

        Args:
            route: "v2" (default) for gemini-embedding-2, or "v1" for gemini-embedding-001

        Raises:
            ValueError: If the route is not "v1" or "v2".
        """
        if route not in ("v1", "v2"):
            raise ValueError(f"Invalid route: {route!r}. Use 'v1' or 'v2'.")
        self.route = route
        self.model = EMBEDDING_MODEL_V2 if route == "v2" else EMBEDDING_MODEL_V1
        self.table = f"chunks_{route}"
        self.fts_table = f"chunks_{route}_fts"

        # Validate table names against allowlist to prevent SQL injection
        if self.table not in self._VALID_TABLES:
            raise ValueError(f"Invalid table name: {self.table!r}")
        if self.fts_table not in self._VALID_FTS:
            raise ValueError(f"Invalid FTS table name: {self.fts_table!r}")

        # v2 uses SA + 'us', v1 uses API key + no location
        if route == "v2":
            self.client = settings.get_embedding_client()
        else:
            self.client = settings.get_genai_client()

        self.db_path = Path(settings.database_url.replace("sqlite+aiosqlite:///", "")).parent / "rag_store.db"
        self._query_cache: dict[str, list[float]] = {}
        self._init_db()

    def _init_db(self):
        """Initialize the RAG vector store database."""
        conn = sqlite3.connect(str(self.db_path))

        # --- v2 table (multimodal, with modality column) ---
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks_v2 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL,
                heading TEXT,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                char_start INTEGER,
                char_end INTEGER,
                modality TEXT DEFAULT 'text',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_v2_source ON chunks_v2(source_path)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_v2_modality ON chunks_v2(modality)
        """)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_v2_fts USING fts5(
                content,
                heading,
                source_path,
                content='chunks_v2',
                content_rowid='id'
            )
        """)

        # --- v1 table (text-only, no modality column) ---
        conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks_v1 (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_path TEXT NOT NULL,
                heading TEXT,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                char_start INTEGER,
                char_end INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_v1_source ON chunks_v1(source_path)
        """)
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_v1_fts USING fts5(
                content,
                heading,
                source_path,
                content='chunks_v1',
                content_rowid='id'
            )
        """)

        conn.commit()
        conn.close()

    # --- Chunking ---

    @staticmethod
    def chunk_markdown(text: str, source_path: str = "") -> list[Chunk]:
        """Split markdown text into chunks respecting heading boundaries.

        Each chunk starts at a heading and includes all content until the
        next heading of equal or higher level. Oversized sections are
        split with overlap.
        """
        chunks = []

        # Split by headings (## or ### etc.)
        heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
        sections: list[tuple[str, str]] = []  # (heading, content)

        last_end = 0
        current_heading = source_path or "root"

        for match in heading_pattern.finditer(text):
            # Content before this heading belongs to the previous section
            if sections:
                sections[-1] = (sections[-1][0], sections[-1][1] + text[last_end:match.start()])
            else:
                preamble = text[last_end:match.start()].strip()
                if preamble:
                    sections.append(("root", preamble))

            current_heading = match.group(2).strip()
            sections.append((current_heading, ""))
            last_end = match.end()

        # Add remaining content to last section
        if sections:
            sections[-1] = (sections[-1][0], sections[-1][1] + text[last_end:])
        elif text.strip():
            sections.append(("root", text))

        # Now split oversized sections into chunks
        for heading, content in sections:
            content = content.strip()
            if not content:
                continue

            if len(content) <= CHUNK_SIZE:
                chunks.append(Chunk(
                    content=content,
                    metadata={
                        "source_path": source_path,
                        "heading": heading,
                        "chunk_index": len(chunks),
                    },
                ))
            else:
                # Split with overlap
                start = 0
                while start < len(content):
                    end = start + CHUNK_SIZE
                    chunk_text = content[start:end]

                    # Try to break at paragraph boundary
                    if end < len(content):
                        para_break = chunk_text.rfind('\n\n', -CHUNK_OVERLAP)
                        if para_break > MIN_CHUNK_SIZE:
                            end = start + para_break + 2
                            chunk_text = content[start:end]

                    chunk_text = chunk_text.strip()
                    if len(chunk_text) >= MIN_CHUNK_SIZE:
                        chunks.append(Chunk(
                            content=chunk_text,
                            metadata={
                                "source_path": source_path,
                                "heading": heading,
                                "chunk_index": len(chunks),
                                "char_start": start,
                                "char_end": end,
                            },
                        ))

                    start = end - CHUNK_OVERLAP if end < len(content) else end

        return chunks

    # --- Embedding ---

    async def embed_texts(self, texts: list[str], titles: list[str] | None = None) -> list[list[float]]:
        """Generate embeddings for a list of texts.

        v2: prompt-based task instructions, individual calls (v2 aggregates multi-input).
        v1: task_type=RETRIEVAL_DOCUMENT, batch up to 100.
        """
        if not texts:
            return []

        if titles is None:
            titles = [None] * len(texts)

        embeddings = []

        if self.route == "v2":
            # v2: Embed documents individually — aggregates multi-input into one vector
            for i, (text, title) in enumerate(zip(texts, titles)):
                try:
                    prepared = _prepare_document_v2(title or "none", text)

                    @_embedding_retry
                    def _embed_single_v2(prepared_text):
                        return self.client.models.embed_content(
                            model=self.model,
                            contents=prepared_text,
                            config=types.EmbedContentConfig(
                                output_dimensionality=EMBEDDING_DIM,
                            ),
                        )

                    result = _embed_single_v2(prepared)
                    embeddings.append(result.embeddings[0].values)
                except Exception as e:
                    logger.error("v2 embedding failed for doc %d: %s", i, e)
                    embeddings.append([0.0] * EMBEDDING_DIM)
        else:
            # v1: Batch up to 100 texts per call with task_type
            for i in range(0, len(texts), 100):
                batch = texts[i:i + 100]
                try:

                    @_embedding_retry
                    def _embed_batch_v1(batch_texts):
                        return self.client.models.embed_content(
                            model=self.model,
                            contents=batch_texts,
                            config=types.EmbedContentConfig(
                                task_type="RETRIEVAL_DOCUMENT",
                                output_dimensionality=EMBEDDING_DIM,
                            ),
                        )

                    result = _embed_batch_v1(batch)
                    for emb in result.embeddings:
                        vec = np.array(emb.values, dtype=np.float32)
                        # Manual normalization for v1 (not auto-normalized)
                        norm = np.linalg.norm(vec)
                        if norm > 0:
                            vec = vec / norm
                        embeddings.append(vec.tolist())
                except Exception as e:
                    logger.error("v1 embedding failed for batch %d: %s", i // 100, e)
                    for _ in batch:
                        embeddings.append([0.0] * EMBEDDING_DIM)

        return embeddings

    async def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a single query.

        v2: prompt-based task instruction "task: search result | query: {query}"
        v1: task_type=RETRIEVAL_QUERY, manual normalization

        Results are cached by normalized query string (LRU-like, max 500 entries).
        """
        cache_key = query.lower().strip()
        if cache_key in self._query_cache:
            return self._query_cache[cache_key]

        try:
            if self.route == "v2":
                prepared = _prepare_query_v2(query)

                @_embedding_retry
                def _embed_query_v2(prepared_text):
                    return self.client.models.embed_content(
                        model=self.model,
                        contents=prepared_text,
                        config=types.EmbedContentConfig(
                            output_dimensionality=EMBEDDING_DIM,
                        ),
                    )

                result = _embed_query_v2(prepared)
                embedding = result.embeddings[0].values
            else:
                # v1: task_type based, manual normalization

                @_embedding_retry
                def _embed_query_v1(query_text):
                    return self.client.models.embed_content(
                        model=self.model,
                        contents=[query_text],
                        config=types.EmbedContentConfig(
                            task_type="RETRIEVAL_QUERY",
                            output_dimensionality=EMBEDDING_DIM,
                        ),
                    )

                result = _embed_query_v1(query)
                vec = np.array(result.embeddings[0].values, dtype=np.float32)
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                embedding = vec.tolist()

            self._query_cache[cache_key] = embedding
            # Keep cache bounded
            if len(self._query_cache) > 500:
                self._query_cache.pop(next(iter(self._query_cache)))
            return embedding
        except Exception as e:
            logger.error("Query embedding failed: %s", e)
            return [0.0] * EMBEDDING_DIM

    async def embed_image(self, image_bytes: bytes, mime_type: str = "image/jpeg",
                          title: str = "none") -> list[float]:
        """Generate embedding for an image (v2 only — multimodal).

        Combines a text description with the image in the same embedding space,
        enabling cross-modal search (text query → image result).
        Not supported on v1 (text-only model).
        """
        if self.route == "v1":
            logger.warning("Image embedding not supported on v1 (text-only model)")
            return [0.0] * EMBEDDING_DIM

        try:
            prepared_text = _prepare_document_v2(title, "invoice image")
            contents = [
                prepared_text,
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            ]

            result = self.client.models.embed_content(
                model=self.model,
                contents=contents,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error("Image embedding failed: %s", e)
            return [0.0] * EMBEDDING_DIM

    async def embed_pdf(self, pdf_bytes: bytes, title: str = "none") -> list[float]:
        """Generate embedding for a PDF document (v2 only — multimodal).

        gemini-embedding-2 supports PDFs up to 6 pages inline.
        Not supported on v1 (text-only model).
        """
        if self.route == "v1":
            logger.warning("PDF embedding not supported on v1 (text-only model)")
            return [0.0] * EMBEDDING_DIM

        try:
            prepared_text = _prepare_document_v2(title, "pdf document")
            contents = [
                prepared_text,
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            ]

            result = self.client.models.embed_content(
                model=self.model,
                contents=contents,
                config=types.EmbedContentConfig(
                    output_dimensionality=EMBEDDING_DIM,
                ),
            )
            return result.embeddings[0].values
        except Exception as e:
            logger.error("PDF embedding failed: %s", e)
            return [0.0] * EMBEDDING_DIM

    # --- Storage ---

    async def index_chunks(self, chunks: list[Chunk]) -> int:
        """Embed and store chunks in the vector store (route-specific table)."""
        if not chunks:
            return 0

        texts = [c.content for c in chunks]
        titles = [c.metadata.get("heading") for c in chunks]
        embeddings = await self.embed_texts(texts, titles=titles)

        # Prepare data for sync insertion
        rows = []
        for chunk, embedding in zip(chunks, embeddings):
            emb_bytes = np.array(embedding, dtype=np.float32).tobytes()
            rows.append((chunk, emb_bytes))

        count = await asyncio.to_thread(self._index_chunks_sync, rows)
        logger.info("Indexed %d chunks into %s from %s", count, self.table, chunks[0].metadata.get("source_path", ""))
        return count

    def _index_chunks_sync(self, rows: list[tuple]) -> int:
        """Synchronous chunk insertion — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        count = 0
        for chunk, emb_bytes in rows:
            if self.route == "v2":
                conn.execute(
                    f"""INSERT INTO {self.table} (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                    (
                        chunk.metadata.get("source_path", ""),
                        chunk.metadata.get("heading", ""),
                        chunk.metadata.get("chunk_index", 0),
                        chunk.content,
                        emb_bytes,
                        chunk.metadata.get("char_start"),
                        chunk.metadata.get("char_end"),
                        "text",
                    ),
                )
            else:
                # v1: no modality column
                conn.execute(
                    f"""INSERT INTO {self.table} (source_path, heading, chunk_index, content, embedding, char_start, char_end)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        chunk.metadata.get("source_path", ""),
                        chunk.metadata.get("heading", ""),
                        chunk.metadata.get("chunk_index", 0),
                        chunk.content,
                        emb_bytes,
                        chunk.metadata.get("char_start"),
                        chunk.metadata.get("char_end"),
                    ),
                )
            count += 1

        conn.commit()
        conn.close()
        return count

    async def index_image(self, image_path: str, source_path: str,
                          title: str = "none") -> int:
        """Embed and store an image in the vector store for cross-modal search (v2 only)."""
        if self.route == "v1":
            logger.warning("Image indexing not supported on v1 (text-only model)")
            return 0

        path = Path(image_path)
        if not path.exists():
            logger.error("Image not found: %s", image_path)
            return 0

        # Determine MIME type
        suffix = path.suffix.lower()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
        mime_type = mime_map.get(suffix, "image/jpeg")

        image_bytes = path.read_bytes()
        embedding = await self.embed_image(image_bytes, mime_type=mime_type, title=title)

        emb_bytes = np.array(embedding, dtype=np.float32).tobytes()

        await asyncio.to_thread(
            self._index_image_sync, source_path, title, path.name, emb_bytes
        )
        logger.info("Indexed image %s as %s", path.name, source_path)
        return 1

    def _index_image_sync(self, source_path: str, title: str, filename: str, emb_bytes: bytes):
        """Synchronous image insertion — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        conn.execute(
            f"""INSERT INTO {self.table} (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (source_path, title, 0, f"[Image: {filename}]", emb_bytes, 0, 0, "image"),
        )
        conn.commit()
        conn.close()

    async def index_wiki_page(self, path: str, content: str) -> int:
        """Chunk a wiki page and index it into the vector store."""
        # Delete existing chunks for this path
        await self._delete_path(path)

        chunks = self.chunk_markdown(content, source_path=path)
        return await self.index_chunks(chunks)

    async def index_wiki_all(self) -> dict:
        """Index all wiki pages into the RAG store."""
        from backend.app.services.wiki import WikiService
        wiki = WikiService()
        pages = wiki.list_pages()

        total_chunks = 0
        indexed_pages = 0
        errors = []

        for page_path in pages:
            page = wiki.read_page(page_path)
            if not page:
                continue
            try:
                count = await self.index_wiki_page(page_path, page.content)
                total_chunks += count
                indexed_pages += 1
            except Exception as e:
                errors.append(f"{page_path}: {e}")
                logger.error("Failed to index wiki page %s: %s", page_path, e)

        return {
            "indexed_pages": indexed_pages,
            "total_chunks": total_chunks,
            "errors": errors,
        }

    async def index_ocr_images(self, images_dir: str, limit: int | None = None) -> dict:
        """Index OCR invoice images into the vector store for cross-modal search.

        This enables searching for invoices by text description and finding
        matching images (cross-modal retrieval).
        """
        images_path = Path(images_dir)
        if not images_path.exists():
            return {"indexed_images": 0, "errors": [f"Directory not found: {images_dir}"]}

        # Find all image files
        image_files = sorted(
            list(images_path.glob("*.jpg")) + list(images_path.glob("*.jpeg")) + list(images_path.glob("*.png"))
        )

        if limit:
            image_files = image_files[:limit]

        indexed = 0
        errors = []

        for img_path in image_files:
            try:
                # Use filename as source path for OCR images
                source_path = f"ocr_invoices/{img_path.name}"
                title = img_path.stem.replace("_", " ").replace("-", " ")
                await self.index_image(str(img_path), source_path=source_path, title=title)
                indexed += 1
            except Exception as e:
                errors.append(f"{img_path.name}: {e}")
                logger.error("Failed to index image %s: %s", img_path.name, e)

        return {
            "indexed_images": indexed,
            "total_images": len(image_files),
            "errors": errors,
        }

    async def _delete_path(self, path: str):
        """Remove all chunks for a given source path (route-specific table).

        Delegates the synchronous SQLite work to a thread via asyncio.to_thread.
        """
        await asyncio.to_thread(self._delete_path_sync, path)

    def _delete_path_sync(self, path: str):
        """Synchronous path deletion — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        conn.execute(f"DELETE FROM {self.table} WHERE source_path = ?", (path,))
        conn.commit()
        conn.close()

    # --- Search ---

    async def search(
        self,
        query: str,
        limit: int = 10,
        method: str = "hybrid",
        modality: str | None = None,
    ) -> list[SearchResult]:
        """Search the RAG store.

        Methods:
        - 'semantic': cosine similarity over embeddings
        - 'keyword': FTS5 full-text search
        - 'hybrid': combine both (default)

        Modality filter:
        - None: search all modalities (text + images)
        - 'text': search only text chunks
        - 'image': search only image chunks
        """
        results = []

        if method in ("semantic", "hybrid"):
            semantic_results = await self._semantic_search(query, limit=limit * 2, modality=modality)
            results.extend(semantic_results)

        if method in ("keyword", "hybrid"):
            keyword_results = await self._keyword_search(query, limit=limit * 2)
            results.extend(keyword_results)

        # Deduplicate by content, keep highest score
        seen: dict[str, SearchResult] = {}
        for r in results:
            key = r.content[:200]
            if key not in seen or r.score > seen[key].score:
                seen[key] = r

        # Sort by score descending
        sorted_results = sorted(seen.values(), key=lambda x: x.score, reverse=True)
        return sorted_results[:limit]

    async def _semantic_search(self, query: str, limit: int = 20,
                                modality: str | None = None) -> list[SearchResult]:
        """Search using cosine similarity over stored embeddings (route-specific table).

        Delegates the synchronous SQLite + numpy work to a thread via asyncio.to_thread.
        """
        query_embedding = await self.embed_query(query)
        if all(v == 0.0 for v in query_embedding):
            return []

        return await asyncio.to_thread(
            self._semantic_search_sync, query_embedding, limit, modality
        )

    def _semantic_search_sync(self, query_embedding: list[float], limit: int,
                               modality: str | None) -> list[SearchResult]:
        """Synchronous cosine-similarity search — runs in a worker thread."""
        query_vec = np.array(query_embedding, dtype=np.float32)
        # Both routes produce normalized vectors (v2 auto-normalizes, v1 we normalize manually)
        query_norm = np.linalg.norm(query_vec)
        if query_norm == 0:
            return []

        conn = sqlite3.connect(str(self.db_path))

        # Build query with optional modality filter (v2 only)
        if self.route == "v2" and modality:
            cursor = conn.execute(
                f"SELECT id, source_path, heading, content, embedding, modality FROM {self.table} WHERE embedding IS NOT NULL AND modality = ?",
                (modality,),
            )
        elif self.route == "v2":
            cursor = conn.execute(
                f"SELECT id, source_path, heading, content, embedding, modality FROM {self.table} WHERE embedding IS NOT NULL"
            )
        else:
            # v1: no modality column
            cursor = conn.execute(
                f"SELECT id, source_path, heading, content, embedding FROM {self.table} WHERE embedding IS NOT NULL"
            )
        rows = cursor.fetchall()
        conn.close()

        results = []
        for row in rows:
            if self.route == "v2":
                chunk_id, source_path, heading, content, emb_bytes, chunk_modality = row
            else:
                chunk_id, source_path, heading, content, emb_bytes = row
                chunk_modality = "text"

            if not emb_bytes:
                continue

            chunk_vec = np.frombuffer(emb_bytes, dtype=np.float32)
            chunk_norm = np.linalg.norm(chunk_vec)
            if chunk_norm == 0:
                continue

            # Cosine similarity
            similarity = float(np.dot(query_vec, chunk_vec) / (query_norm * chunk_norm))
            if similarity > 0.3:  # relevance threshold
                results.append(SearchResult(
                    content=content,
                    score=similarity,
                    metadata={
                        "source_path": source_path,
                        "heading": heading,
                        "method": "semantic",
                        "modality": chunk_modality or "text",
                    },
                ))

        results.sort(key=lambda x: x.score, reverse=True)
        return results[:limit]

    async def _keyword_search(self, query: str, limit: int = 20) -> list[SearchResult]:
        """Search using FTS5 full-text search (route-specific table).

        Delegates the synchronous SQLite work to a thread via asyncio.to_thread.
        """
        return await asyncio.to_thread(self._keyword_search_sync, query, limit)

    def _keyword_search_sync(self, query: str, limit: int) -> list[SearchResult]:
        """Synchronous FTS5 keyword search — runs in a worker thread."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                f"""SELECT c.source_path, c.heading, c.content, f.rank
                   FROM {self.fts_table} f
                   JOIN {self.table} c ON c.id = f.rowid
                   WHERE {self.fts_table} MATCH ?
                   ORDER BY f.rank
                   LIMIT ?""",
                (query, limit),
            )
            rows = cursor.fetchall()
        except sqlite3.OperationalError:
            # FTS5 might not handle special chars
            rows = []
        conn.close()

        results = []
        for source_path, heading, content, rank in rows:
            # Convert FTS5 rank (negative BM25) to 0-1 score
            score = min(1.0, max(0.0, 1.0 + rank / 10))
            results.append(SearchResult(
                content=content,
                score=score,
                metadata={"source_path": source_path, "heading": heading, "method": "keyword"},
            ))

        return results
