'use server';

import { API_BASE } from '@/lib/api-base';
import { revalidatePath } from 'next/cache';

export interface NotebookRead {
  id: string;
  title: string;
  content: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

export type NotebookListResponse =
  | { success: true; notebooks: NotebookRead[] }
  | { success: false; error: string };

export type NotebookDetailResponse =
  | { success: true; notebook: NotebookRead }
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

export async function listNotebooks(): Promise<NotebookListResponse> {
  try {
    const notebooks = await apiFetch<NotebookRead[]>('/notebooks/');
    return { success: true, notebooks };
  } catch (error: any) {
    console.error('[notebooks] listNotebooks failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch notebooks' };
  }
}

export async function getNotebook(id: string): Promise<NotebookDetailResponse> {
  try {
    const notebook = await apiFetch<NotebookRead>(`/notebooks/${id}`);
    return { success: true, notebook };
  } catch (error: any) {
    console.error('[notebooks] getNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch notebook' };
  }
}

export async function createNotebook(data: { title?: string; content?: string }): Promise<NotebookDetailResponse> {
  try {
    const notebook = await apiFetch<NotebookRead>('/notebooks/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    revalidatePath('/notebooks');
    return { success: true, notebook };
  } catch (error: any) {
    console.error('[notebooks] createNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create notebook' };
  }
}

export async function updateNotebook(id: string, data: Partial<{ title: string; content: string; metadata_json: string }>): Promise<NotebookDetailResponse> {
  try {
    const notebook = await apiFetch<NotebookRead>(`/notebooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    revalidatePath('/notebooks');
    revalidatePath(`/notebooks/editor/${id}`);
    return { success: true, notebook };
  } catch (error: any) {
    console.error('[notebooks] updateNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update notebook' };
  }
}

export async function deleteNotebook(id: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await apiFetch<void>(`/notebooks/${id}`, { method: 'DELETE' });
    revalidatePath('/notebooks');
    return { success: true };
  } catch (error: any) {
    console.error('[notebooks] deleteNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete notebook' };
  }
}
