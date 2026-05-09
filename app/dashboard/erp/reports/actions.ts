'use server';

import { prisma } from '@/lib/prisma';
import type { StockBalanceRow, SalesAnalyticsRow } from '@/lib/erpnext/types';

export type ReportFilters = {
  from_date?: string;
  to_date?: string;
  as_of_date?: string;
  company?: string;
  fiscal_year?: string;
  periodicity?: string;
  cost_center?: string;
  project?: string;
  account?: string;
  party_type?: string;
  party?: string;
  voucher_no?: string;
  group_by?: string;
};

export type BSAccount = {
  id?: string;
  name?: string;
  account?: string;
  level?: number;
  is_group?: boolean;
  balance?: number;
  amount?: number;
};

export type BSSection = {
  accounts: BSAccount[];
  total: number;
};

export type BSData = {
  assets: BSSection;
  liabilities: BSSection;
  equity: BSSection;
  total_liabilities_and_equity: number;
};

/* ── General Ledger ──────────────────────────────────────────────────────── */

export type GLEntry = {
  id: string;
  posting_date: string;
  voucher_type: string;
  voucher_no: string;
  party_name?: string;
  debit: number;
  credit: number;
  balance?: number;
};

export async function getGeneralLedger(filters?: ReportFilters): Promise<
  { success: true; entries: GLEntry[]; total: { debit: number; credit: number } } | { success: false; error: string }
> {
  try {
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();

    const rows = await prisma.gl_entries.findMany({
      where: {
        posting_date: { gte: fromDate, lte: toDate },
      },
      orderBy: { posting_date: 'asc' },
      take: 1000,
    });

    let runningBalance = 0;
    const entries: GLEntry[] = rows.map((row) => {
      runningBalance += (row.debit || 0) - (row.credit || 0);
      return {
        id: row.id,
        posting_date: row.posting_date ? row.posting_date.toISOString().slice(0, 10) : '',
        voucher_type: row.voucher_type || 'Journal Entry',
        voucher_no: row.voucher_no || row.id,
        party_name: row.party_name || undefined,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        balance: Number(runningBalance),
      };
    });

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    return { success: true, entries, total: { debit: totalDebit, credit: totalCredit } };
  } catch (error:any) {
    console.error('[reports] General Ledger failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run General Ledger' };
  }
}

/* ── Profit & Loss ──────────────────────────────────────────────────────── */

export type PLSection = {
  accounts: BSAccount[];
  total: number;
};

export type PLData = {
  income: PLSection;
  expenses: PLSection;
  net_profit: number;
  is_profit: boolean;
};

export async function getProfitAndLoss(filters?: ReportFilters): Promise<
  { success: true; data: PLData } | { success: false; error: string }
> {
  try {
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();

    // Fetch GL entries for Income and Expense accounts
    const rows = await prisma.gl_entries.findMany({
      where: {
        posting_date: { gte: fromDate, lte: toDate },
      },
      include: { accounts: true },
      take: 5000,
    });

    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    for (const row of rows) {
      const account = row.accounts;
      if (!account) continue;
      const amount = (row.debit || 0) - (row.credit || 0);
      const map = account.root_type === 'Income' ? incomeMap : account.root_type === 'Expense' ? expenseMap : null;
      if (!map) continue;
      map.set(account.name, (map.get(account.name) || 0) + amount);
    }

    const incomeTotal = Array.from(incomeMap.values()).reduce((s, v) => s + v, 0);
    const expenseTotal = Array.from(expenseMap.values()).reduce((s, v) => s + v, 0);
    const netProfit = incomeTotal - expenseTotal;

    const data: PLData = {
      income: {
        accounts: Array.from(incomeMap.entries()).map(([name, amount]) => ({ name, account: name, amount })),
        total: incomeTotal,
      },
      expenses: {
        accounts: Array.from(expenseMap.entries()).map(([name, amount]) => ({ name, account: name, amount })),
        total: expenseTotal,
      },
      net_profit: netProfit,
      is_profit: netProfit >= 0,
    };

    return { success: true, data };
  } catch (error:any) {
    console.error('[reports] P&L failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Profit and Loss' };
  }
}

/* ── Reports Summary ────────────────────────────────────────────────────── */

