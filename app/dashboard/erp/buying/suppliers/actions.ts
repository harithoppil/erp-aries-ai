'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSupplier = {
  id: string;
  name: string;
  supplier_name: string;
  supplier_group: string;
  country: string;
  email_id: string;
};

// ── List Suppliers ──────────────────────────────────────────────────────────

export async function listSuppliers(): Promise<
  { success: true; suppliers: ClientSafeSupplier[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Supplier', 'read');
    const rows = await prisma.supplier.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      suppliers: rows.map((s) => ({
        id: s.name,
        name: s.name,
        supplier_name: s.supplier_name,
        supplier_group: s.supplier_group || '',
        country: s.country || '',
        email_id: s.email_id || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching suppliers:', msg);
    return { success: false, error: msg || 'Failed to fetch suppliers' };
  }
}
