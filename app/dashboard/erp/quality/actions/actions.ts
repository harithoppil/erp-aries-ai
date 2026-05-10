'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeAction = {
  id: string;
  name: string;
  goal: string;
  date: string;
  procedure: string;
  status: string;
  corrective_preventive: string;
  review: string;
  feedback: string;
};

// ── List Actions ────────────────────────────────────────────────────────────

export async function listActions(): Promise<
  { success: true; actions: ClientSafeAction[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Quality Action', 'read');
    const rows = await prisma.qualityAction.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      actions: rows.map((r) => ({
        id: r.name,
        name: r.name,
        goal: r.goal || '',
        date: r.date ? new Date(r.date).toLocaleDateString() : '',
        procedure: r.procedure || '',
        status: r.status || 'Open',
        corrective_preventive: r.corrective_preventive || 'Corrective',
        review: r.review || '',
        feedback: r.feedback || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Quality Actions:', msg);
    return { success: false, error: msg || 'Failed to fetch Quality Actions' };
  }
}
