'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeBOM = {
  id: string;
  name: string;
  item: string;
  item_name: string;
  company: string;
  is_active: boolean;
  status: string;
};

// ── List BOMs ───────────────────────────────────────────────────────────────

export async function listBOMs(): Promise<
  { success: true; boms: ClientSafeBOM[] } | { success: false; error: string }
> {
  try {
    await requirePermission('BOM', 'read');
    const rows = await prisma.bOM.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      boms: rows.map((b) => ({
        id: b.name,
        name: b.name,
        item: b.item,
        item_name: b.item_name || b.item,
        company: b.company,
        is_active: b.is_active,
        status: b.docstatus === 1 ? 'Submitted' : b.docstatus === 2 ? 'Cancelled' : (b.is_active ? 'Active' : 'Inactive'),
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching BOMs:', msg);
    return { success: false, error: msg || 'Failed to fetch BOMs' };
  }
}
