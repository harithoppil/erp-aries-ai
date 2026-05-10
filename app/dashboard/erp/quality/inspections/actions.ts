'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeInspection = {
  id: string;
  name: string;
  report_date: string;
  inspection_type: string;
  item_code: string;
  item_name: string;
  status: string;
  company: string;
};

// ── List Inspections ────────────────────────────────────────────────────────

export async function listInspections(): Promise<
  { success: true; inspections: ClientSafeInspection[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Quality Inspection', 'read');
    const rows = await prisma.qualityInspection.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      inspections: rows.map((r) => ({
        id: r.name,
        name: r.name,
        report_date: r.report_date ? new Date(r.report_date).toLocaleDateString() : '',
        inspection_type: r.inspection_type || '',
        item_code: r.item_code || '',
        item_name: r.item_name || '',
        status: r.status || 'Accepted',
        company: r.company || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Quality Inspections:', msg);
    return { success: false, error: msg || 'Failed to fetch Quality Inspections' };
  }
}
