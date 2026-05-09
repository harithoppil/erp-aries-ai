'use server';

import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument } from '@/lib/erpnext/document-orchestrator';
import { revalidatePath } from 'next/cache';
import type { journalentrytype } from '@/prisma/client';

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
    const rows = await prisma.journal_entries.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      entries: rows.map((e) => ({
        id: e.id,
        entry_number: e.entry_number,
        posting_date: e.posting_date.toISOString().slice(0, 10),
        voucher_type: 'Journal Entry',
        total_debit: e.total_debit || 0,
        total_credit: e.total_credit || 0,
        status: e.status || 'DRAFT',
        remarks: e.notes || e.reference || null,
        created_at: e.created_at,
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

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  try {
    const record = await prisma.journal_entries.create({
      data: {
        id: crypto.randomUUID(),
        entry_number: `JV-${Date.now()}`,
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        reference: data.reference || data.notes || null,
        account: data.account || (accounts[0]?.account ?? null),
        party_type: data.party_type || null,
        party_name: data.party_name || null,
        entry_type: (data.entry_type?.toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT') as journalentrytype,
        amount: data.amount || totalDebit || totalCredit || 0,
        currency: 'USD',
        notes: data.remarks || data.notes || data.reference || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: 'DRAFT',
      },
    });

    return {
      success: true as const,
      entry: {
        id: record.id,
        entry_number: record.entry_number,
        posting_date: data.posting_date || new Date().toISOString().slice(0, 10),
        voucher_type: 'Journal Entry',
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: 'DRAFT',
        remarks: data.remarks || data.notes || data.reference || null,
        created_at: record.created_at,
      } as ClientSafeJournalEntry,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create journal entry' };
  }
}

// ── Submit / Cancel (via document orchestrator) ─────────────────────────────────

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function submitJournalEntry(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const result = await submitDocument("Journal Entry", id);
  if (result.success) revalidatePath('/dashboard/erp/journal-entries');
  return result;
}

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function cancelJournalEntry(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const result = await cancelDocument("Journal Entry", id);
  if (result.success) revalidatePath('/dashboard/erp/journal-entries');
  return result;
}
