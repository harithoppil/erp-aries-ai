'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafePayment = {
  id: string;
  payment_type: string;
  party_type: string;
  party_name: string;
  amount: number;
  currency: string;
  reference_number: string | null;
  reference_date: Date | null;
  posting_date: Date;
  invoice_id: string | null;
};

export async function listPayments(): Promise<
  { success: true; payments: ClientSafePayment[] } | { success: false; error: string }
> {
  try {
    const payments = await prisma.payment_entries.findMany({ orderBy: { posting_date: 'desc' } });
    return { success: true, payments: payments.map((p) => ({ ...p })) };
  } catch (error) {
    console.error('Error fetching payments:', error);
    return { success: false, error: 'Failed to fetch payments' };
  }
}

export async function createPayment(data: {
  invoice_id?: string;
  amount: number;
  reference_number?: string;
  party_name?: string;
  payment_type?: string;
}) {
  try {
    const payment = await prisma.payment_entries.create({
      data: {
        id: randomUUID(),
        invoice_id: data.invoice_id || null,
        amount: data.amount,
        currency: 'AED',
        payment_type: data.payment_type || 'receive',
        party_type: 'customer',
        party_name: data.party_name || 'Unknown',
        reference_number: data.reference_number || null,
        reference_date: new Date(),
      }
    });
    revalidatePath('/erp/payments');
    return { success: true as const, payment: { ...payment } as ClientSafePayment };
  } catch (error) {
    return { success: false as const, error: 'Failed to record payment' };
  }
}

// ── Payment Mutations ──────────────────────────────────────────────────────

export async function updatePayment(
  id: string,
  data: Partial<{
    amount: number;
    reference_number: string;
    reference_date: Date;
    party_name: string;
    payment_type: string;
  }>
) {
  try {
    const record = await prisma.payment_entries.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/payments');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[payments] updatePayment failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update payment' };
  }
}

export async function deletePayment(id: string) {
  try {
    await prisma.payment_entries.delete({ where: { id } });
    revalidatePath('/erp/payments');
    return { success: true };
  } catch (error: any) {
    console.error('[payments] deletePayment failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete payment' };
  }
}
