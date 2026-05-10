'use server';

import { errorMessage } from '@/lib/utils';
/**
 * RAG Server Actions — direct pgvector + Gemini embeddings.
 *
 * Replaces the previous implementation that proxied all requests to the
 * Python backend. Now uses:
 * - rag-db.ts for pgvector operations via Prisma $queryRaw
 * - rag-embed.ts for Gemini embedding API calls from Node.js
 *
 * Wiki page content still fetched from Python backend (git-versioned wiki).
 */

import { revalidatePath } from 'next/cache';
import { embedQuery, embedDocuments, EMBEDDING_DIM } from '@/lib/rag-embed';
import {
  ensureRAGSchema,
  semanticSearch,
  keywordSearch,
  insertChunks,
  deleteByPath,
  getStats as getDBStats,
  type RAGSearchRow,
  type RAGKeywordRow,
} from '@/lib/rag-db';
import { API_BASE } from '@/lib/api-base';
import type { RAGSearchResult, RAGStats } from '@/types/api';

export type { RAGSearchResult } from '@/types/api';

export type RAGSearchResponse =
  | { success: true; results: RAGSearchResult[] }
  | { success: false; error: string };

export type RAGIndexResponse =
  | { success: true; info: Record<string, unknown> }
  | { success: false; error: string };

export type RAGStatsResponse =
  | { success: true; stats: RAGStats }
  | { success: false; error: string };

// ── Wiki content fetcher (still uses Python backend for git-vaulted wiki) ───

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === 'string'
      ? err.detail
      : JSON.stringify(err.detail || err);
    throw new Error(msg || 'API Error');
  }
  return res.json();
}

// ── Chunking (ported from Python rag.py) ───────────────────────────────────

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const MIN_CHUNK_SIZE = 100;

interface Chunk {
  content: string;
  metadata: {
    source_path: string;
    heading: string;
    chunk_index: number;
    char_start?: number;
    char_end?: number;
  };
}

