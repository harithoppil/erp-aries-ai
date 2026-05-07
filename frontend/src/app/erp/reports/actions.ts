'use server';

import { prisma } from '@/lib/prisma';
import { API_BASE } from '@/lib/api';
import { listInvoices, type ClientSafeInvoice } from '@/app/erp/accounts/actions';
import { listPayments, type ClientSafePayment } from '@/app/erp/payments/actions';
import { listProjects, type ClientSafeProject } from '@/app/erp/projects/actions';
import { listPersonnel, type ClientSafePersonnel } from '@/app/erp/hr/actions';
import { listAssets, type ClientSafeAsset } from '@/app/erp/assets/actions';
import { listItems, type ClientSafeItem } from '@/app/erp/stock/actions';
import { listTimesheets, type ClientSafeTimesheet } from '@/app/erp/timesheets/actions';

export type ClientSafeCertification = {
  id: string;
  personnel_id: string;
  cert_type: string;
  issuing_body: string | null;
  issue_date: Date | null;
  expiry_date: Date | null;
  cert_number: string | null;
  status: string;
};

export interface ReportsSummary {
  invoices: ClientSafeInvoice[];
  payments: ClientSafePayment[];
  projects: ClientSafeProject[];
  personnel: ClientSafePersonnel[];
  assets: ClientSafeAsset[];
  items: ClientSafeItem[];
  timesheets: ClientSafeTimesheet[];
  certifications: ClientSafeCertification[];
}

export async function getReportsSummary(): Promise<
  { success: true; data: ReportsSummary } | { success: false; error: string }
> {
  try {
    const [
      invRes, payRes, projRes, perRes, assetRes, itemRes, tsRes,
    ] = await Promise.all([
      listInvoices(),
      listPayments(),
      listProjects(),
      listPersonnel(),
      listAssets(),
      listItems(),
      listTimesheets(),
    ]);

    // Certifications come directly from Prisma
    const certifications = await prisma.certifications.findMany({ orderBy: { issue_date: 'desc' } });
    const clientSafeCerts: ClientSafeCertification[] = certifications.map((c) => ({
      id: c.id,
      personnel_id: c.personnel_id,
      cert_type: c.cert_type,
      issuing_body: c.issuing_body,
      issue_date: c.issue_date,
      expiry_date: c.expiry_date,
      cert_number: c.cert_number,
      status: String(c.status),
    }));

    return {
      success: true,
      data: {
        invoices: invRes.success ? invRes.invoices : [],
        payments: payRes.success ? payRes.payments : [],
        projects: projRes.success ? projRes.projects : [],
        personnel: perRes.success ? perRes.personnel : [],
        assets: assetRes.success ? assetRes.assets : [],
        items: itemRes.success ? itemRes.items : [],
        timesheets: tsRes.success ? tsRes.timesheets : [],
        certifications: clientSafeCerts,
      }
    };
  } catch (error) {
    console.error('Error fetching reports summary:', error);
    return { success: false, error: 'Failed to fetch reports data' };
  }
}

// ── Financial Report Server Actions ────────────────────────────────────────
// These proxy to the Python backend which does complex SQL aggregations
// for GL entries, trial balance, balance sheet, and P&L.

async function reportFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail || err);
    throw new Error(msg || 'Report fetch failed');
  }
  return res.json();
}

export interface GLEntry {
  id?: string;
  voucher_no?: string | null;
  voucher_type?: string | null;
  posting_date: string;
  account?: string;
  account_id?: string;
  party_type?: string | null;
  party_name?: string | null;
  debit: number;
  credit: number;
  balance?: number;
  cost_center?: string | null;
  against_account?: string | null;
  remarks?: string | null;
}

export async function getGeneralLedger(params: {
  from_date?: string;
  to_date?: string;
  voucher_no?: string;
}): Promise<
  { success: true; entries: GLEntry[]; total: { debit: number; credit: number } } | { success: false; error: string }
> {
  try {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set('from_date', params.from_date);
    if (params.to_date) qs.set('to_date', params.to_date);
    if (params.voucher_no) qs.set('voucher_no', params.voucher_no);
    const data = await reportFetch<{ entries: GLEntry[]; total: { debit: number; credit: number } }>(
      `/erp/reports/general-ledger?${qs.toString()}`
    );
    return { success: true, entries: data.entries || [], total: data.total || { debit: 0, credit: 0 } };
  } catch (error: any) {
    console.error('[reports] getGeneralLedger failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch general ledger' };
  }
}

export interface TBAccount {
  id?: string;
  name?: string;
  account?: string;
  account_number?: string | null;
  root_type?: string;
  is_group?: boolean;
  opening_debit?: number;
  opening_credit?: number;
  opening_dr?: number;
  opening_cr?: number;
  debit: number;
  credit: number;
  period_dr?: number;
  period_cr?: number;
  closing_debit?: number;
  closing_credit?: number;
  closing_dr?: number;
  closing_cr?: number;
}

export async function getTrialBalance(params: {
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; accounts: TBAccount[] } | { success: false; error: string }
> {
  try {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set('from_date', params.from_date);
    if (params.to_date) qs.set('to_date', params.to_date);
    const data = await reportFetch<{ accounts: TBAccount[] }>(
      `/erp/reports/trial-balance?${qs.toString()}`
    );
    return { success: true, accounts: data.accounts || [] };
  } catch (error: any) {
    console.error('[reports] getTrialBalance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch trial balance' };
  }
}

export interface BSAccount {
  id?: string;
  name?: string;
  account?: string;
  account_number?: string | null;
  is_group?: boolean;
  balance?: number;
  amount?: number;
  level?: number;
}

export interface BSSection {
  label?: string;
  accounts: BSAccount[];
  total: number;
}

export interface BSData {
  as_of_date?: string;
  company?: string;
  assets: BSSection;
  liabilities: BSSection;
  equity: BSSection;
  total_liabilities_and_equity: number;
}

export async function getBalanceSheet(params: {
  as_of_date?: string;
}): Promise<
  { success: true; data: BSData } | { success: false; error: string }
> {
  try {
    const qs = new URLSearchParams();
    if (params.as_of_date) qs.set('as_of_date', params.as_of_date);
    const data = await reportFetch<BSData>(
      `/erp/reports/balance-sheet?${qs.toString()}`
    );
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] getBalanceSheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch balance sheet' };
  }
}

export interface PLAccount {
  id?: string;
  name?: string;
  account?: string;
  account_number?: string | null;
  is_group?: boolean;
  balance?: number;
  amount?: number;
  level?: number;
}

export interface PLSection {
  label?: string;
  accounts: PLAccount[];
  total: number;
}

export interface PLData {
  from_date?: string;
  to_date?: string;
  company?: string;
  income: PLSection;
  expenses: PLSection;
  net_profit: number;
  is_profit: boolean;
}

export async function getProfitAndLoss(params: {
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; data: PLData } | { success: false; error: string }
> {
  try {
    const qs = new URLSearchParams();
    if (params.from_date) qs.set('from_date', params.from_date);
    if (params.to_date) qs.set('to_date', params.to_date);
    const data = await reportFetch<PLData>(
      `/erp/reports/profit-and-loss?${qs.toString()}`
    );
    return { success: true, data };
  } catch (error: any) {
    console.error('[reports] getProfitAndLoss failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch profit and loss' };
  }
}
