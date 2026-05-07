'use server';

import { prisma } from '@/lib/prisma';
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
// Direct Prisma $queryRaw — no Python proxy needed.
// Ported from backend/app/api/routes/erp_financial_reports.py

// ── General Ledger ───────────────────────────────────────────────────────

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
    const fromDate = params.from_date || '2026-01-01';
    const toDate = params.to_date || '2026-12-31';

    // Build WHERE clause dynamically
    const conditions = [
      `ge.posting_date >= $1::timestamptz`,
      `ge.posting_date <= $2::timestamptz`,
      `ge.is_cancelled = false`,
    ];
    const queryParams: any[] = [fromDate, toDate];
    let paramIdx = 3;

    if (params.voucher_no) {
      conditions.push(`ge.voucher_no ILIKE $${paramIdx}`);
      queryParams.push(`%${params.voucher_no}%`);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Fetch entries with running balance (window function)
    const entries = await prisma.$queryRawUnsafe<Array<{
      id: string;
      posting_date: Date;
      account_id: string | null;
      party_type: string | null;
      party_name: string | null;
      voucher_type: string | null;
      voucher_no: string | null;
      debit: number;
      credit: number;
      balance: number;
      cost_center: string | null;
      remarks: string | null;
    }>>(`
      SELECT
        ge.id,
        ge.posting_date,
        ge.account_id,
        ge.party_type,
        ge.party_name,
        ge.voucher_type,
        ge.voucher_no,
        ge.debit,
        ge.credit,
        ROUND(SUM(ge.debit - ge.credit) OVER (ORDER BY ge.posting_date, ge.voucher_no, ge.created_at), 2) as balance,
        ge.cost_center,
        ge.remarks
      FROM gl_entries ge
      WHERE ${whereClause}
      ORDER BY ge.posting_date, ge.voucher_no, ge.created_at
      LIMIT 500
    `, ...queryParams);

    // Calculate totals
    const totalResult = await prisma.$queryRawUnsafe<Array<{
      total_debit: number;
      total_credit: number;
    }>>(`
      SELECT COALESCE(SUM(ge.debit), 0) as total_debit,
             COALESCE(SUM(ge.credit), 0) as total_credit
      FROM gl_entries ge
      WHERE ${whereClause}
    `, ...queryParams);

    const totals = totalResult[0] || { total_debit: 0, total_credit: 0 };

    const mapped: GLEntry[] = entries.map((e) => ({
      id: e.id,
      posting_date: e.posting_date?.toISOString()?.split('T')[0] || '',
      account_id: e.account_id || undefined,
      party_type: e.party_type,
      party_name: e.party_name,
      voucher_type: e.voucher_type,
      voucher_no: e.voucher_no,
      debit: Number(e.debit) || 0,
      credit: Number(e.credit) || 0,
      balance: Number(e.balance) || 0,
      cost_center: e.cost_center,
      remarks: e.remarks,
    }));

    return {
      success: true,
      entries: mapped,
      total: { debit: Number(totals.total_debit) || 0, credit: Number(totals.total_credit) || 0 },
    };
  } catch (error: any) {
    console.error('[reports] getGeneralLedger failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch general ledger' };
  }
}

// ── Trial Balance ────────────────────────────────────────────────────────

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
    const fromDate = params.from_date || '2026-01-01';
    const toDate = params.to_date || '2026-12-31';
    const company = 'Aries Marine';

    // 1. Get all accounts for company ordered by lft
    const accounts = await prisma.accounts.findMany({
      where: { company },
      orderBy: { lft: 'asc' },
    });

    // 2. Get opening balances (before from_date)
    const opening = await prisma.$queryRawUnsafe<Array<{
      account_id: string;
      debit: number;
      credit: number;
    }>>(`
      SELECT account_id, SUM(debit) as debit, SUM(credit) as credit
      FROM gl_entries
      WHERE posting_date < $1::timestamptz AND is_cancelled = false
      GROUP BY account_id
    `, fromDate);

    const openingMap = new Map<string, { debit: number; credit: number }>();
    for (const r of opening) {
      openingMap.set(r.account_id, { debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 });
    }

    // 3. Get period movements (from_date to to_date)
    const period = await prisma.$queryRawUnsafe<Array<{
      account_id: string;
      debit: number;
      credit: number;
    }>>(`
      SELECT account_id, SUM(debit) as debit, SUM(credit) as credit
      FROM gl_entries
      WHERE posting_date >= $1::timestamptz AND posting_date <= $2::timestamptz AND is_cancelled = false
      GROUP BY account_id
    `, fromDate, toDate);

    const periodMap = new Map<string, { debit: number; credit: number }>();
    for (const r of period) {
      periodMap.set(r.account_id, { debit: Number(r.debit) || 0, credit: Number(r.credit) || 0 });
    }

    // 4. Build trial balance rows (matching Python logic exactly)
    const rows: TBAccount[] = [];
    for (const a of accounts) {
      const aid = a.id;
      const opDr = openingMap.get(aid)?.debit || 0;
      const opCr = openingMap.get(aid)?.credit || 0;
      const perDr = periodMap.get(aid)?.debit || 0;
      const perCr = periodMap.get(aid)?.credit || 0;

      const opening = opDr - opCr;
      const closing = opening + perDr - perCr;

      // Skip zero-balance accounts
      if (opening === 0 && perDr === 0 && perCr === 0 && closing === 0) continue;

      rows.push({
        id: aid,
        name: a.name,
        account_number: a.account_number,
        root_type: a.root_type ?? undefined,
        is_group: a.is_group,
        opening_debit: opening > 0 ? Math.round(Math.max(opening, 0) * 100) / 100 : 0,
        opening_credit: opening < 0 ? Math.round(Math.abs(Math.min(opening, 0)) * 100) / 100 : 0,
        debit: Math.round(perDr * 100) / 100,
        credit: Math.round(perCr * 100) / 100,
        closing_debit: closing > 0 ? Math.round(Math.max(closing, 0) * 100) / 100 : 0,
        closing_credit: closing < 0 ? Math.round(Math.abs(Math.min(closing, 0)) * 100) / 100 : 0,
      });
    }

    return { success: true, accounts: rows };
  } catch (error: any) {
    console.error('[reports] getTrialBalance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch trial balance' };
  }
}

