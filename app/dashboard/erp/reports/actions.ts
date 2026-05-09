'use server';

import { prisma } from '@/lib/prisma';
import type { StockBalanceRow, SalesAnalyticsRow } from '@/lib/erpnext/types';
import { requirePermission } from "@/lib/erpnext/rbac";

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
    await requirePermission("Report", "read");
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();
    const rows = await prisma.glEntry.findMany({
      where: { posting_date: { gte: fromDate, lte: toDate }, is_cancelled: false },
      orderBy: { posting_date: 'asc' },
      take: 1000,
    });
    let runningBalance = 0;
    const entries: GLEntry[] = rows.map((row) => {
      runningBalance += Number(row.debit || 0) - Number(row.credit || 0);
      return {
        id: row.name,
        posting_date: row.posting_date ? row.posting_date.toISOString().slice(0, 10) : '',
        voucher_type: row.voucher_type || 'Journal Entry',
        voucher_no: row.voucher_no || row.name,
        party_name: row.party || undefined,
        debit: Number(row.debit || 0),
        credit: Number(row.credit || 0),
        balance: Number(runningBalance),
      };
    });
    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
    return { success: true, entries, total: { debit: totalDebit, credit: totalCredit } };
  } catch (error: any) {
    console.error('[reports] General Ledger failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run General Ledger' };
  }
}

/* ── Profit & Loss ──────────────────────────────────────────────────────── */

export type PLSection = { accounts: BSAccount[]; total: number };
export type PLData = { income: PLSection; expenses: PLSection; net_profit: number; is_profit: boolean };

export async function getProfitAndLoss(filters?: ReportFilters): Promise<
  { success: true; data: PLData } | { success: false; error: string }
> {
  try {
    await requirePermission("Report", "read");
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();
    const rows = await prisma.glEntry.findMany({
      where: { posting_date: { gte: fromDate, lte: toDate }, is_cancelled: false },
      take: 5000,
    });
    // Get account info for each GL entry
    const accountNames = [...new Set(rows.map((r) => r.account).filter((a): a is string => !!a))];
    const accounts = await prisma.account.findMany({
      where: { name: { in: accountNames } },
      select: { name: true, root_type: true, account_name: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.name, a]));
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    for (const row of rows) {
      const acc = accountMap.get(row.account || '');
      if (!acc) continue;
      const amount = Number(row.debit || 0) - Number(row.credit || 0);
      const map = acc.root_type === 'Income' ? incomeMap : acc.root_type === 'Expense' ? expenseMap : null;
      if (!map) continue;
      const label = acc.account_name || acc.name;
      map.set(label, (map.get(label) || 0) + amount);
    }
    const incomeTotal = Array.from(incomeMap.values()).reduce((s, v) => s + v, 0);
    const expenseTotal = Array.from(expenseMap.values()).reduce((s, v) => s + v, 0);
    const netProfit = incomeTotal - expenseTotal;
    const data: PLData = {
      income: { accounts: Array.from(incomeMap.entries()).map(([name, amount]) => ({ name, account: name, amount })), total: incomeTotal },
      expenses: { accounts: Array.from(expenseMap.entries()).map(([name, amount]) => ({ name, account: name, amount })), total: expenseTotal },
      net_profit: netProfit,
      is_profit: netProfit >= 0,
    };
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] P&L failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Profit and Loss' };
  }
}

/* ── Reports Summary ────────────────────────────────────────────────────── */

export type ReportsSummary = {
  invoices: Array<{ id: string; name: string; total: number; outstanding_amount: number; status: string; posting_date: string }>;
  payments: Array<{ id: string; amount: number; posting_date: string }>;
  projects: Array<{ id: string; name: string; status: string; estimated_cost?: number }>;
  timesheets: Array<{ id: string; hours: number; billable: boolean }>;
  certifications: Array<{ id: string; status: string; expiry_date?: string }>;
  assets: Array<{ id: string; name: string; status: string; next_calibration_date?: string }>;
  personnel: Array<{ id: string; name: string; department?: string }>;
  items: Array<{ id: string; item_name: string; stock_qty: number; reorder_level?: number }>;
};

export async function getReportsSummary(): Promise<
  { success: true; data: ReportsSummary } | { success: false; error: string }
> {
  try {
    await requirePermission("Report", "read");
    const [invoices, payments, projects, timesheets, employees, assets, items] = await Promise.all([
      prisma.salesInvoice.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, grand_total: true, status: true, creation: true, outstanding_amount: true } }),
      prisma.paymentEntry.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, paid_amount: true, posting_date: true } }),
      prisma.project.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, project_name: true, status: true, estimated_costing: true } }),
      prisma.timesheet.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, total_hours: true, total_billable_hours: true } }),
      prisma.employee.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, first_name: true, last_name: true, department: true } }),
      prisma.asset.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, asset_name: true, status: true } }),
      prisma.item.findMany({ orderBy: { creation: 'desc' }, take: 10, select: { name: true, item_name: true } }),
    ]);
    const empty: ReportsSummary = {
      invoices: invoices.map((i) => ({ id: i.name, name: i.name, total: Number(i.grand_total || 0), outstanding_amount: Number(i.outstanding_amount || 0), status: String(i.status || 'Draft'), posting_date: (i.creation || new Date()).toISOString().slice(0, 10) })),
      payments: payments.map((p) => ({ id: p.name, amount: Number(p.paid_amount || 0), posting_date: (p.posting_date || new Date()).toISOString().slice(0, 10) })),
      projects: projects.map((p) => ({ id: p.name, name: p.project_name || p.name, status: String(p.status || 'Open'), estimated_cost: p.estimated_costing ? Number(p.estimated_costing) : undefined })),
      timesheets: timesheets.map((t) => ({ id: t.name, hours: t.total_hours || 0, billable: (t.total_billable_hours ?? 0) > 0 })),
      certifications: employees.map((e) => ({ id: e.name, status: 'Active', expiry_date: undefined })),
      assets: assets.map((a) => ({ id: a.name, name: a.asset_name || a.name, status: String(a.status || 'Draft') })),
      personnel: employees.map((p) => ({ id: p.name, name: `${p.first_name} ${p.last_name || ''}`.trim(), department: p.department || undefined })),
      items: items.map((i) => ({ id: i.name, item_name: i.item_name || i.name, stock_qty: 0 })),
    };
    return { success: true, data: empty };
  } catch (error: any) {
    console.error('[reports] Summary failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to load reports summary' };
  }
}

