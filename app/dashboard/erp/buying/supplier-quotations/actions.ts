'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSupplierQuotation = {
  id: string;
  name: string;
  supplier: string;
  supplier_name: string;
  company: string;
  grand_total: string;
  status: string;
  valid_till: string;
};

// ── List Supplier Quotations ────────────────────────────────────────────────

export async function listSupplierQuotations(): Promise<
  { success: true; quotations: ClientSafeSupplierQuotation[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Supplier Quotation', 'read');
    const rows = await prisma.supplierQuotation.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      quotations: rows.map((q) => ({
        id: q.name,
        name: q.name,
        supplier: q.supplier,
        supplier_name: q.supplier_name || q.supplier,
        company: q.company,
        grand_total: q.grand_total ? Number(q.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00',
        status: q.docstatus === 1 ? 'Submitted' : q.docstatus === 2 ? 'Cancelled' : (q.status || 'Draft'),
        valid_till: q.valid_till ? new Date(q.valid_till).toLocaleDateString() : '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching supplier quotations:', msg);
    return { success: false, error: msg || 'Failed to fetch supplier quotations' };
  }
}
