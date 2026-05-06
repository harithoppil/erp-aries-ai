"""PostgreSQL + pgvector RAG backend.

Replaces SQLite rag_store.db with Azure PostgreSQL rag_chunks table.
- Embeddings stored as VECTOR(768) for fast similarity search
- Full-text search via PostgreSQL tsvector (replaces FTS5)
"""

import asyncio
import logging
from typing import NamedTuple

import asyncpg
import numpy as np

from backend.app.core.config import settings

logger = logging.getLogger("aries.rag_pg")

PG_URL = settings.database_url.replace("+asyncpg", "").replace("postgresql://", "postgresql://")

_pool: asyncpg.Pool | None = None


class SearchResult(NamedTuple):
    content: str
    score: float
    metadata: dict


async def _get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            PG_URL,
            min_size=2,
            max_size=10,
            command_timeout=60,
        )
    return _pool


async def init_rag_schema():
    """Create RAG tables and indexes if not exists."""
    pool = await _get_pool()
    async with pool.acquire() as conn:
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id SERIAL PRIMARY KEY,
                source_path TEXT NOT NULL,
                heading TEXT,
                chunk_index INTEGER,
                content TEXT NOT NULL,
                embedding VECTOR(768),
                char_start INTEGER,
                char_end INTEGER,
                modality TEXT DEFAULT 'text',
                tsv TSVECTOR,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
            ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100);
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_path);")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunks_modality ON rag_chunks(modality);")
        # Add tsv column if migrating from pre-tsv schema
        await conn.execute("""
            DO $$ BEGIN
                ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS tsv TSVECTOR;
            END $$;
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv ON rag_chunks USING GIN(tsv);")


async def index_chunks(rows: list[tuple], route: str = "v2") -> int:
    """Insert chunks into rag_chunks.
    
    rows: list of (source_path, heading, chunk_index, content, embedding_list, char_start, char_end, modality)
    """
    pool = await _get_pool()
    records = []
    for source_path, heading, chunk_index, content, embedding, char_start, char_end, modality in rows:
        emb_str = "[" + ",".join(str(float(v)) for v in embedding) + "]" if embedding else None
        # Build tsvector from content + heading
        tsv = None  # will be computed by trigger
        records.append((source_path, heading, chunk_index, content, emb_str, char_start, char_end, modality))
    
    async with pool.acquire() as conn:
        # Create trigger for auto tsvector if not exists
        await conn.execute("""
            CREATE OR REPLACE FUNCTION rag_chunks_tsv_trigger() RETURNS trigger AS $$
            BEGIN
                NEW.tsv := to_tsvector('english', COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.heading, ''));
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        """)
        await conn.execute("""
            DROP TRIGGER IF EXISTS rag_chunks_tsv_update ON rag_chunks;
            CREATE TRIGGER rag_chunks_tsv_update
            BEFORE INSERT OR UPDATE ON rag_chunks
            FOR EACH ROW EXECUTE FUNCTION rag_chunks_tsv_trigger();
        """)
        
        await conn.copy_records_to_table(
            'rag_chunks',
            records=records,
            columns=['source_path', 'heading', 'chunk_index', 'content', 'embedding', 'char_start', 'char_end', 'modality']
        )
    return len(records)


async def index_image(source_path: str, heading: str, content: str, embedding: list[float]) -> int:
    pool = await _get_pool()
    emb_str = "[" + ",".join(str(float(v)) for v in embedding) + "]"
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO rag_chunks (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
            VALUES ($1, $2, 0, $3, $4::vector(768), 0, 0, 'image')
        """, source_path, heading, content, emb_str)
    return 1


async def delete_by_path(source_path: str) -> int:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("DELETE FROM rag_chunks WHERE source_path = $1", source_path)
        # Result is like "DELETE 5"
        return int(result.split()[-1]) if result.split() else 0


async def semantic_search(
    embedding: list[float],
    limit: int = 20,
    modality: str | None = None,
) -> list[SearchResult]:
    """Search by cosine similarity using pgvector."""
    pool = await _get_pool()
    emb_str = "[" + ",".join(str(float(v)) for v in embedding) + "]"
    
    async with pool.acquire() as conn:
        if modality:
            rows = await conn.fetch("""
                SELECT source_path, heading, content, modality,
                       1 - (embedding <=> $1::vector(768)) AS similarity
                FROM rag_chunks
                WHERE embedding IS NOT NULL AND modality = $2
                ORDER BY embedding <=> $1::vector(768)
                LIMIT $3
            """, emb_str, modality, limit)
        else:
            rows = await conn.fetch("""
                SELECT source_path, heading, content, modality,
                       1 - (embedding <=> $1::vector(768)) AS similarity
                FROM rag_chunks
                WHERE embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector(768)
                LIMIT $2
            """, emb_str, limit)
    
    results = []
    for row in rows:
        if row['similarity'] > 0.3:
            results.append(SearchResult(
                content=row['content'],
                score=float(row['similarity']),
                metadata={
                    "source_path": row['source_path'],
                    "heading": row['heading'],
                    "method": "semantic",
                    "modality": row['modality'] or "text",
                },
            ))
    return results


async def keyword_search(query: str, limit: int = 20) -> list[SearchResult]:
    """Search using PostgreSQL full-text search (replaces FTS5)."""
    pool = await _get_pool()
    
    # Normalize query for tsquery
    ts_query = " & ".join(query.split())
    
    async with pool.acquire() as conn:
        rows = await conn.fetch("""
            SELECT source_path, heading, content,
                   ts_rank_cd(tsv, plainto_tsquery('english', $1), 32) AS rank
            FROM rag_chunks
            WHERE tsv @@ plainto_tsquery('english', $1)
            ORDER BY rank DESC
            LIMIT $2
        """, query, limit)
    
    results = []
    for row in rows:
        results.append(SearchResult(
            content=row['content'],
            score=min(1.0, float(row['rank'])),
            metadata={
                "source_path": row['source_path'],
                "heading": row['heading'],
                "method": "keyword",
            },
        ))
    return results


async def get_stats() -> dict:
    pool = await _get_pool()
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM rag_chunks")
        with_emb = await conn.fetchval("SELECT COUNT(*) FROM rag_chunks WHERE embedding IS NOT NULL")
        sources = await conn.fetchval("SELECT COUNT(DISTINCT source_path) FROM rag_chunks")
        mod_rows = await conn.fetch("SELECT modality, COUNT(*) FROM rag_chunks GROUP BY modality")
        
    return {
        "total": total,
        "with_embedding": with_emb,
        "unique_sources": sources,
        "by_modality": {r['modality']: r['count'] for r in mod_rows},
    }


async def get_routes_stats() -> dict:
    """Backwards-compat stats for v1/v2 routes (we now use a unified table)."""
    stats = await get_stats()
    return {
        "v1": {"total": 0, "with_embedding": 0, "unique_sources": 0},
        "v2": stats,
    }
