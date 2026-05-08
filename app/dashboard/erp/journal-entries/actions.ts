'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc } from '@/lib/frappe-client';

export type ClientSafeJournalEntry = {
  id: string;
  entry_number: string;
  posting_date: string;
  voucher_type: string;
  total_debit: number;
  total_credit: number;
  status: string;
  remarks: string | null;
  created_at: Date;
  // Legacy aliases for client component compatibility
  entry_type?: 'debit' | 'credit' | 'DEBIT' | 'CREDIT';
  amount?: number;
  account?: string;
  party_name?: string | null;
  reference?: string | null;
};

export async function listJournalEntries(): Promise<
  { success: true; entries: ClientSafeJournalEntry[] } | { success: false; error: string }
> {
  try {
    const entries = await frappeGetList<any>('Journal Entry', {
      fields: ['name', 'posting_date', 'voucher_type', 'total_debit', 'total_credit', 'docstatus', 'user_remark', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      entries: entries.map((e: any) => ({
        id: e.name,
        entry_number: e.name,
        posting_date: e.posting_date || new Date().toISOString().slice(0, 10),
        voucher_type: e.voucher_type || 'Journal Entry',
        total_debit: e.total_debit || 0,
        total_credit: e.total_credit || 0,
        status: e.docstatus === 1 ? 'SUBMITTED' : e.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
        remarks: e.user_remark || null,
        created_at: e.creation ? new Date(e.creation) : new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching journal entries:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch journal entries' };
  }
}

export async function createJournalEntry(data: {
  posting_date?: string;
  voucher_type?: string;
  accounts?: { account: string; debit: number; credit: number }[];
  remarks?: string;
  // Legacy aliases for client component compatibility
  account?: string;
  entry_type?: string;
  amount?: number;
  party_type?: string;
  party_name?: string;
  reference?: string;
  notes?: string;
}) {
  // If called with legacy single-account format, convert to multi-account format
  const accounts = data.accounts && data.accounts.length > 0
    ? data.accounts
    : data.account && data.entry_type && data.amount
      ? data.entry_type === 'debit'
        ? [{ account: data.account, debit: data.amount, credit: 0 }]
        : [{ account: data.account, debit: 0, credit: data.amount }]
      : [];
  try {
    const doc = await frappeInsertDoc<any>('Journal Entry', {
      posting_date: data.posting_date || new Date().toISOString().slice(0, 10),
      voucher_type: data.voucher_type || 'Journal Entry',
      accounts: accounts.map((a) => ({
        account: a.account,
        debit_in_account_currency: a.debit,
        credit_in_account_currency: a.credit,
      })),
      user_remark: data.remarks || data.notes || data.reference || undefined,
    });
    return { success: true as const, entry: { id: doc.name, entry_number: doc.name, posting_date: data.posting_date || new Date().toISOString().slice(0, 10), voucher_type: data.voucher_type || 'Journal Entry', total_debit: accounts.reduce((s, a) => s + a.debit, 0), total_credit: accounts.reduce((s, a) => s + a.credit, 0), status: 'DRAFT', remarks: data.remarks || data.notes || data.reference || null, created_at: new Date() } as ClientSafeJournalEntry };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create journal entry' };
  }
}
