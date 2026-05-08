'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeDeleteDoc } from '@/lib/frappe-client';

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

const WIKI_DOCTYPE = 'Note';

export async function listWikiPages(): Promise<
  { success: true; pages: WikiPageRead[] } | { success: false; error: string }
> {
  try {
    const notes = await frappeGetList<Record<string, unknown>>(WIKI_DOCTYPE, {
      fields: ['name', 'title', 'content', 'modified'],
      order_by: 'title asc',
      limit_page_length: 500,
    });
    return {
      success: true,
      pages: notes.map((n) => ({
        path: String(n.title || n.name),
        title: String(n.title || n.name),
        content: String(n.content || ''),
        last_modified: n.modified ? String(n.modified) : null,
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
    const notes = await frappeGetList<Record<string, unknown>>(WIKI_DOCTYPE, {
      fields: ['name', 'title', 'content', 'modified'],
      filters: { title: path },
      limit_page_length: 1,
    });

    if (notes.length > 0) {
      return {
        success: true,
        page: {
          path: String(notes[0].title || notes[0].name),
          title: String(notes[0].title || notes[0].name),
          content: String(notes[0].content || ''),
          last_modified: notes[0].modified ? String(notes[0].modified) : null,
        },
      };
    }

    const note = await frappeGetDoc<Record<string, unknown>>(WIKI_DOCTYPE, path);
    return {
      success: true,
      page: {
        path: String(note.title || note.name),
        title: String(note.title || note.name),
        content: String(note.content || ''),
        last_modified: note.modified ? String(note.modified) : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load wiki page' };
  }
}

export async function createWikiPage(path: string, content: string, _msg?: string): Promise<
  { success: true; page: WikiPageRead } | { success: false; error: string }
> {
  try {
    const note = await frappeInsertDoc<Record<string, unknown>>(WIKI_DOCTYPE, {
      title: path,
      content,
      public: 1,
    });
    return {
      success: true,
      page: {
        path: String(note.title || note.name),
        title: String(note.title || note.name),
        content: String(note.content || ''),
        last_modified: note.modified ? String(note.modified) : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create wiki page' };
  }
}

export async function updateWikiPage(path: string, content: string): Promise<
  { success: true; page: WikiPageRead } | { success: false; error: string }
> {
  try {
    const note = await frappeUpdateDoc<Record<string, unknown>>(WIKI_DOCTYPE, path, { content });
    return {
      success: true,
      page: {
        path: String(note.title || note.name),
        title: String(note.title || note.name),
        content: String(note.content || ''),
        last_modified: note.modified ? String(note.modified) : null,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to update wiki page' };
  }
}

export async function deleteWikiPage(path: string): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await frappeDeleteDoc(WIKI_DOCTYPE, path);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete wiki page' };
  }
}

export async function searchWiki(q: string): Promise<
  { success: true; results: WikiSearchResult[] } | { success: false; error: string }
> {
  try {
    const notes = await frappeGetList<Record<string, unknown>>(WIKI_DOCTYPE, {
      fields: ['name', 'title', 'content'],
      filters: { title: ['like', `%${q}%`] },
      limit_page_length: 50,
    });
    return {
      success: true,
      results: notes.map((n) => ({
        path: String(n.name),
        title: String(n.title || n.name),
        snippet: String(n.content || '').slice(0, 200),
        score: 1,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to search wiki' };
  }
}
