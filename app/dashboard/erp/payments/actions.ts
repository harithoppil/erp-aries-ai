'use server';

import { prisma } from '@/lib/prisma';

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
  created_at: Date;
  // Legacy aliases for client component compatibility
  amount?: number;
  reference_number?: string | null;
};

export async function listPayments(): Promise<
  { success: true; payments: ClientSafePayment[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.payment_entries.findMany({
      orderBy: { posting_date: 'desc' },
      take: 200,
    });

    return {
      success: true,
      payments: rows.map((p) => ({
        id: p.id,
        payment_number: p.id,
        party_type: p.party_type || 'Customer',
        party_name: p.party_name || 'Unknown',
        payment_type: p.payment_type || 'Receive',
        posting_date: p.posting_date.toISOString().slice(0, 10),
        paid_amount: p.amount || 0,
        received_amount: p.amount || 0,
        reference_no: p.reference_number || null,
        mode_of_payment: null,
        status: 'DRAFT',
        created_at: p.posting_date,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching payments:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch payments' };
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
    const amount = data.amount ?? data.paid_amount ?? 0;
    const party = data.party || data.party_name || 'Unknown';
    const record = await prisma.payment_entries.create({
      data: {
        id: crypto.randomUUID(),
        invoice_id: data.invoice_id || null,
        payment_type: data.payment_type || 'Receive',
        party_type: data.party_type || 'Customer',
        party_name: party,
        amount,
        currency: 'USD',
        reference_number: data.reference_number || data.reference_no || null,
        posting_date: new Date(),
      },
    });

    return {
      success: true as const,
      payment: {
        id: record.id,
        payment_number: record.id,
        party_type: data.party_type || 'Customer',
        party_name: party,
        payment_type: data.payment_type || 'Receive',
        posting_date: new Date().toISOString().slice(0, 10),
        paid_amount: amount,
        received_amount: amount,
        reference_no: data.reference_number || data.reference_no || null,
        mode_of_payment: data.mode_of_payment || null,
        status: 'DRAFT',
        created_at: new Date(),
      } as ClientSafePayment,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create payment' };
  }
}
