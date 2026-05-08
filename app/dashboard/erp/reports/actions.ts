'use server';

import { frappeRunReport, frappeCallMethod } from '@/lib/frappe-client';

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
    const data = await frappeRunReport<any>('General Ledger', {
      company: filters?.company || 'Aries Marine',
      from_date: filters?.from_date || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
      to_date: filters?.to_date || new Date().toISOString().slice(0, 10),
      ...filters,
    });

    const entries: GLEntry[] = (data || []).map((row: any) => ({
      id: row.name || row.voucher_no || String(Math.random()),
      posting_date: row.posting_date || row.date,
      voucher_type: row.voucher_type || 'Journal Entry',
      voucher_no: row.voucher_no || row.name,
      party_name: row.party,
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      balance: Number(row.balance || 0),
    }));

    const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

    return { success: true, entries, total: { debit: totalDebit, credit: totalCredit } };
  } catch (error: any) {
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
    const raw = await frappeRunReport<any>('Profit and Loss Statement', {
      company: filters?.company || 'Aries Marine',
      from_fiscal_year: filters?.fiscal_year || '2025-2026',
      to_fiscal_year: filters?.fiscal_year || '2025-2026',
      period: filters?.periodicity || 'Monthly',
      ...filters,
    });

    const data: PLData = {
      income: { accounts: [], total: 0 },
      expenses: { accounts: [], total: 0 },
      net_profit: 0,
      is_profit: true,
    };

    return { success: true, data };
  } catch (error: any) {
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
    const empty: ReportsSummary = {
      invoices: [], payments: [], projects: [], timesheets: [],
      certifications: [], assets: [], personnel: [], items: [],
    };
    return { success: true, data: empty };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to load reports summary' };
  }
}

/* ── Existing report runners ────────────────────────────────────────────── */

export async function runBalanceSheet(filters?: ReportFilters): Promise<
  { success: true; data: any } | { success: false; error: string }
> {
  try {
    const data = await frappeRunReport<any>('Balance Sheet', {
      company: filters?.company || 'Aries Marine',
      from_fiscal_year: filters?.fiscal_year || '2025-2026',
      to_fiscal_year: filters?.fiscal_year || '2025-2026',
      period: filters?.periodicity || 'Monthly',
      ...filters,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] Balance Sheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Balance Sheet' };
  }
}

export async function runTrialBalance(filters?: ReportFilters): Promise<
  { success: true; data: any } | { success: false; error: string }
> {
  try {
    const data = await frappeRunReport<any>('Trial Balance', {
      company: filters?.company || 'Aries Marine',
      from_fiscal_year: filters?.fiscal_year || '2025-2026',
      to_fiscal_year: filters?.fiscal_year || '2025-2026',
      period: filters?.periodicity || 'Monthly',
      ...filters,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] Trial Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Trial Balance' };
  }
}

export async function runGeneralLedger(filters?: ReportFilters): Promise<
  { success: true; data: any } | { success: false; error: string }
> {
  try {
    const data = await frappeRunReport<any>('General Ledger', {
      company: filters?.company || 'Aries Marine',
      from_date: filters?.from_date || new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
      to_date: filters?.to_date || new Date().toISOString().slice(0, 10),
      ...filters,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] General Ledger failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run General Ledger' };
  }
}

export async function runStockBalance(filters?: ReportFilters): Promise<
  { success: true; data: any } | { success: false; error: string }
> {
  try {
    const data = await frappeRunReport<any>('Stock Balance', {
      company: filters?.company || 'Aries Marine',
      to_date: filters?.to_date || new Date().toISOString().slice(0, 10),
      ...filters,
    });
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] Stock Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Stock Balance' };
  }
}

export async function runSalesAnalytics(filters?: ReportFilters): Promise<
  { success: true; data: any } | { success: false; error: string }
> {
  try {
    const data = await frappeRunReport<any>('Sales Analytics', {
      company: filters?.company || 'Aries Marine',
      from_date: filters?.from_date,
      to_date: filters?.to_date,
      ...filters,
    });
    return { success: true, data };
  } catch (error: any) {
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
  try {
    const data = await frappeRunReport<any>('Trial Balance', {
      company: filters?.company || 'Aries Marine',
      from_fiscal_year: filters?.fiscal_year || '2025-2026',
      to_fiscal_year: filters?.fiscal_year || '2025-2026',
      period: filters?.periodicity || 'Monthly',
      ...filters,
    });
    const accounts: TBAccount[] = (data || []).map((row: any) => ({
      id: row.name || row.account || String(Math.random()),
      name: row.account_name || row.name,
      account: row.account,
      account_number: row.account_number,
      root_type: row.root_type || row.account_type,
      opening_debit: Number(row.opening_debit || row.opening_dr || 0),
      opening_credit: Number(row.opening_credit || row.opening_cr || 0),
      debit: Number(row.debit || 0),
      credit: Number(row.credit || 0),
      closing_debit: Number(row.closing_debit || row.closing_dr || 0),
      closing_credit: Number(row.closing_credit || row.closing_cr || 0),
    }));
    return { success: true, accounts };
  } catch (error: any) {
    console.error('[reports] Trial Balance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run Trial Balance' };
  }
}

export const getBalanceSheet = runBalanceSheet;
