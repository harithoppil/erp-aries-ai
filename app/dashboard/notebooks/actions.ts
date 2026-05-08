'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { generateId, generateShortCode } from '@/lib/uuid';

export interface NotebookRead {
  id: string;
  title: string;
  content: string | null;
  metadata_json: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listNotebooks(): Promise<
  { success: true; notebooks: NotebookRead[] } | { success: false; error: string }
> {
  try {
    const notebooks = await prisma.notebooks.findMany({
      orderBy: { updated_at: 'desc' },
    });
    return { success: true, notebooks };
  } catch (error: any) {
    console.error('[notebooks] listNotebooks failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch notebooks' };
  }
}

export async function getNotebook(id: string): Promise<
  { success: true; notebook: NotebookRead } | { success: false; error: string }
> {
  try {
    const notebook = await prisma.notebooks.findUnique({ where: { id } });
    if (!notebook) return { success: false, error: 'Notebook not found' };
    return { success: true, notebook };
  } catch (error: any) {
    console.error('[notebooks] getNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch notebook' };
  }
}

export async function createNotebook(data: { title?: string; content?: string }): Promise<
  { success: true; notebook: NotebookRead } | { success: false; error: string }
> {
  try {
    const notebook = await prisma.notebooks.create({
      data: {
        id: generateId(),
        title: data.title || 'Untitled Notebook',
        content: data.content || null,
      },
    });
    revalidatePath('/notebooks');
    return { success: true, notebook };
  } catch (error: any) {
    console.error('[notebooks] createNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create notebook' };
  }
}

export async function updateNotebook(id: string, data: Partial<{ title: string; content: string; metadata_json: string }>): Promise<
  { success: true; notebook: NotebookRead } | { success: false; error: string }
> {
  try {
    const notebook = await prisma.notebooks.update({
      where: { id },
      data,
    });
    revalidatePath('/notebooks');
    revalidatePath(`/notebooks/editor/${id}`);
    return { success: true, notebook };
  } catch (error: any) {
    console.error('[notebooks] updateNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update notebook' };
  }
}

export async function deleteNotebook(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    await prisma.notebooks.delete({ where: { id } });
    revalidatePath('/notebooks');
    return { success: true };
  } catch (error: any) {
    console.error('[notebooks] deleteNotebook failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete notebook' };
  }
}
