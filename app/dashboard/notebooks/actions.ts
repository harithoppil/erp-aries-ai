'use server';

import { prisma } from '@/lib/prisma';

export type NotebookRead = {
  id: string;
  title: string;
  content: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

export async function listNotebooks(): Promise<
  { success: true; notebooks: NotebookRead[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.notebooks.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });
    return {
      success: true,
      notebooks: rows.map((n) => ({
        id: n.id,
        title: n.title || n.id,
        content: n.content || '',
        metadata_json: n.metadata_json || null,
        created_at: n.created_at.toISOString(),
        updated_at: n.updated_at.toISOString(),
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
    const note = await prisma.notebooks.findUnique({ where: { id } });
    if (!note) return { success: false, error: 'Notebook not found' };
    return {
      success: true,
      notebook: {
        id: note.id,
        title: note.title || note.id,
        content: note.content || '',
        metadata_json: note.metadata_json || null,
        created_at: note.created_at.toISOString(),
        updated_at: note.updated_at.toISOString(),
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
    const note = await prisma.notebooks.create({
      data: {
        id: crypto.randomUUID(),
        title: data.title,
        content: data.content || null,
      },
    });
    return {
      success: true,
      notebook: {
        id: note.id,
        title: note.title || note.id,
        content: note.content || '',
        metadata_json: null,
        created_at: note.created_at.toISOString(),
        updated_at: note.updated_at.toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create notebook' };
  }
}

export async function updateNotebook(
  id: string,
  data: Partial<{ title: string; content: string; metadata_json: string }>
): Promise<{ success: true; notebook: NotebookRead } | { success: false; error: string }> {
  try {
    const note = await prisma.notebooks.update({
      where: { id },
      data: {
        title: data.title || undefined,
        content: data.content !== undefined ? data.content : undefined,
        metadata_json: data.metadata_json !== undefined ? data.metadata_json : undefined,
      },
    });
    return {
      success: true,
      notebook: {
        id: note.id,
        title: note.title || note.id,
        content: note.content || '',
        metadata_json: data.metadata_json || note.metadata_json || null,
        created_at: note.created_at.toISOString(),
        updated_at: note.updated_at.toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update notebook' };
  }
}

export async function deleteNotebook(id: string): Promise<void> {
  await prisma.notebooks.delete({ where: { id } });
}
