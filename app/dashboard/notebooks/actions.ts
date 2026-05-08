'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeDeleteDoc } from '@/lib/frappe-client';

export type NotebookRead = {
  id: string;
  title: string;
  content: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

const NOTEBOOK_DOCTYPE = 'Note';

export async function listNotebooks(): Promise<
  { success: true; notebooks: NotebookRead[] } | { success: false; error: string }
> {
  try {
    const notes = await frappeGetList<Record<string, unknown>>(NOTEBOOK_DOCTYPE, {
      fields: ['name', 'title', 'content', 'modified', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });
    return {
      success: true,
      notebooks: notes.map((n) => ({
        id: String(n.name),
        title: String(n.title || n.name),
        content: String(n.content || ''),
        metadata_json: null,
        created_at: String(n.creation || new Date().toISOString()),
        updated_at: String(n.modified || new Date().toISOString()),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load notebooks' };
  }
}

export async function getNotebook(id: string): Promise<
  { success: true; notebook: NotebookRead } | { success: false; error: string }
> {
  try {
    const note = await frappeGetDoc<Record<string, unknown>>(NOTEBOOK_DOCTYPE, id);
    return {
      success: true,
      notebook: {
        id: String(note.name),
        title: String(note.title || note.name),
        content: String(note.content || ''),
        metadata_json: null,
        created_at: String(note.creation || new Date().toISOString()),
        updated_at: String(note.modified || new Date().toISOString()),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load notebook' };
  }
}

export async function createNotebook(data: { title: string; content?: string }): Promise<
  { success: true; notebook: NotebookRead } | { success: false; error: string }
> {
  try {
    const note = await frappeInsertDoc<Record<string, unknown>>(NOTEBOOK_DOCTYPE, {
      title: data.title,
      content: data.content || '',
    });
    return {
      success: true,
      notebook: {
        id: String(note.name),
        title: String(note.title || note.name),
        content: String(note.content || ''),
        metadata_json: null,
        created_at: String(note.creation || new Date().toISOString()),
        updated_at: String(note.modified || new Date().toISOString()),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create notebook' };
  }
}

export async function updateNotebook(id: string, data: Partial<{ title: string; content: string; metadata_json: string }>): Promise<
  { success: true; notebook: NotebookRead } | { success: false; error: string }
> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;

    const note = await frappeUpdateDoc<Record<string, unknown>>(NOTEBOOK_DOCTYPE, id, updateData);
    return {
      success: true,
      notebook: {
        id: String(note.name),
        title: String(note.title || note.name),
        content: String(note.content || ''),
        metadata_json: data.metadata_json || null,
        created_at: String(note.creation || new Date().toISOString()),
        updated_at: String(note.modified || new Date().toISOString()),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update notebook' };
  }
}

export async function deleteNotebook(id: string): Promise<void> {
  await frappeDeleteDoc(NOTEBOOK_DOCTYPE, id);
}
