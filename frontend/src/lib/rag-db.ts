/**
 * pgvector database operations for RAG — uses Prisma $queryRaw.
 *
 * The rag_chunks table is managed via raw SQL because Prisma doesn't
 * natively support PostgreSQL VECTOR type. We use Unsupported("vector(768)")
 * in the Prisma schema just so Prisma Client knows the table exists,
 * but all actual vector operations go through $queryRaw / $executeRaw.
 *
 * IMPORTANT: pgvector VECTOR type can't be passed as a Prisma tagged template
 * parameter — it needs to be interpolated directly into the SQL string.
 * We use $executeRawUnsafe / $queryRawUnsafe for these cases.
 */

import { prisma } from '@/lib/prisma';
import { EMBEDDING_DIM } from './rag-embed';

// ── Types ──────────────────────────────────────────────────────────────────

export interface RAGChunk {
  id: number;
  source_path: string;
  heading: string | null;
  chunk_index: number | null;
  content: string;
  char_start: number | null;
  char_end: number | null;
  modality: string;
  created_at: Date;
}

export interface RAGSearchRow {
  source_path: string;
  heading: string | null;
  content: string;
  modality: string;
  similarity: number;
}

export interface RAGKeywordRow {
  source_path: string;
  heading: string | null;
  content: string;
  rank: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Convert an embedding array to pgvector string literal: [0.1,0.2,...] */
function embToVecStr(embedding: number[]): string {
  return `[${embedding.map(v => String(v)).join(',')}]`;
}

/** Escape a string for SQL single-quoted literal */
function sqlStr(s: string | null): string {
  if (s === null) return 'NULL';
  return `'${s.replace(/'/g, "''")}'`;
}

// ── Schema init ─────────────────────────────────────────────────────────────

/** Ensure pgvector extension and rag_chunks table exist. Idempotent. */
export async function ensureRAGSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id            SERIAL PRIMARY KEY,
      source_path   TEXT NOT NULL,
      heading       TEXT,
      chunk_index   INTEGER,
      content       TEXT NOT NULL,
      embedding     VECTOR(${EMBEDDING_DIM}),
      char_start    INTEGER,
      char_end      INTEGER,
      modality      TEXT DEFAULT 'text',
      tsv           TSVECTOR,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  // IVFFlat index for cosine similarity (needs rows to train, so use IF NOT EXISTS)
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
    ON rag_chunks USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_path);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_rag_chunks_modality ON rag_chunks(modality);`);

  // Add tsv column if migrating from pre-tsv schema
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE rag_chunks ADD COLUMN IF NOT EXISTS tsv TSVECTOR;
    END $$;
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_rag_chunks_tsv ON rag_chunks USING GIN(tsv);`);

  // Auto-compute tsvector trigger
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION rag_chunks_tsv_trigger() RETURNS trigger AS $$
    BEGIN
      NEW.tsv := to_tsvector('english', COALESCE(NEW.content, '') || ' ' || COALESCE(NEW.heading, ''));
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await prisma.$executeRawUnsafe(`
    DROP TRIGGER IF EXISTS rag_chunks_tsv_update ON rag_chunks;
    CREATE TRIGGER rag_chunks_tsv_update
    BEFORE INSERT OR UPDATE ON rag_chunks
    FOR EACH ROW EXECUTE FUNCTION rag_chunks_tsv_trigger();
  `);
}

// ── Insert ──────────────────────────────────────────────────────────────────

/** Insert multiple chunks with embeddings into rag_chunks. */
export async function insertChunks(
  rows: {
    source_path: string;
    heading: string | null;
    chunk_index: number;
    content: string;
    embedding: number[];
    char_start: number | null;
    char_end: number | null;
    modality?: string;
  }[]
): Promise<number> {
  if (!rows.length) return 0;

  // Build a single multi-row INSERT for efficiency
  const values = rows.map(r => {
    const embStr = r.embedding.length > 0
      ? `${sqlStr(embToVecStr(r.embedding))}::vector(${EMBEDDING_DIM})`
      : 'NULL';
    return `(${sqlStr(r.source_path)}, ${sqlStr(r.heading)}, ${r.chunk_index}, ${sqlStr(r.content)}, ${embStr}, ${r.char_start ?? 'NULL'}, ${r.char_end ?? 'NULL'}, ${sqlStr(r.modality || 'text')})`;
  });

  const sql = `
    INSERT INTO rag_chunks (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
    VALUES ${values.join(',\n')}
  `;

  await prisma.$executeRawUnsafe(sql);
  return rows.length;
}

