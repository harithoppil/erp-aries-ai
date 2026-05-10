'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeNC = {
  id: string;
  name: string;
  subject: string;
  procedure: string;
  status: string;
  details: string;
  process_owner: string;
  full_name: string;
};

// ── List Non Conformances ───────────────────────────────────────────────────

export async function listNonConformances(): Promise<
  { success: true; ncs: ClientSafeNC[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Non Conformance', 'read');
    const rows = await prisma.nonConformance.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      ncs: rows.map((r) => ({
        id: r.name,
        name: r.name,
        subject: r.subject || '',
        procedure: r.procedure || '',
        status: r.status || '',
        details: r.details || '',
        process_owner: r.process_owner || '',
        full_name: r.full_name || '',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching Non Conformances:', msg);
    return { success: false, error: msg || 'Failed to fetch Non Conformances' };
  }
}