// ── Balance Sheet ────────────────────────────────────────────────────────

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
    const asOfDate = params.as_of_date || '2026-12-31';
    const company = 'Aries Marine';

    // 1. Get Asset/Liability/Equity accounts ordered by lft
    const accounts = await prisma.accounts.findMany({
      where: {
        company,
        root_type: { in: ['Asset', 'Liability', 'Equity'] },
      },
      orderBy: { lft: 'asc' },
    });

    // 2. Get balances up to as_of_date
    const balances = await prisma.$queryRawUnsafe<Array<{
      account_id: string;
      debit: number;
      credit: number;
    }>>(`
      SELECT account_id, SUM(debit) as debit, SUM(credit) as credit
      FROM gl_entries
      WHERE posting_date <= $1::timestamptz AND is_cancelled = false
      GROUP BY account_id
    `, asOfDate);

    const balanceMap = new Map<string, number>();
    for (const r of balances) {
      balanceMap.set(r.account_id, Number(r.debit) - Number(r.credit));
    }

    // 3. Build sections (matching Python logic)
    function buildSection(rootType: string): { accounts: BSAccount[]; total: number } {
      const sectionAccounts = accounts.filter((a) => a.root_type === rootType);
      const items: BSAccount[] = [];
      let total = 0;

      for (const a of sectionAccounts) {
        const bal = balanceMap.get(a.id) || 0;
        if (bal === 0 && !a.is_group) continue;
        if (!a.is_group) total += bal;
        items.push({
          id: a.id,
          name: a.name,
          account_number: a.account_number,
          is_group: a.is_group,
          balance: Math.round(bal * 100) / 100,
          level: 0,
        });
      }

      return { accounts: items, total: Math.round(total * 100) / 100 };
    }

    const assets = buildSection('Asset');
    const liabilities = buildSection('Liability');
    const equity = buildSection('Equity');

    return {
      success: true,
      data: {
        as_of_date: asOfDate,
        company,
        assets,
        liabilities,
        equity,
        total_liabilities_and_equity: Math.round((liabilities.total + equity.total) * 100) / 100,
      },
    };
  } catch (error: any) {
    console.error('[reports] getBalanceSheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch balance sheet' };
  }
}

// ── Profit & Loss ────────────────────────────────────────────────────────

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
    const fromDate = params.from_date || '2026-01-01';
    const toDate = params.to_date || '2026-12-31';
    const company = 'Aries Marine';

    // 1. Get Income/Expense accounts ordered by lft
    const accounts = await prisma.accounts.findMany({
      where: {
        company,
        root_type: { in: ['Income', 'Expense'] },
      },
      orderBy: { lft: 'asc' },
    });

    // 2. Get period balances — note: P&L uses credit - debit (opposite of BS)
    const balances = await prisma.$queryRawUnsafe<Array<{
      account_id: string;
      debit: number;
      credit: number;
    }>>(`
      SELECT account_id, SUM(debit) as debit, SUM(credit) as credit
      FROM gl_entries
      WHERE posting_date >= $1::timestamptz AND posting_date <= $2::timestamptz AND is_cancelled = false
      GROUP BY account_id
    `, fromDate, toDate);

    const balanceMap = new Map<string, number>();
    for (const r of balances) {
      // P&L balance = credit - debit (income is credit-positive)
      balanceMap.set(r.account_id, Number(r.credit) - Number(r.debit));
    }

    // 3. Build sections (matching Python logic)
    function buildSection(rootType: string): { accounts: PLAccount[]; total: number } {
      const sectionAccounts = accounts.filter((a) => a.root_type === rootType);
      const items: PLAccount[] = [];
      let total = 0;

      for (const a of sectionAccounts) {
        const bal = balanceMap.get(a.id) || 0;
        if (bal === 0 && !a.is_group) continue;
        if (!a.is_group) total += bal;
        items.push({
          id: a.id,
          name: a.name,
          account_number: a.account_number,
          is_group: a.is_group,
          balance: Math.round(bal * 100) / 100,
          level: 0,
        });
      }

      return { accounts: items, total: Math.round(total * 100) / 100 };
    }

    const income = buildSection('Income');
    const expenses = buildSection('Expense');
    const netProfit = Math.round((income.total - expenses.total) * 100) / 100;

    return {
      success: true,
      data: {
        from_date: fromDate,
        to_date: toDate,
        company,
        income,
        expenses,
        net_profit: netProfit,
        is_profit: netProfit >= 0,
      },
    };
  } catch (error: any) {
    console.error('[reports] getProfitAndLoss failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch profit and loss' };
  }
}
