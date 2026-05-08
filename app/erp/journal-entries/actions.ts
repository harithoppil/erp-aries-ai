'use server';

import { prisma } from '@/lib/prisma';
import { journalentrytype } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeJournalEntry = {
  id: string;
  entry_number: string;
  posting_date: Date;
  reference: string | null;
  account: string | null;
  party_type: string | null;
  party_name: string | null;
  entry_type: string | null;
  amount: number | null;
  currency: string;
  notes: string | null;
  total_debit: number;
  total_credit: number;
  status: string;
  created_at: Date;
};

export async function listJournalEntries(): Promise<
  { success: true; entries: ClientSafeJournalEntry[] } | { success: false; error: string }
> {
  try {
    const entries = await prisma.journal_entries.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, entries: entries.map((e) => ({ ...e, entry_type: e.entry_type ? String(e.entry_type) : null })) };
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    return { success: false, error: 'Failed to fetch journal entries' };
  }
}

export async function createJournalEntry(data: {
  account: string;
  entry_type: string;
  amount: number;
  party_type?: string;
  party_name?: string;
  reference?: string;
  notes?: string;
}) {
  try {
    const entryNumber = `JV-${Date.now().toString().slice(-6)}`;
    const amount = data.amount;
    const entry = await prisma.journal_entries.create({
      data: {
        id: randomUUID(),
        entry_number: entryNumber,
        account: data.account,
        entry_type: data.entry_type.toLowerCase() === 'debit' ? journalentrytype.DEBIT : journalentrytype.CREDIT,
        amount: amount,
        currency: 'AED',
        total_debit: data.entry_type.toLowerCase() === 'debit' ? amount : 0,
        total_credit: data.entry_type.toLowerCase() === 'credit' ? amount : 0,
        party_type: data.party_type || null,
        party_name: data.party_name || null,
        reference: data.reference || null,
        notes: data.notes || null,
        status: 'draft',
      }
    });
    revalidatePath('/erp/journal-entries');
    return { success: true as const, entry: { ...entry, entry_type: entry.entry_type ? String(entry.entry_type) : null } as ClientSafeJournalEntry };
  } catch (error: any) {
    console.error('Create journal entry error:', error);
    if (error.code === 'P2002') return { success: false as const, error: 'Entry number already exists' };
    return { success: false as const, error: error.message || 'Failed to create journal entry' };
  }
}

// ── Journal Entry Mutations ───────────────────────────────────────────────

export async function updateJournalEntryStatus(id: string, status: 'draft' | 'submitted' | 'cancelled') {
  try {
    const record = await prisma.journal_entries.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/journal-entries');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[journal-entries] updateJournalEntryStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update journal entry status' };
  }
}

export async function updateJournalEntry(
  id: string,
  data: Partial<{
    account: string;
    entry_type: string;
    amount: number;
    party_type: string;
    party_name: string;
    reference: string;
    notes: string;
  }>
) {
  try {
    // Only allow updates on DRAFT entries
    const existing = await prisma.journal_entries.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return { success: false, error: 'Journal entry not found' };
    if (existing.status !== 'draft') return { success: false, error: 'Only DRAFT entries can be updated' };

    const updateData: Record<string, unknown> = { ...data };
    if (data.entry_type) {
      updateData.entry_type = data.entry_type.toLowerCase() === 'debit' ? journalentrytype.DEBIT : journalentrytype.CREDIT;
      updateData.total_debit = data.entry_type.toLowerCase() === 'debit' && data.amount ? data.amount : undefined;
      updateData.total_credit = data.entry_type.toLowerCase() === 'credit' && data.amount ? data.amount : undefined;
    }

    const record = await prisma.journal_entries.update({
      where: { id },
      data: updateData,
    });
    revalidatePath('/erp/journal-entries');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[journal-entries] updateJournalEntry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update journal entry' };
  }
}

export async function deleteJournalEntry(id: string) {
  try {
    // Only allow cancellation of DRAFT entries
    const existing = await prisma.journal_entries.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return { success: false, error: 'Journal entry not found' };
    if (existing.status !== 'draft') return { success: false, error: 'Only DRAFT entries can be cancelled' };

    await prisma.journal_entries.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    revalidatePath('/erp/journal-entries');
    return { success: true };
  } catch (error: any) {
    console.error('[journal-entries] deleteJournalEntry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete journal entry' };
  }
}
