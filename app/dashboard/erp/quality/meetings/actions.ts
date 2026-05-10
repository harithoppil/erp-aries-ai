'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeMeeting = {
  id: string;
  name: string;
  status: string;
};

// ── List Meetings ───────────────────────────────────────────────────────────

export async function listMeetings(): Promise<
  { success: true; meetings: ClientSafeMeeting[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Quality Meeting', 'read');
    const rows = await prisma.qualityMeeting.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      meetings: rows.map((r) => ({
        id: r.name,
        name: r.name,
        status: r.status || 'Open',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Quality Meetings:', msg);
    return { success: false, error: msg || 'Failed to fetch Quality Meetings' };
  }
}
