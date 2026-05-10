'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeJobCard = {
  id: string;
  name: string;
  work_order: string;
  employee: string;
  status: string;
  for_quantity: number;
};

// ── List Job Cards ──────────────────────────────────────────────────────────

export async function listJobCards(): Promise<
  { success: true; jobCards: ClientSafeJobCard[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Job Card', 'read');
    const rows = await prisma.jobCard.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      jobCards: rows.map((j) => ({
        id: j.name,
        name: j.name,
        work_order: j.work_order,
        employee: j.owner || '—',
        status: j.status || 'Open',
        for_quantity: j.for_quantity || 0,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Job Cards:', msg);
    return { success: false, error: msg || 'Failed to fetch Job Cards' };
  }
}
