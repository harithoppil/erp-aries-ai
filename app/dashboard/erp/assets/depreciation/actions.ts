'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeDepreciation = {
  id: string;
  name: string;
  asset: string;
  depreciation_method: string | null;
  rate_of_depreciation: number | null;
  total_number_of_depreciations: number | null;
  status: string;
  company: string | null;
  value_after_depreciation: string | null;
  net_purchase_amount: string | null;
  finance_book: string | null;
};

// ── List Depreciation Schedules ─────────────────────────────────────────────

export async function listDepreciationSchedules(): Promise<
  { success: true; schedules: ClientSafeDepreciation[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Asset', 'read');
    const rows = await prisma.assetDepreciationSchedule.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      schedules: rows.map((r) => ({
        id: r.name,
        name: r.name,
        asset: r.asset,
        depreciation_method: r.depreciation_method,
        rate_of_depreciation: r.rate_of_depreciation,
        total_number_of_depreciations: r.total_number_of_depreciations,
        status: r.status || (r.docstatus === 1 ? 'Active' : r.docstatus === 2 ? 'Cancelled' : 'Draft'),
        company: r.company,
        value_after_depreciation: r.value_after_depreciation?.toString() ?? null,
        net_purchase_amount: r.net_purchase_amount?.toString() ?? null,
        finance_book: r.finance_book,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching depreciation schedules:', msg);
    return { success: false, error: msg || 'Failed to fetch depreciation schedules' };
  }
}