/* ── Balance Sheet ──────────────────────────────────────────────────────── */

export async function runBalanceSheet(filters?: ReportFilters): Promise<
  { success: true; data: BSData } | { success: false; error: string }
> {
  try {
    await requirePermission("Report", "read");
    const accounts = await prisma.account.findMany({
      where: { root_type: { in: ['Asset', 'Liability', 'Equity'] } },
      orderBy: { lft: 'asc' },
    });
    const assets = accounts.filter((a) => a.root_type === 'Asset');
    const liabilities = accounts.filter((a) => a.root_type === 'Liability');
    const equity = accounts.filter((a) => a.root_type === 'Equity');
    const data: BSData = {
      assets: { accounts: assets.map((a) => ({ id: a.name, name: a.account_name || a.name, account: a.account_name || a.name, balance: 0 })), total: 0 },
      liabilities: { accounts: liabilities.map((a) => ({ id: a.name, name: a.account_name || a.name, account: a.account_name || a.name, balance: 0 })), total: 0 },
      equity: { accounts: equity.map((a) => ({ id: a.name, name: a.account_name || a.name, account: a.account_name || a.name, balance: 0 })), total: 0 },
      total_liabilities_and_equity: 0,
    };
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] Balance Sheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Balance Sheet' };
  }
}

/* ── Trial Balance ──────────────────────────────────────────────────────── */

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

export async function runTrialBalance(filters?: ReportFilters): Promise<
  { success: true; data: TBAccount[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Report", "read");
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();
    const rows = await prisma.glEntry.findMany({
      where: { posting_date: { gte: fromDate, lte: toDate }, is_cancelled: false },
      take: 5000,
    });
    const accountNames = [...new Set(rows.map((r) => r.account).filter((a): a is string => !!a))];
    const accounts = await prisma.account.findMany({
      where: { name: { in: accountNames } },
      select: { name: true, account_name: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.name, a]));
    const accountAgg = new Map<string, TBAccount>();
    for (const row of rows) {
      const acc = accountMap.get(row.account || '');
      if (!acc) continue;
      const existing = accountAgg.get(acc.name);
      if (existing) {
        existing.debit += Number(row.debit || 0);
        existing.credit += Number(row.credit || 0);
      } else {
        accountAgg.set(acc.name, {
          id: acc.name,
          name: acc.account_name || acc.name,
          account: acc.account_name || acc.name,
          debit: Number(row.debit || 0),
          credit: Number(row.credit || 0),
        });
      }
    }
    return { success: true, data: Array.from(accountAgg.values()) };
  } catch (error: any) {
    console.error('[reports] Trial Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Trial Balance' };
  }
}

export async function runGeneralLedger(filters?: ReportFilters): Promise<
  { success: true; data: GLEntry[] } | { success: false; error: string }
> {
  await requirePermission("Report", "read");
  const res = await getGeneralLedger(filters);
  if (res.success) return { success: true, data: res.entries };
  return res;
}

export async function runStockBalance(filters?: ReportFilters): Promise<
  { success: true; data: StockBalanceRow[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Report", "read");
    const rows = await prisma.bin.findMany({ take: 1000 });
    return {
      success: true,
      data: rows.map((b) => ({
        item_code: b.item_code,
        warehouse: b.warehouse,
        actual_qty: b.actual_qty || 0,
        projected_qty: b.projected_qty || 0,
      })),
    };
  } catch (error: any) {
    console.error('[reports] Stock Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Stock Balance' };
  }
}

export async function runSalesAnalytics(filters?: ReportFilters): Promise<
  { success: true; data: SalesAnalyticsRow[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Report", "read");
    const fromDate = filters?.from_date ? new Date(filters.from_date) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = filters?.to_date ? new Date(filters.to_date) : new Date();
    const rows = await prisma.salesOrder.findMany({
      where: { creation: { gte: fromDate, lte: toDate } },
      orderBy: { creation: 'asc' },
      take: 2000,
    });
    const monthly = new Map<string, number>();
    for (const row of rows) {
      const key = (row.creation || new Date()).toISOString().slice(0, 7);
      monthly.set(key, (monthly.get(key) || 0) + Number(row.total || 0));
    }
    return { success: true, data: Array.from(monthly.entries()).map(([month, total]) => ({ month, total })) };
  } catch (error: any) {
    console.error('[reports] Sales Analytics failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Sales Analytics' };
  }
}

export async function getTrialBalance(filters?: ReportFilters): Promise<
  { success: true; accounts: TBAccount[] } | { success: false; error: string }
> {
  await requirePermission("Report", "read");
  const res = await runTrialBalance(filters);
  if (res.success) return { success: true, accounts: res.data };
  return res;
}

export const getBalanceSheet = runBalanceSheet;
