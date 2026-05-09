'use server';

import { prisma } from '@/lib/prisma';

export type WikiPageRead = {
  path: string;
  title: string;
  content: string;
  last_modified?: string | null;
};

export type WikiSearchResult = {
  path: string;
  title: string;
  snippet: string;
  score: number;
};

export async function listWikiPages(): Promise<
  { success: true; pages: WikiPageRead[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.notebooks.findMany({
      orderBy: { title: 'asc' },
      take: 500,
    });
    return {
      success: true,
      pages: rows.map((n) => ({
        path: n.title || n.id,
        title: n.title || n.id,
        content: n.content || '',
        last_modified: n.updated_at.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load wiki pages' };
  }
}

export async function getWikiPage(path: string): Promise<
  { success: true; page: WikiPageRead } | { success: false; error: string }
> {
  try {
    const rows = await prisma.notebooks.findMany({
      where: { title: path },
      take: 1,
    });

    if (rows.length > 0) {
      return {
        success: true,
        page: {
          path: rows[0].title || rows[0].id,
          title: rows[0].title || rows[0].id,
          content: rows[0].content || '',
          last_modified: rows[0].updated_at.toISOString(),
        },
      };
    }

    // Fallback: search by id
    const note = await prisma.notebooks.findUnique({ where: { id: path } });
    if (!note) {
      return { success: false, error: 'Wiki page not found' };
    }
    return {
      success: true,
      page: {
        path: note.title || note.id,
        title: note.title || note.id,
        content: note.content || '',
        last_modified: note.updated_at.toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load wiki page' };
  }
}

export async function createWikiPage(
  path: string,
  content: string,
  _msg?: string
): Promise<{ success: true; page: WikiPageRead } | { success: false; error: string }> {
  try {
    const note = await prisma.notebooks.create({
      data: {
        id: crypto.randomUUID(),
        title: path,
        content,
      },
    });
    return {
      success: true,
      page: {
        path: note.title || note.id,
        title: note.title || note.id,
        content: note.content || '',
        last_modified: note.updated_at.toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create wiki page' };
  }
}

export async function updateWikiPage(
  path: string,
  content: string
): Promise<{ success: true; page: WikiPageRead } | { success: false; error: string }> {
  try {
    // Try update by title first, then by id
    const existing = await prisma.notebooks.findFirst({ where: { title: path } });
    const note = await prisma.notebooks.update({
      where: { id: existing?.id || path },
      data: { content },
    });
    return {
      success: true,
      page: {
        path: note.title || note.id,
        title: note.title || note.id,
        content: note.content || '',
        last_modified: note.updated_at.toISOString(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update wiki page' };
  }
}

export async function deleteWikiPage(path: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await prisma.notebooks.findFirst({ where: { title: path } });
    await prisma.notebooks.delete({ where: { id: existing?.id || path } });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete wiki page' };
  }
}

export async function searchWiki(q: string): Promise<
  { success: true; results: WikiSearchResult[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.notebooks.findMany({
      where: { title: { contains: q, mode: 'insensitive' } },
      take: 50,
    });
    return {
      success: true,
      results: rows.map((n) => ({
        path: n.id,
        title: n.title || n.id,
        snippet: (n.content || '').slice(0, 200),
        score: 1,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to search wiki' };
  }
}
