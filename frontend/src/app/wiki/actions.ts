'use server';

import { API_BASE } from '@/lib/api-base';
import { revalidatePath } from 'next/cache';

export interface WikiPageRead {
  path: string;
  content: string;
  last_modified?: string | null;
  last_commit?: string | null;
}

export interface WikiSearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

export type WikiPageListResponse =
  | { success: true; pages: string[] }
  | { success: false; error: string };

export type WikiPageResponse =
  | { success: true; page: WikiPageRead }
  | { success: false; error: string };

export type WikiSearchResponse =
  | { success: true; results: WikiSearchResult[] }
  | { success: false; error: string };

export type WikiCreateResponse =
  | { success: true; page: WikiPageRead }
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

export async function listWikiPages(): Promise<WikiPageListResponse> {
  try {
    const pages = await apiFetch<string[]>('/wiki/pages');
    return { success: true, pages };
  } catch (error: any) {
    console.error('[wiki] listWikiPages failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to list wiki pages' };
  }
}

export async function getWikiPage(path: string): Promise<WikiPageResponse> {
  try {
    const page = await apiFetch<WikiPageRead>(`/wiki/pages/${encodeURIComponent(path)}`);
    return { success: true, page };
  } catch (error: any) {
    console.error('[wiki] getWikiPage failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get wiki page' };
  }
}

export async function createWikiPage(
  path: string,
  content: string,
  commitMessage = 'Add page'
): Promise<WikiCreateResponse> {
  try {
    const page = await apiFetch<WikiPageRead>('/wiki/pages', {
      method: 'POST',
      body: JSON.stringify({ path, content, commit_message: commitMessage }),
    });
    revalidatePath('/wiki');
    return { success: true, page };
  } catch (error: any) {
    console.error('[wiki] createWikiPage failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create wiki page' };
  }
}

export async function updateWikiPage(
  path: string,
  content: string,
  commitMessage = 'Update page'
): Promise<WikiCreateResponse> {
  try {
    const page = await apiFetch<WikiPageRead>(`/wiki/pages/${encodeURIComponent(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ content, commit_message: commitMessage }),
    });
    revalidatePath('/wiki');
    return { success: true, page };
  } catch (error: any) {
    console.error('[wiki] updateWikiPage failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update wiki page' };
  }
}

export async function deleteWikiPage(path: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await apiFetch<void>(`/wiki/pages/${encodeURIComponent(path)}`, { method: 'DELETE' });
    revalidatePath('/wiki');
    return { success: true };
  } catch (error: any) {
    console.error('[wiki] deleteWikiPage failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete wiki page' };
  }
}

export async function searchWiki(query: string): Promise<WikiSearchResponse> {
  try {
    const results = await apiFetch<WikiSearchResult[]>(`/wiki/search?q=${encodeURIComponent(query)}`);
    return { success: true, results };
  } catch (error: any) {
    console.error('[wiki] searchWiki failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to search wiki' };
  }
}
