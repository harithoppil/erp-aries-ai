'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeCapitalization = {
  id: string;
  name: string;
  title: string | null;
  target_item_code: string | null;
  target_asset: string | null;
  target_asset_name: string | null;
  company: string;
  posting_date: string;
  total_value: string | null;
  status: string;
  cost_center: string | null;
  project: string | null;
};

// ── List Asset Capitalizations ──────────────────────────────────────────────

export async function listCapitalizations(): Promise<
  { success: true; capitalizations: ClientSafeCapitalization[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Asset', 'read');
    const rows = await prisma.assetCapitalization.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      capitalizations: rows.map((r) => ({
        id: r.name,
        name: r.name,
        title: r.title,
        target_item_code: r.target_item_code,
        target_asset: r.target_asset,
        target_asset_name: r.target_asset_name,
        company: r.company,
        posting_date: r.posting_date.toISOString().split('T')[0],
        total_value: r.total_value?.toString() ?? null,
        status: r.docstatus === 1 ? 'Submitted' : r.docstatus === 2 ? 'Cancelled' : 'Draft',
        cost_center: r.cost_center,
        project: r.project,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching capitalizations:', msg);
    return { success: false, error: msg || 'Failed to fetch capitalizations' };
  }
}
