'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeMovement = {
  id: string;
  name: string;
  company: string;
  purpose: string;
  transaction_date: string;
  reference_doctype: string | null;
  reference_name: string | null;
};

// ── List Asset Movements ────────────────────────────────────────────────────

export async function listMovements(): Promise<
  { success: true; movements: ClientSafeMovement[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Asset', 'read');
    const rows = await prisma.assetMovement.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      movements: rows.map((r) => ({
        id: r.name,
        name: r.name,
        company: r.company,
        purpose: r.purpose,
        transaction_date: r.transaction_date.toISOString().split('T')[0],
        reference_doctype: r.reference_doctype,
        reference_name: r.reference_name,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching asset movements:', msg);
    return { success: false, error: msg || 'Failed to fetch asset movements' };
  }
}
