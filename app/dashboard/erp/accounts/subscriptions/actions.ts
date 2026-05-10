'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSubscription = {
  id: string;
  name: string;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  party_type: string;
  party: string;
  company: string | null;
  submit_invoice: boolean;
  generate_invoice_at: string | null;
  cancelation_date: string | null;
};

// ── List Subscriptions ──────────────────────────────────────────────────────

export async function listSubscriptions(): Promise<
  { success: true; subscriptions: ClientSafeSubscription[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Subscription', 'read');
    const rows = await prisma.subscription.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      subscriptions: rows.map((s) => ({
        id: s.name,
        name: s.name,
        status: s.status,
        start_date: s.start_date ? s.start_date.toISOString().split('T')[0] : null,
        end_date: s.end_date ? s.end_date.toISOString().split('T')[0] : null,
        party_type: s.party_type,
        party: s.party,
        company: s.company,
        submit_invoice: s.submit_invoice ?? true,
        generate_invoice_at: s.generate_invoice_at,
        cancelation_date: s.cancelation_date ? s.cancelation_date.toISOString().split('T')[0] : null,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching subscriptions:', msg);
    return { success: false, error: msg || 'Failed to fetch subscriptions' };
  }
}
