'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeGoal = {
  id: string;
  name: string;
  frequency: string;
  procedure: string;
  date: string;
  goal: string;
};

// ── List Goals ──────────────────────────────────────────────────────────────

export async function listGoals(): Promise<
  { success: true; goals: ClientSafeGoal[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Quality Goal', 'read');
    const rows = await prisma.qualityGoal.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      goals: rows.map((r) => ({
        id: r.name,
        name: r.name,
        frequency: r.frequency || 'None',
        procedure: r.procedure || '',
        date: r.date || '',
        goal: r.goal || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Quality Goals:', msg);
    return { success: false, error: msg || 'Failed to fetch Quality Goals' };
  }
}
