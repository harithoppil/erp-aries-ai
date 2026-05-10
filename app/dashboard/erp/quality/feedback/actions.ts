'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeFeedback = {
  id: string;
  name: string;
  template: string;
  document_type: string;
  document_name: string;
};

// ── List Feedback ───────────────────────────────────────────────────────────

export async function listFeedbacks(): Promise<
  { success: true; feedbacks: ClientSafeFeedback[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Quality Feedback', 'read');
    const rows = await prisma.qualityFeedback.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      feedbacks: rows.map((r) => ({
        id: r.name,
        name: r.name,
        template: r.template || '',
        document_type: r.document_type || '',
        document_name: r.document_name || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Quality Feedback:', msg);
    return { success: false, error: msg || 'Failed to fetch Quality Feedback' };
  }
}
