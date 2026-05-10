'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeMaintenance = {
  id: string;
  name: string;
  asset_name: string;
  asset_category: string | null;
  item_code: string | null;
  item_name: string | null;
  company: string;
  maintenance_team: string;
  maintenance_manager: string | null;
  maintenance_manager_name: string | null;
};

// ── List Asset Maintenance ──────────────────────────────────────────────────

export async function listMaintenance(): Promise<
  { success: true; maintenance: ClientSafeMaintenance[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Asset', 'read');
    const rows = await prisma.assetMaintenance.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      maintenance: rows.map((r) => ({
        id: r.name,
        name: r.name,
        asset_name: r.asset_name,
        asset_category: r.asset_category,
        item_code: r.item_code,
        item_name: r.item_name,
        company: r.company,
        maintenance_team: r.maintenance_team,
        maintenance_manager: r.maintenance_manager,
        maintenance_manager_name: r.maintenance_manager_name,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching asset maintenance:', msg);
    return { success: false, error: msg || 'Failed to fetch asset maintenance' };
  }
}
