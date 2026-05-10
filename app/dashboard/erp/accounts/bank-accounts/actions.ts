'use server';

import { errorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeBankAccount {
  name: string;
  account_name: string;
  bank: string;
  account_type: string | null;
  bank_account_no: string | null;
  company: string | null;
  is_default: boolean;
  is_company_account: boolean;
  disabled: boolean;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeBankAccountDetail extends ClientSafeBankAccount {
  account: string | null;
  account_subtype: string | null;
  party_type: string | null;
  party: string | null;
  iban: string | null;
  branch_code: string | null;
  integration_id: string | null;
}

export interface CreateBankAccountInput {
  account_name: string;
  bank: string;
  account_type?: string;
  bank_account_no?: string;
  company?: string;
  is_default?: boolean;
  is_company_account?: boolean;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listBankAccounts(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; bankAccounts: ClientSafeBankAccount[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { account_name: { contains: search, mode: 'insensitive' as const } },
            { bank: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [bankAccounts, total] = await Promise.all([
      prisma.bankAccount.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.bankAccount.count({ where }),
    ]);

    return {
      success: true,
      total,
      bankAccounts: bankAccounts.map((ba) => ({
        name: ba.name,
        account_name: ba.account_name,
        bank: ba.bank,
        account_type: ba.account_type,
        bank_account_no: ba.bank_account_no,
        company: ba.company,
        is_default: ba.is_default || false,
        is_company_account: ba.is_company_account || false,
        disabled: ba.disabled || false,
        docstatus: ba.docstatus || 0,
        creation: ba.creation,
      })),
    };
  } catch (error) {
    console.error('[bank-accounts] listBankAccounts failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch bank accounts') };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getBankAccount(
  id: string
): Promise<{ success: true; bankAccount: ClientSafeBankAccountDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "read");
    const ba = await prisma.bankAccount.findUnique({ where: { name: id } });
    if (!ba) return { success: false, error: 'Bank Account not found' };

    return {
      success: true,
      bankAccount: {
        name: ba.name,
        account_name: ba.account_name,
        bank: ba.bank,
        account_type: ba.account_type,
        bank_account_no: ba.bank_account_no,
        company: ba.company,
        is_default: ba.is_default || false,
        is_company_account: ba.is_company_account || false,
        disabled: ba.disabled || false,
        docstatus: ba.docstatus || 0,
        creation: ba.creation,
        account: ba.account,
        account_subtype: ba.account_subtype,
        party_type: ba.party_type,
        party: ba.party,
        iban: ba.iban,
        branch_code: ba.branch_code,
        integration_id: ba.integration_id,
      },
    };
  } catch (error) {
    console.error('[bank-accounts] getBankAccount failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch bank account') };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createBankAccount(
  data: CreateBankAccountInput
): Promise<{ success: true; bankAccount: ClientSafeBankAccount } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "create");
    if (!data.account_name) return { success: false, error: 'Account name is required' };
    if (!data.bank) return { success: false, error: 'Bank is required' };

    const name = `BA-${Date.now()}`;
    const ba = await prisma.bankAccount.create({
      data: {
        name,
        account_name: data.account_name,
        bank: data.bank,
        account_type: data.account_type || null,
        bank_account_no: data.bank_account_no || null,
        company: data.company || 'Aries',
        is_default: data.is_default || false,
        is_company_account: data.is_company_account || false,
        docstatus: 0,
      },
    });

    revalidatePath('/dashboard/erp/accounts/bank-accounts');
    return {
      success: true,
      bankAccount: {
        name: ba.name,
        account_name: ba.account_name,
        bank: ba.bank,
        account_type: ba.account_type,
        bank_account_no: ba.bank_account_no,
        company: ba.company,
        is_default: ba.is_default || false,
        is_company_account: ba.is_company_account || false,
        disabled: ba.disabled || false,
        docstatus: ba.docstatus || 0,
        creation: ba.creation,
      },
    };
  } catch (error) {
    console.error('[bank-accounts] createBankAccount failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create bank account') };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteBankAccount(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Account", "delete");
    const existing = await prisma.bankAccount.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Bank Account not found' };

    await prisma.bankAccount.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/accounts/bank-accounts');
    return { success: true };
  } catch (error) {
    console.error('[bank-accounts] deleteBankAccount failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to delete bank account') };
  }
}
