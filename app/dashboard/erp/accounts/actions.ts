'use server';

import { prisma } from '@/lib/prisma';

export interface AccountTreeNode {
  id: string;
  account_number: string | null;
  name: string;
  root_type: string;
  level: number;
  is_group: boolean;
  balance: number;
  children: AccountTreeNode[];
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface AgeingBucket {
  label: string;
  count: number;
  total: number;
}

export interface AccountsAgeingData {
  buckets: AgeingBucket[];
  totalOutstanding: number;
}

export interface InvoicingDashboardData {
  totalOutgoing: number;
  totalIncoming: number;
  totalIncomingPayment: number;
  totalOutgoingPayment: number;
}

interface AccountTreeResult {
  success: boolean;
  accounts: AccountTreeNode[];
  error?: string;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getInvoicingDashboardData(): Promise<InvoicingDashboardData> {
  try {
    const [outgoing, incoming, inPay, outPay] = await Promise.all([
      prisma.salesInvoice.aggregate({ _sum: { grand_total: true } }).catch(() => ({ _sum: { grand_total: null } })),
      prisma.purchaseInvoice.aggregate({ _sum: { grand_total: true } }).catch(() => ({ _sum: { grand_total: null } })),
      prisma.paymentEntry.aggregate({ _sum: { paid_amount: true }, where: { payment_type: 'Receive' } }).catch(() => ({ _sum: { paid_amount: null } })),
      prisma.paymentEntry.aggregate({ _sum: { paid_amount: true }, where: { payment_type: 'Pay' } }).catch(() => ({ _sum: { paid_amount: null } })),
    ]);

    return {
      totalOutgoing: Number(outgoing._sum.grand_total) || 0,
      totalIncoming: Number(incoming._sum.grand_total) || 0,
      totalIncomingPayment: Number(inPay._sum.paid_amount) || 0,
      totalOutgoingPayment: Number(outPay._sum.paid_amount) || 0,
    };
  } catch {
    return { totalOutgoing: 0, totalIncoming: 0, totalIncomingPayment: 0, totalOutgoingPayment: 0 };
  }
}

// ── Ageing ──────────────────────────────────────────────────────────────────

export async function getAccountsReceivableAgeing(): Promise<AccountsAgeingData> {
  // Stub ageing data — replace with real GL query
  return {
    buckets: [
      { label: '0-30', count: 0, total: 0 },
      { label: '31-60', count: 0, total: 0 },
      { label: '61-90', count: 0, total: 0 },
      { label: '91-120', count: 0, total: 0 },
      { label: '>120', count: 0, total: 0 },
    ],
    totalOutstanding: 0,
  };
}

export async function getAccountsPayableAgeing(): Promise<AccountsAgeingData> {
  // Stub ageing data — replace with real GL query
  return {
    buckets: [
      { label: '0-30', count: 0, total: 0 },
      { label: '31-60', count: 0, total: 0 },
      { label: '61-90', count: 0, total: 0 },
      { label: '91-120', count: 0, total: 0 },
      { label: '>120', count: 0, total: 0 },
    ],
    totalOutstanding: 0,
  };
}

// ── Chart of Accounts Tree ─────────────────────────────────────────────────

export async function getAccountTree(): Promise<AccountTreeResult> {
  try {
    const accounts = await prisma.account.findMany({
      where: { disabled: false },
      orderBy: { account_number: 'asc' },
      select: {
        name: true,
        account_number: true,
        root_type: true,
        is_group: true,
        parent_account: true,
      },
    });

    const nodes: AccountTreeNode[] = accounts.map((a) => ({
      id: a.name,
      account_number: a.account_number,
      name: a.name,
      root_type: a.root_type ?? '',
      level: 0,
      is_group: a.is_group,
      balance: 0,
      children: [],
    }));

    return { success: true, accounts: nodes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, accounts: [], error: msg };
  }
}
