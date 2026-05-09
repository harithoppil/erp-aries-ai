'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafePayment = {
  id: string;
  payment_number: string;
  party_type: string;
  party_name: string;
  payment_type: string;
  posting_date: string;
  paid_amount: number;
  received_amount: number;
  reference_no: string | null;
  mode_of_payment: string | null;
  status: string;
  created_at: Date | null;
  // Legacy aliases for client component compatibility
  amount?: number;
  reference_number?: string | null;
};

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listPayments(): Promise<
  { success: true; payments: ClientSafePayment[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Payment Entry", "read");
    const rows = await prisma.paymentEntry.findMany({
      orderBy: { posting_date: 'desc' },
      take: 200,
    });

    return {
      success: true,
      payments: rows.map((p) => ({
        id: p.name,
        payment_number: p.name,
        party_type: p.party_type || 'Customer',
        party_name: p.party_name || 'Unknown',
        payment_type: p.payment_type || 'Receive',
        posting_date: p.posting_date ? p.posting_date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        paid_amount: Number(p.paid_amount || 0),
        received_amount: Number(p.received_amount || 0),
        reference_no: p.reference_no || null,
        mode_of_payment: p.mode_of_payment || null,
        status: p.docstatus === 1 ? 'Submitted' : p.docstatus === 2 ? 'Cancelled' : 'Draft',
        created_at: p.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching payments:', msg);
    return { success: false, error: msg || 'Failed to fetch payments' };
  }
}

export async function createPayment(data: {
  party_type?: string;
  party?: string;
  party_name?: string;
  payment_type?: string;
  paid_amount?: number;
  amount?: number;
  mode_of_payment?: string;
  reference_no?: string;
  reference_number?: string;
  invoice_id?: string;
}) {
  try {
    await requirePermission("Payment Entry", "create");
    const amount = data.amount ?? data.paid_amount ?? 0;
    const party = data.party || data.party_name || 'Unknown';
    const paymentType = data.payment_type || 'Receive';
    const name = `PE-${Date.now()}`;
    const record = await prisma.paymentEntry.create({
      data: {
        name,
        payment_type: paymentType,
        party_type: data.party_type || 'Customer',
        party: party,
        party_name: party,
        posting_date: new Date(),
        paid_amount: amount,
        received_amount: amount,
        source_exchange_rate: 1,
        base_paid_amount: amount,
        target_exchange_rate: 1,
        base_received_amount: amount,
        reference_no: data.reference_number || data.reference_no || null,
        mode_of_payment: data.mode_of_payment || null,
        paid_from: 'Debtors - A',
        paid_from_account_currency: 'AED',
        paid_to: 'Cash - A',
        paid_to_account_currency: 'AED',
        company: 'Aries',
        naming_series: 'PE-',
        status: 'Draft',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    revalidatePath('/erp/payments');
    return {
      success: true as const,
      payment: {
        id: record.name,
        payment_number: record.name,
        party_type: record.party_type || 'Customer',
        party_name: party,
        payment_type: paymentType,
        posting_date: record.posting_date ? record.posting_date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        paid_amount: amount,
        received_amount: amount,
        reference_no: data.reference_number || data.reference_no || null,
        mode_of_payment: data.mode_of_payment || null,
        status: 'Draft',
        created_at: record.creation,
      } as ClientSafePayment,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create payment' };
  }
}

// ── Submit / Cancel ─────────────────────────────────────────────────────────

export async function submitPayment(id: string): Promise<SubmitResult> {
  await requirePermission("Payment Entry", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Payment Entry", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/payments');
  return result;
}

export async function cancelPayment(id: string): Promise<CancelResult> {
  await requirePermission("Payment Entry", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Payment Entry", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/payments');
  return result;
}