export type ReportsSummary = {
  invoices: Array<{
    id: string; name: string; total: number; outstanding_amount: number;
    status: string; posting_date: string;
  }>;
  payments: Array<{ id: string; amount: number; posting_date: string }>;
  projects: Array<{ id: string; name: string; status: string; estimated_cost?: number }>;
  timesheets: Array<{ id: string; hours: number; billable: boolean }>;
  certifications: Array<{ id: string; status: string; expiry_date?: string }>;
  assets: Array<{
    id: string; name: string; status: string; next_calibration_date?: string;
  }>;
  personnel: Array<{ id: string; name: string; department?: string }>;
  items: Array<{ id: string; item_name: string; stock_qty: number; reorder_level?: number }>;
};

export async function getReportsSummary(): Promise<
  { success: true; data: ReportsSummary } | { success: false; error: string }
> {
  try {
    const [invoices, payments, projects, timesheets, certs, assets, personnel, items] = await Promise.all([
      prisma.sales_invoices.findMany({ orderBy: { created_at: 'desc' }, take: 10, select: { id: true, total: true, status: true, created_at: true } }),
      prisma.payment_entries.findMany({ orderBy: { posting_date: 'desc' }, take: 10, select: { id: true, amount: true, posting_date: true } }),
      prisma.projects.findMany({ orderBy: { created_at: 'desc' }, take: 10, select: { id: true, project_name: true, status: true, estimated_cost: true } }),
      prisma.timesheets.findMany({ orderBy: { date: 'desc' }, take: 10, select: { id: true, hours: true, billable: true } }),
      prisma.certifications.findMany({ orderBy: { expiry_date: 'asc' }, take: 10, select: { id: true, status: true, expiry_date: true } }),
      prisma.assets.findMany({ orderBy: { created_at: 'desc' }, take: 10, select: { id: true, asset_name: true, status: true } }),
      prisma.personnel.findMany({ orderBy: { created_at: 'desc' }, take: 10, select: { id: true, first_name: true, last_name: true, department: true } }),
      prisma.items.findMany({ orderBy: { created_at: 'desc' }, take: 10, select: { id: true, item_name: true } }),
    ]);

    const empty: ReportsSummary = {
      invoices: invoices.map((i) => ({ id: i.id, name: i.id, total: i.total || 0, outstanding_amount: 0, status: String(i.status), posting_date: i.created_at.toISOString().slice(0, 10) })),
      payments: payments.map((p) => ({ id: p.id, amount: p.amount || 0, posting_date: p.posting_date.toISOString().slice(0, 10) })),
      projects: projects.map((p) => ({ id: p.id, name: p.project_name || p.id, status: String(p.status), estimated_cost: p.estimated_cost || undefined })),
      timesheets: timesheets.map((t) => ({ id: t.id, hours: t.hours || 0, billable: t.billable })),
      certifications: certs.map((c) => ({ id: c.id, status: String(c.status), expiry_date: c.expiry_date ? c.expiry_date.toISOString().slice(0, 10) : undefined })),
      assets: assets.map((a) => ({ id: a.id, name: a.asset_name || a.id, status: String(a.status) })),
      personnel: personnel.map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name || ''}`.trim(), department: p.department || undefined })),
      items: items.map((i) => ({ id: i.id, item_name: i.item_name || i.id, stock_qty: 0 })),
    };
    return { success: true, data: empty };
  } catch (error:any) {
    console.error('[reports] Summary failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to load reports summary' };
  }
}

/* ── Existing report runners ────────────────────────────────────────────── */

export async function runBalanceSheet(filters?: ReportFilters): Promise<
  { success: true; data: BSData } | { success: false; error: string }
> {
  try {
    const accounts = await prisma.accounts.findMany({
      where: { root_type: { in: ['Asset', 'Liability', 'Equity'] } },
      orderBy: { lft: 'asc' },
    });

    const assets = accounts.filter((a) => a.root_type === 'Asset');
    const liabilities = accounts.filter((a) => a.root_type === 'Liability');
    const equity = accounts.filter((a) => a.root_type === 'Equity');

    const data: BSData = {
      assets: { accounts: assets.map((a) => ({ id: a.id, name: a.name, account: a.name, balance: a.balance })), total: assets.reduce((s, a) => s + a.balance, 0) },
      liabilities: { accounts: liabilities.map((a) => ({ id: a.id, name: a.name, account: a.name, balance: a.balance })), total: liabilities.reduce((s, a) => s + a.balance, 0) },
      equity: { accounts: equity.map((a) => ({ id: a.id, name: a.name, account: a.name, balance: a.balance })), total: equity.reduce((s, a) => s + a.balance, 0) },
      total_liabilities_and_equity: liabilities.reduce((s, a) => s + a.balance, 0) + equity.reduce((s, a) => s + a.balance, 0),
    };

    return { success: true, data };
  } catch (error:any) {
    console.error('[reports] Balance Sheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Balance Sheet' };
  }
}

export async function runTrialBalance(filters?: ReportFilters): Promise<
  { success: true; data: TBAccount[] } | { success: false; error: string }
> {
  try {
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();

    const rows = await prisma.gl_entries.findMany({
      where: { posting_date: { gte: fromDate, lte: toDate } },
      include: { accounts: true },
      take: 5000,
    });

    const accountMap = new Map<string, TBAccount>();
    for (const row of rows) {
      const acc = row.accounts;
      if (!acc) continue;
      const existing = accountMap.get(acc.id);
      if (existing) {
        existing.debit += row.debit || 0;
        existing.credit += row.credit || 0;
      } else {
        accountMap.set(acc.id, {
          id: acc.id,
          name: acc.name,
          account: acc.name,
          debit: row.debit || 0,
          credit: row.credit || 0,
        });
      }
    }

    return { success: true, data: Array.from(accountMap.values()) };
  } catch (error:any) {
    console.error('[reports] Trial Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Trial Balance' };
  }
}

export async function runGeneralLedger(filters?: ReportFilters): Promise<
  { success: true; data: GLEntry[] } | { success: false; error: string }
> {
  const res = await getGeneralLedger(filters);
  if (res.success) return { success: true, data: res.entries };
  return res;
}

export async function runStockBalance(filters?: ReportFilters): Promise<
  { success: true; data: StockBalanceRow[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.bins.findMany({
      include: { items: true, warehouses: true },
      take: 1000,
    });
    return {
      success: true,
      data: rows.map((b) => ({
        item_code: (b.items as Record<string, unknown> | null)?.item_code as string || b.item_id,
        warehouse: (b.warehouses as Record<string, unknown> | null)?.name as string || b.warehouse_id,
        actual_qty: b.quantity,
        projected_qty: b.quantity,
      })),
    };
  } catch (error:any) {
    console.error('[reports] Stock Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Stock Balance' };
  }
}

export async function runSalesAnalytics(filters?: ReportFilters): Promise<
  { success: true; data: SalesAnalyticsRow[] } | { success: false; error: string }
> {
  try {
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();

    const rows = await prisma.sales_orders.findMany({
      where: { created_at: { gte: fromDate, lte: toDate } },
      orderBy: { created_at: 'asc' },
      take: 2000,
    });

    const monthly = new Map<string, number>();
    for (const row of rows) {
      const key = row.created_at.toISOString().slice(0, 7); // YYYY-MM
      monthly.set(key, (monthly.get(key) || 0) + (row.total || 0));
    }

    return {
      success: true,
      data: Array.from(monthly.entries()).map(([month, total]) => ({ month, total })),
    };
  } catch (error:any) {
    console.error('[reports] Sales Analytics failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Sales Analytics' };
  }
}

export type TBAccount = {
  id: string;
  name?: string;
  account?: string;
  account_number?: string;
  root_type?: string;
  opening_debit?: number;
  opening_credit?: number;
  opening_dr?: number;
  opening_cr?: number;
  debit: number;
  credit: number;
  closing_debit?: number;
  closing_credit?: number;
  closing_dr?: number;
  closing_cr?: number;
};

export async function getTrialBalance(filters?: ReportFilters): Promise<
  { success: true; accounts: TBAccount[] } | { success: false; error: string }
> {
  const res = await runTrialBalance(filters);
  if (res.success) return { success: true, accounts: res.data };
  return res;
}

export const getBalanceSheet = runBalanceSheet;
