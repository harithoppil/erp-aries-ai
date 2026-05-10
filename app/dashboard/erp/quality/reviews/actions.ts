'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeReview = {
  id: string;
  name: string;
  date: string;
  procedure: string;
  status: string;
  goal: string;
};

// ── List Reviews ────────────────────────────────────────────────────────────

export async function listReviews(): Promise<
  { success: true; reviews: ClientSafeReview[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Quality Review', 'read');
    const rows = await prisma.qualityReview.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      reviews: rows.map((r) => ({
        id: r.name,
        name: r.name,
        date: r.date ? new Date(r.date).toLocaleDateString() : '',
        procedure: r.procedure || '',
        status: r.status || 'Open',
        goal: r.goal || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Quality Reviews:', msg);
    return { success: false, error: msg || 'Failed to fetch Quality Reviews' };
  }
}
