'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeJournalEntry = {
  id: string;
  entry_number: string;
  posting_date: string;
  voucher_type: string;
  total_debit: number;
  total_credit: number;
  status: string;
  remarks: string | null;
  created_at: Date | null;
  // Legacy aliases for client component compatibility
  entry_type?: 'debit' | 'credit' | 'DEBIT' | 'CREDIT';
  amount?: number;
  account?: string;
  party_name?: string | null;
  reference?: string | null;
};

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listJournalEntries(): Promise<
  { success: true; entries: ClientSafeJournalEntry[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Journal Entry", "read");
    const rows = await prisma.journalEntry.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      entries: rows.map((e) => ({
        id: e.name,
        entry_number: e.name,
        posting_date: e.posting_date ? e.posting_date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        voucher_type: e.voucher_type || 'Journal Entry',
        total_debit: Number(e.total_debit || 0),
        total_credit: Number(e.total_credit || 0),
        status: e.docstatus === 1 ? 'Submitted' : e.docstatus === 2 ? 'Cancelled' : 'Draft',
        remarks: e.user_remark || null,
        created_at: e.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching journal entries:', msg);
    return { success: false, error: msg || 'Failed to fetch journal entries' };
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
  await requirePermission("Journal Entry", "create");
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
    const name = `JV-${Date.now()}`;
    const record = await prisma.journalEntry.create({
      data: {
        name,
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        voucher_type: data.voucher_type || 'Journal Entry',
        company: 'Aries',
        user_remark: data.remarks || data.notes || data.reference || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        naming_series: 'JV-',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    // Create child account rows if we have them
    if (accounts.length > 0) {
      for (const acc of accounts) {
        await prisma.journalEntryAccount.create({
          data: {
            name: `JEA-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            parent: name,
            parentfield: 'accounts',
            parenttype: 'Journal Entry',
            account: acc.account,
            debit: acc.debit,
            credit: acc.credit,
            creation: new Date(),
            modified: new Date(),
            owner: 'Administrator',
            modified_by: 'Administrator',
          },
        });
      }
    }

    return {
      success: true as const,
      entry: {
        id: record.name,
        entry_number: record.name,
        posting_date: record.posting_date ? record.posting_date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        voucher_type: record.voucher_type || 'Journal Entry',
        total_debit: totalDebit,
        total_credit: totalCredit,
        status: 'Draft',
        remarks: data.remarks || data.notes || data.reference || null,
        created_at: record.creation,
      } as ClientSafeJournalEntry,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create journal entry' };
  }
}

// ── Submit / Cancel ─────────────────────────────────────────────────────────

export async function submitJournalEntry(id: string): Promise<SubmitResult> {
  await requirePermission("Journal Entry", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Journal Entry", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/journal-entries');
  return result;
}

export async function cancelJournalEntry(id: string): Promise<CancelResult> {
  await requirePermission("Journal Entry", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Journal Entry", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/journal-entries');
  return result;
}
