'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc } from '@/lib/frappe-client';

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
    const payments = await frappeGetList<any>('Payment Entry', {
      fields: ['name', 'party_type', 'party', 'payment_type', 'posting_date', 'paid_amount', 'received_amount', 'reference_no', 'mode_of_payment', 'docstatus', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      payments: payments.map((p: any) => ({
        id: p.name,
        payment_number: p.name,
        party_type: p.party_type || 'Customer',
        party_name: p.party || 'Unknown',
        payment_type: p.payment_type || 'Receive',
        posting_date: p.posting_date || new Date().toISOString().slice(0, 10),
        paid_amount: p.paid_amount || 0,
        received_amount: p.received_amount || 0,
        reference_no: p.reference_no || null,
        mode_of_payment: p.mode_of_payment || null,
        status: p.docstatus === 1 ? 'SUBMITTED' : p.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
        created_at: p.creation ? new Date(p.creation) : new Date(),
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
    const paid_amount = data.amount ?? data.paid_amount ?? 0;
    const party = data.party || data.party_name || 'Unknown';
    const doc = await frappeInsertDoc<any>('Payment Entry', {
      party_type: data.party_type || 'Customer',
      party,
      payment_type: data.payment_type || 'Receive',
      paid_amount,
      received_amount: paid_amount,
      mode_of_payment: data.mode_of_payment || 'Cash',
      reference_no: data.reference_number || data.reference_no || undefined,
      references: data.invoice_id ? [{ reference_doctype: 'Sales Invoice', reference_name: data.invoice_id }] : undefined,
    });
    return { success: true as const, payment: { id: doc.name, payment_number: doc.name, party_type: data.party_type || 'Customer', party_name: party, payment_type: data.payment_type || 'Receive', posting_date: new Date().toISOString().slice(0, 10), paid_amount, received_amount: paid_amount, reference_no: data.reference_number || data.reference_no || null, mode_of_payment: data.mode_of_payment || null, status: 'DRAFT', created_at: new Date() } as ClientSafePayment };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create payment' };
  }
}
