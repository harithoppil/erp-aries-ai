'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

// ── Types ────────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  type: 'creation' | 'comment' | 'version' | 'status';
  name: string;
  creation: string;
  owner?: string;
  content?: string;
  /** For version events: field-level diff */
  changes?: [string, string, string][];
  /** For status events */
  status?: string;
}

export interface TimelineResult {
  success: true;
  events: TimelineEvent[];
}
export interface TimelineError {
  success: false;
  error: string;
}
export type FetchTimelineResult = TimelineResult | TimelineError;

export interface AddCommentResult {
  success: boolean;
  error?: string;
  comment?: {
    name: string;
    content: string;
    owner: string;
    creation: string;
  };
}

// ── Fetch Timeline ───────────────────────────────────────────────────────────

export async function fetchTimeline(
  doctype: string,
  name: string,
): Promise<FetchTimelineResult> {
  try {
    const events: TimelineEvent[] = [];

    // 1. Creation event from the record itself
    const delegate = getDelegate(prisma, doctype);

    if (delegate) {
      const record = await delegate.findUnique({
        where: { name },
        select: { creation: true, owner: true, modified: true, modified_by: true, docstatus: true },
      }) as Record<string, unknown> | null;

      if (record) {
        events.push({
          type: 'creation',
          name: '__creation__',
          creation: record.creation instanceof Date ? record.creation.toISOString() : String(record.creation ?? ''),
          owner: String(record.owner ?? ''),
        });

        // Status event
        const ds = Number(record.docstatus ?? 0);
        if (ds > 0) {
          events.push({
            type: 'status',
            name: '__status__',
            creation: record.modified instanceof Date ? record.modified.toISOString() : String(record.modified ?? ''),
            owner: String(record.modified_by ?? ''),
            status: ds === 1 ? 'Submitted' : ds === 2 ? 'Cancelled' : 'Draft',
          });
        }
      }
    }

    // 2. Comments
    const comments = await prisma.comment.findMany({
      where: { reference_doctype: doctype, reference_name: name },
      orderBy: { creation: 'desc' },
    });

    for (const c of comments) {
      events.push({
        type: 'comment',
        name: c.name,
        creation: c.creation instanceof Date ? c.creation.toISOString() : String(c.creation),
        owner: c.comment_by || c.owner || '',
        content: c.content || '',
      });
    }

    // 3. Version history
    const versions = await prisma.documentVersion.findMany({
      where: { ref_doctype: doctype, docname: name },
      orderBy: { creation: 'desc' },
    });

    for (const v of versions) {
      let changes: [string, string, string][] = [];
      if (v.data) {
        try {
          const parsed = JSON.parse(v.data);
          if (Array.isArray(parsed.changed)) {
            changes = parsed.changed;
          }
        } catch { /* ignore bad JSON */ }
      }
      events.push({
        type: 'version',
        name: v.name,
        creation: v.creation instanceof Date ? v.creation.toISOString() : String(v.creation),
        owner: v.owner || '',
        changes,
      });
    }

    // Sort all events by creation descending
    events.sort((a, b) => new Date(b.creation).getTime() - new Date(a.creation).getTime());

    return { success: true, events };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchTimeline]', msg);
    return { success: false, error: `Failed to load timeline` };
  }
}

// ── Add Comment ──────────────────────────────────────────────────────────────

export async function addComment(
  doctype: string,
  name: string,
  content: string,
  email?: string,
): Promise<AddCommentResult> {
  try {
    if (!content.trim()) return { success: false, error: 'Comment cannot be empty' };

    const comment = await prisma.comment.create({
      data: {
        reference_doctype: doctype,
        reference_name: name,
        content: content.trim(),
        comment_type: 'Comment',
        comment_by: email || 'Administrator',
        comment_email: email || 'administrator@example.com',
        owner: email || 'Administrator',
        modified_by: email || 'Administrator',
      },
    });

    return {
      success: true,
      comment: {
        name: comment.name,
        content: comment.content || '',
        owner: comment.comment_by || comment.owner || '',
        creation: comment.creation instanceof Date ? comment.creation.toISOString() : String(comment.creation),
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[addComment]', msg);
    return { success: false, error: 'Failed to add comment' };
  }
}