/** Insert a single image chunk with embedding. */
export async function insertImageChunk(
  sourcePath: string,
  heading: string,
  content: string,
  embedding: number[],
): Promise<number> {
  const embStr = embToVecStr(embedding);

  await prisma.$executeRawUnsafe(`
    INSERT INTO rag_chunks (source_path, heading, chunk_index, content, embedding, char_start, char_end, modality)
    VALUES (${sqlStr(sourcePath)}, ${sqlStr(heading)}, 0, ${sqlStr(content)}, '${embStr}'::vector(${EMBEDDING_DIM}), 0, 0, 'image')
  `);
  return 1;
}

// ── Delete ──────────────────────────────────────────────────────────────────

/** Delete all chunks for a given source path. */
export async function deleteByPath(sourcePath: string): Promise<number> {
  const result = await prisma.$executeRaw`
    DELETE FROM rag_chunks WHERE source_path = ${sourcePath}
  `;
  return result;
}

// ── Semantic search ─────────────────────────────────────────────────────────

/** Search by cosine similarity using pgvector <=> operator. */
export async function semanticSearch(
  embedding: number[],
  limit: number = 20,
  modality?: string,
): Promise<RAGSearchRow[]> {
  const embStr = embToVecStr(embedding);
  const dim = EMBEDDING_DIM;

  // Must use $queryRawUnsafe because VECTOR type can't be a Prisma param
  if (modality) {
    return prisma.$queryRawUnsafe(
      `SELECT source_path, heading, content, modality,
              1 - (embedding <=> $1::vector(${dim})) AS similarity
       FROM rag_chunks
       WHERE embedding IS NOT NULL AND modality = $2
       ORDER BY embedding <=> $1::vector(${dim})
       LIMIT $3`,
      embStr, modality, limit
    ) as Promise<RAGSearchRow[]>;
  }

  return prisma.$queryRawUnsafe(
    `SELECT source_path, heading, content, modality,
            1 - (embedding <=> $1::vector(${dim})) AS similarity
     FROM rag_chunks
     WHERE embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector(${dim})
     LIMIT $2`,
    embStr, limit
  ) as Promise<RAGSearchRow[]>;
}

// ── Keyword search ──────────────────────────────────────────────────────────

/** Search using PostgreSQL full-text search (tsvector + tsquery). */
export async function keywordSearch(
  query: string,
  limit: number = 20,
): Promise<RAGKeywordRow[]> {
  return prisma.$queryRaw`
    SELECT source_path, heading, content,
           ts_rank_cd(tsv, plainto_tsquery('english', ${query}), 32) AS rank
    FROM rag_chunks
    WHERE tsv @@ plainto_tsquery('english', ${query})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;
}

// ── Stats ───────────────────────────────────────────────────────────────────

export interface RAGDBStats {
  total: number;
  with_embedding: number;
  unique_sources: number;
  by_modality: Record<string, number>;
}

/** Get RAG store statistics. */
export async function getStats(): Promise<RAGDBStats> {
  const [totalRows, withEmbRows, sourcesRows, modRows] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM rag_chunks`,
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*) as count FROM rag_chunks WHERE embedding IS NOT NULL`,
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(DISTINCT source_path) as count FROM rag_chunks`,
    prisma.$queryRaw<{ modality: string; count: bigint }[]>`SELECT modality, COUNT(*) as count FROM rag_chunks GROUP BY modality`,
  ]);

  return {
    total: Number(totalRows[0]?.count ?? 0),
    with_embedding: Number(withEmbRows[0]?.count ?? 0),
    unique_sources: Number(sourcesRows[0]?.count ?? 0),
    by_modality: Object.fromEntries(
      modRows.map(r => [r.modality, Number(r.count)])
    ),
  };
}