function chunkMarkdown(text: string, sourcePath: string = ''): Chunk[] {
  const chunks: Chunk[] = [];
  const headingPattern = /^(#{1,6})\s+(.+)$/gm;

  const sections: [string, string][] = []; // [heading, content]
  let lastEnd = 0;
  let currentHeading = sourcePath || 'root';

  let match: RegExpExecArray | null;
  while ((match = headingPattern.exec(text)) !== null) {
    // Content before this heading belongs to the previous section
    if (sections.length > 0) {
      sections[sections.length - 1][1] += text.slice(lastEnd, match.index);
    } else {
      const preamble = text.slice(lastEnd, match.index).trim();
      if (preamble) sections.push(['root', preamble]);
    }

    currentHeading = match[2].trim();
    sections.push([currentHeading, '']);
    lastEnd = match.index + match[0].length;
  }

  // Add remaining content to last section
  if (sections.length > 0) {
    sections[sections.length - 1][1] += text.slice(lastEnd);
  } else if (text.trim()) {
    sections.push(['root', text]);
  }

  // Split oversized sections into chunks
  for (const [heading, rawContent] of sections) {
    const content = rawContent.trim();
    if (!content) continue;

    if (content.length <= CHUNK_SIZE) {
      chunks.push({
        content,
        metadata: { source_path: sourcePath, heading, chunk_index: chunks.length },
      });
    } else {
      let start = 0;
      while (start < content.length) {
        let end = start + CHUNK_SIZE;
        let chunkText = content.slice(start, end);

        // Try to break at paragraph boundary
        if (end < content.length) {
          const paraBreak = chunkText.lastIndexOf('\n\n', chunkText.length - CHUNK_OVERLAP);
          if (paraBreak > MIN_CHUNK_SIZE) {
            end = start + paraBreak + 2;
            chunkText = content.slice(start, end);
          }
        }

        chunkText = chunkText.trim();
        if (chunkText.length >= MIN_CHUNK_SIZE) {
          chunks.push({
            content: chunkText,
            metadata: {
              source_path: sourcePath,
              heading,
              chunk_index: chunks.length,
              char_start: start,
              char_end: end,
            },
          });
        }

        start = end < content.length ? end - CHUNK_OVERLAP : end;
      }
    }
  }

  return chunks;
}

// ── Search ──────────────────────────────────────────────────────────────────

export async function ragSearch(
  query: string,
  method: string = 'hybrid',
  limit: number = 10,
  modality?: string,
): Promise<RAGSearchResponse> {
  try {
    await ensureRAGSchema();

    const results: RAGSearchResult[] = [];

    if (method === 'semantic' || method === 'hybrid') {
      // Embed the query using v2 (default route)
      const queryEmbedding = await embedQuery(query, 'v2');
      const isAllZero = queryEmbedding.every(v => v === 0);
      if (!isAllZero) {
        const rows = await semanticSearch(queryEmbedding, limit * 2, modality);
        for (const row of rows) {
          if (row.similarity > 0.3) {
            results.push({
              content: row.content,
              score: row.similarity,
              source_path: row.source_path,
              heading: row.heading,
              method: 'semantic',
              modality: row.modality || 'text',
              route: 'v2',
            });
          }
        }
      }
    }

    if (method === 'keyword' || method === 'hybrid') {
      const rows = await keywordSearch(query, limit * 2);
      for (const row of rows) {
        results.push({
          content: row.content,
          score: Math.min(1.0, row.rank),
          source_path: row.source_path,
          heading: row.heading,
          method: 'keyword',
          modality: 'text',
          route: 'v2',
        });
      }
    }

    // Deduplicate by content (keep highest score)
    const seen = new Map<string, RAGSearchResult>();
    for (const r of results) {
      const key = r.content.slice(0, 200);
      const existing = seen.get(key);
      if (!existing || r.score > existing.score) {
        seen.set(key, r);
      }
    }

    // Sort by score descending
    const sorted = [...seen.values()].sort((a, b) => b.score - a.score);
    return { success: true, results: sorted.slice(0, limit) };
  } catch (error) {
    console.error('[rag] search failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'RAG search failed') };
  }
}

// ── Indexing ────────────────────────────────────────────────────────────────

export async function indexWikiAll(route: string = 'v2'): Promise<RAGIndexResponse> {
  try {
    await ensureRAGSchema();

    // Fetch all wiki pages from Python backend (git-vaulted wiki)
    const pages = await apiFetch<string[]>('/wiki/pages');

    let totalChunks = 0;
    let indexedPages = 0;
    const errors: string[] = [];

    for (const pagePath of pages) {
      try {
        const page = await apiFetch<{ content: string }>(`/wiki/pages/${encodeURIComponent(pagePath)}`);
        if (!page?.content) continue;

        // Delete existing chunks for this path
        await deleteByPath(pagePath);

        // Chunk the markdown
        const chunks = chunkMarkdown(page.content, pagePath);
        if (!chunks.length) continue;

        // Embed all chunk texts
        const texts = chunks.map(c => c.content);
        const titles = chunks.map(c => c.metadata.heading);
        const embeddings = await embedDocuments(texts, titles, 'v2');

        // Insert into rag_chunks
        const rows = chunks.map((c, i) => ({
          source_path: c.metadata.source_path,
          heading: c.metadata.heading,
          chunk_index: c.metadata.chunk_index,
          content: c.content,
          embedding: embeddings[i],
          char_start: c.metadata.char_start ?? null,
          char_end: c.metadata.char_end ?? null,
          modality: 'text' as const,
        }));

        await insertChunks(rows);
        totalChunks += chunks.length;
        indexedPages++;
      } catch (error) {
        errors.push(`${pagePath}: ${errorMessage(error)}`);
        console.error(`[rag] Failed to index wiki page ${pagePath}:`, errorMessage(error));
      }
    }

    revalidatePath('/wiki');
    return {
      success: true,
      info: { indexed_pages: indexedPages, total_chunks: totalChunks, errors },
    };
  } catch (error) {
    console.error('[rag] indexWikiAll failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Wiki indexing failed') };
  }
}

export async function indexWikiPage(path: string, route: string = 'v2'): Promise<RAGIndexResponse> {
  try {
    await ensureRAGSchema();

    // Fetch page content from Python backend (git-vaulted wiki)
    const page = await apiFetch<{ content: string }>(`/wiki/pages/${encodeURIComponent(path)}`);
    if (!page?.content) {
      return { success: false, error: `Page not found: ${path}` };
    }

    // Delete existing chunks for this path
    await deleteByPath(path);

    // Chunk the markdown
    const chunks = chunkMarkdown(page.content, path);
    if (!chunks.length) {
      return { success: true, info: { path, chunks_indexed: 0, route } };
    }

    // Embed all chunk texts
    const texts = chunks.map(c => c.content);
    const titles = chunks.map(c => c.metadata.heading);
    const embeddings = await embedDocuments(texts, titles, 'v2');

    // Insert into rag_chunks
    const rows = chunks.map((c, i) => ({
      source_path: c.metadata.source_path,
      heading: c.metadata.heading,
      chunk_index: c.metadata.chunk_index,
      content: c.content,
      embedding: embeddings[i],
      char_start: c.metadata.char_start ?? null,
      char_end: c.metadata.char_end ?? null,
      modality: 'text' as const,
    }));

    const count = await insertChunks(rows);

    revalidatePath('/wiki');
    return { success: true, info: { path, chunks_indexed: count, route } };
  } catch (error) {
    console.error('[rag] indexWikiPage failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Page indexing failed') };
  }
}

// ── Stats ───────────────────────────────────────────────────────────────────

export async function getRagStats(): Promise<RAGStatsResponse> {
  try {
    await ensureRAGSchema();
    const stats = await getDBStats();

    // Convert to the RAGStats format expected by the UI
    // RAGStats = { [route: string]: { total_chunks: number; modalities: Record<string, number> } }
    const ragStats: RAGStats = {
      v2: {
        total_chunks: stats.total,
        modalities: stats.by_modality,
      },
    };

    return { success: true, stats: ragStats };
  } catch (error) {
    console.error('[rag] getRagStats failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to get RAG stats') };
  }
}
