'use server';

import { API_BASE } from '@/lib/api';
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

export async function ragSearch(
  query: string,
  method: string = 'hybrid',
  limit: number = 10,
  modality?: string
): Promise<RAGSearchResponse> {
  try {
    const params = new URLSearchParams({ query, limit: String(limit), method });
    if (modality) params.set('modality', modality);
    const results = await apiFetch<RAGSearchResult[]>(`/ai/rag/search?${params.toString()}`, { method: 'POST' });
    return { success: true, results };
  } catch (error: any) {
    console.error('[rag] search failed:', error?.message);
    return { success: false, error: error?.message || 'RAG search failed' };
  }
}

export async function indexWikiAll(route: string = 'v2'): Promise<RAGIndexResponse> {
  try {
    const info = await apiFetch<Record<string, unknown>>(`/ai/rag/index-wiki?route=${route}`, { method: 'POST' });
    return { success: true, info };
  } catch (error: any) {
    console.error('[rag] indexWikiAll failed:', error?.message);
    return { success: false, error: error?.message || 'Wiki indexing failed' };
  }
}

export async function indexWikiPage(path: string, route: string = 'v2'): Promise<RAGIndexResponse> {
  try {
    const info = await apiFetch<{ path: string; chunks_indexed: number; route: string }>(
      `/ai/rag/index-page?path=${encodeURIComponent(path)}&route=${route}`,
      { method: 'POST' }
    );
    return { success: true, info };
  } catch (error: any) {
    console.error('[rag] indexWikiPage failed:', error?.message);
    return { success: false, error: error?.message || 'Page indexing failed' };
  }
}

export async function getRagStats(): Promise<RAGStatsResponse> {
  try {
    const stats = await apiFetch<RAGStats>('/ai/rag/stats');
    return { success: true, stats };
  } catch (error: any) {
    console.error('[rag] getRagStats failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get RAG stats' };
  }
}
