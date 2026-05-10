'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafePickList = {
  id: string;
  name: string;
  company: string;
  purpose: string | null;
  status: string;
  customer: string | null;
  customer_name: string | null;
  work_order: string | null;
  per_delivered: number | null;
  delivery_status: string | null;
};

// ── List Pick Lists ─────────────────────────────────────────────────────────

export async function listPickLists(): Promise<
  { success: true; pickLists: ClientSafePickList[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Pick List', 'read');
    const rows = await prisma.pickList.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      pickLists: rows.map((p) => ({
        id: p.name,
        name: p.name,
        company: p.company,
        purpose: p.purpose,
        status: p.status,
        customer: p.customer,
        customer_name: p.customer_name,
        work_order: p.work_order,
        per_delivered: p.per_delivered,
        delivery_status: p.delivery_status,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching pick lists:', msg);
    return { success: false, error: msg || 'Failed to fetch pick lists' };
  }
}
