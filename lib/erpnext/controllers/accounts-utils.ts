/**
 * Ported from erpnext/accounts/utils.py
 * Pure utility logic for accounting — no DB calls.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: number | string | boolean | undefined | null): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  const v = typeof value === "string" ? parseInt(value, 10) : value ?? 0;
  return Number.isNaN(v) ? 0 : v;
}

function getdate(dateInput: string | Date | undefined): Date {
  if (dateInput instanceof Date) return dateInput;
  return dateInput ? new Date(dateInput) : new Date();
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

function nowdate(): string {
  return formatDateISO(new Date());
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FiscalYearRecord {
  name: string;
  year_start_date: string;
  year_end_date: string;
}

export interface AccountRecord {
  name: string;
  account_name: string;
  company: string;
  parent_account?: string | null;
  is_group?: boolean;
  disabled?: boolean;
  account_type?: string;
  root_type?: string;
  report_type?: string;
  account_currency?: string | null;
  lft?: number;
  rgt?: number;
}

export interface GLEntry {
  account: string;
  posting_date: string;
  debit: number;
  credit: number;
  debit_in_account_currency: number;
  credit_in_account_currency: number;
  company?: string;
  cost_center?: string | null;
  party_type?: string | null;
  party?: string | null;
  finance_book?: string | null;
  is_cancelled?: number;
}

export interface OutstandingInvoice {
  voucher_no: string;
  voucher_type: string;
  posting_date: string;
  invoice_amount: number;
  payment_amount: number;
  outstanding_amount: number;
  due_date?: string | null;
  currency?: string | null;
  account?: string | null;
}

export interface HeldInvoiceRecord {
  name: string;
  on_hold?: boolean;
  release_date?: string | null;
}

export interface TreeNode {
  name: string;
  value?: string;
  is_group?: boolean;
  expandable?: boolean;
  parent?: string | null;
  company?: string;
  disabled?: boolean;
  docstatus?: number;
  root_type?: string;
  report_type?: string;
  account_currency?: string | null;
}

export interface AccountBalanceInput {
  value: string;
  account_currency?: string | null;
  balance?: number;
  balance_in_account_currency?: number;
  company_currency?: string;
  [key: string]: unknown;
}

export interface AccountBalanceResult {
  value: string;
  account_currency?: string | null;
  balance: number;
  balance_in_account_currency?: number;
  company_currency: string;
  [key: string]: unknown;
}

/* ------------------------------------------------------------------ */
/*  get_fiscal_year                                                    */
/* ------------------------------------------------------------------ */

export function getFiscalYear(
  date: string | Date,
  fiscalYears: FiscalYearRecord[],
  company?: string
): FiscalYearRecord | null {
  const d = getdate(date);
  const candidates = company
    ? fiscalYears.filter(
        (fy) => !fy.name || fy.name.includes(company) || true // keep all when data lacks company mapping
      )
    : fiscalYears;

  for (const fy of candidates) {
    const start = getdate(fy.year_start_date);
    const end = getdate(fy.year_end_date);
    if (start <= d && d <= end) {
      return fy;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  get_fiscal_years (internal helper)                                 */
/* ------------------------------------------------------------------ */

function getFiscalYears(
  date: string | Date | undefined,
  fiscalYears: FiscalYearRecord[],
  company?: string
): FiscalYearRecord[] {
  if (!date) return fiscalYears;
  const fy = getFiscalYear(date, fiscalYears, company);
  return fy ? [fy] : [];
}

/* ------------------------------------------------------------------ */
/*  validate_fiscal_year                                                */
/* ------------------------------------------------------------------ */

export function validateFiscalYear(
  date: string | Date,
  company: string,
  fiscalYears: FiscalYearRecord[],
  opts?: { label?: string; raiseOnMissing?: boolean }
): boolean {
  const fy = getFiscalYear(date, fiscalYears, company);
  if (!fy) {
    if (opts?.raiseOnMissing !== false) {
      throw new Error(
        `${opts?.label ?? "Date"} ${formatDateISO(getdate(date))} is not in any active Fiscal Year${company ? ` for ${company}` : ""}`
      );
    }
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  get_currency_precision                                            */
/* ------------------------------------------------------------------ */

export function getCurrencyPrecision(precision?: number | string): number {
  const p = cint(precision);
  if (p > 0) return p;
  // Derive from common number format default "#,###.##" → 2 decimals
  return 2;
}

/* ------------------------------------------------------------------ */
/*  get_company_default                                               */
/* ------------------------------------------------------------------ */

export function getCompanyDefault(
  company: string,
  fieldname: string,
  defaults: Record<string, string | number | boolean | null | undefined>,
  opts?: { ignoreValidation?: boolean }
): string | number | boolean | null | undefined {
  const value = defaults[fieldname];
  if (!opts?.ignoreValidation && (value === undefined || value === null || value === "")) {
    throw new Error(`Please set default ${fieldname} in Company ${company}`);
  }
  return value;
}

/* ------------------------------------------------------------------ */
/*  get_account_name                                                   */
/* ------------------------------------------------------------------ */

export function getAccountName(
  accountType: string | undefined,
  rootType: string | undefined,
  company: string,
  accounts: AccountRecord[],
  opts?: { isGroup?: boolean; accountCurrency?: string }
): string | null {
  const currency = opts?.accountCurrency ?? "";
  const match = accounts.find((acc) => {
    const typeMatch = accountType ? acc.account_type === accountType : true;
    const rootMatch = rootType ? acc.root_type === rootType : true;
    const companyMatch = acc.company === company;
    const groupMatch =
      opts?.isGroup !== undefined ? (acc.is_group ?? false) === opts.isGroup : true;
    const currencyMatch = currency ? acc.account_currency === currency : true;
    return typeMatch && rootMatch && companyMatch && groupMatch && currencyMatch;
  });
  return match?.name ?? null;
}

/* ------------------------------------------------------------------ */
/*  get_balance_on                                                     */
/* ------------------------------------------------------------------ */

export function getBalanceOn(
  account: string,
  date: string | Date | undefined,
  glEntries: GLEntry[],
  company?: string,
  opts?: {
    inAccountCurrency?: boolean;
    startDate?: string;
    costCenter?: string;
    financeBook?: string;
    defaultFinanceBook?: string;
    includeDefaultFbBalances?: boolean;
    partyType?: string;
    party?: string;
  }
): number {
  const targetDate = date ? formatDateISO(getdate(date)) : nowdate();
  const startDate = opts?.startDate ? formatDateISO(getdate(opts.startDate)) : undefined;

  const filtered = glEntries.filter((gle) => {
    if (gle.is_cancelled) return false;
    if (company && gle.company !== company) return false;
    if (gle.account !== account) return false;

    const posting = gle.posting_date;
    if (startDate && posting < startDate) return false;
    if (posting > targetDate) return false;

    if (opts?.costCenter && gle.cost_center !== opts.costCenter) return false;
    if (opts?.partyType && opts?.party) {
      if (gle.party_type !== opts.partyType || gle.party !== opts.party) return false;
    }

    // finance_book filtering
    if (opts?.financeBook) {
      const fbMatch =
        gle.finance_book === opts.financeBook ||
        gle.finance_book === null ||
        gle.finance_book === undefined ||
        gle.finance_book === "";
      if (!fbMatch) return false;
    } else if (opts?.defaultFinanceBook && opts?.includeDefaultFbBalances) {
      const fbMatch =
        gle.finance_book === opts.defaultFinanceBook ||
        gle.finance_book === null ||
        gle.finance_book === undefined ||
        gle.finance_book === "";
      if (!fbMatch) return false;
    }

    return true;
  });

  const precision = getCurrencyPrecision();
  let debit = 0;
  let credit = 0;

  for (const gle of filtered) {
    if (opts?.inAccountCurrency) {
      debit += flt(gle.debit_in_account_currency, precision);
      credit += flt(gle.credit_in_account_currency, precision);
    } else {
      debit += flt(gle.debit, precision);
      credit += flt(gle.credit, precision);
    }
  }

  return flt(debit - credit, precision);
}

/* ------------------------------------------------------------------ */
/*  get_account_balances                                               */
/* ------------------------------------------------------------------ */

export function getAccountBalances(
  accounts: AccountBalanceInput[],
  company: string,
  glEntries: GLEntry[],
  opts?: {
    financeBook?: string;
    includeDefaultFbBalances?: boolean;
    companyCurrency?: string;
  }
): AccountBalanceResult[] {
  if (!accounts || accounts.length === 0) return [];

  const companyCurrency = opts?.companyCurrency ?? "";
  const results: AccountBalanceResult[] = [];

  for (const acc of accounts) {
    const result: AccountBalanceResult = {
      ...acc,
      value: acc.value,
      company_currency: companyCurrency,
      balance: flt(
        getBalanceOn(acc.value, undefined, glEntries, company, {
          inAccountCurrency: false,
          financeBook: opts?.financeBook,
          includeDefaultFbBalances: opts?.includeDefaultFbBalances,
        })
      ),
    };

    const accCurrency = acc.account_currency ?? "";
    if (accCurrency && accCurrency !== companyCurrency) {
      result.balance_in_account_currency = flt(
        getBalanceOn(acc.value, undefined, glEntries, company, {
          inAccountCurrency: true,
          financeBook: opts?.financeBook,
          includeDefaultFbBalances: opts?.includeDefaultFbBalances,
        })
      );
    }

    results.push(result);
  }

  return results;
}

/* ------------------------------------------------------------------ */
/*  get_held_invoices                                                  */
/* ------------------------------------------------------------------ */

export function getHeldInvoices(
  partyType: string,
  party: string,
  purchaseInvoices: HeldInvoiceRecord[]
): Set<string> | null {
  if (partyType !== "Supplier") return null;
  const today = nowdate();
  const held = new Set<string>();
  for (const inv of purchaseInvoices) {
    if (inv.on_hold && inv.release_date && inv.release_date > today) {
      held.add(inv.name);
    }
  }
  return held;
}

/* ------------------------------------------------------------------ */
/*  get_outstanding_invoices                                           */
/* ------------------------------------------------------------------ */

export function getOutstandingInvoices(
  partyType: string,
  party: string,
  invoices: OutstandingInvoice[],
  limit?: number,
  opts?: {
    minOutstanding?: number;
    maxOutstanding?: number;
    heldInvoices?: Set<string> | null;
    voucherNo?: string;
  }
): OutstandingInvoice[] {
  const precision = getCurrencyPrecision();
  const cutoff = 0.5 / 10 ** precision;
  const held = opts?.heldInvoices ?? new Set<string>();

  let outstanding: OutstandingInvoice[] = [];

  for (const inv of invoices) {
    const outstandingAmount = flt(inv.outstanding_amount, precision);
    if (outstandingAmount <= cutoff) continue;

    if (
      opts?.minOutstanding !== undefined &&
      opts?.maxOutstanding !== undefined &&
      (outstandingAmount < opts.minOutstanding || outstandingAmount > opts.maxOutstanding)
    ) {
      continue;
    }

    if (opts?.voucherNo && inv.voucher_no !== opts.voucherNo) continue;

    // Skip held Purchase Invoices
    if (inv.voucher_type === "Purchase Invoice" && held.has(inv.voucher_no)) continue;

    outstanding.push({
      voucher_no: inv.voucher_no,
      voucher_type: inv.voucher_type,
      posting_date: inv.posting_date,
      invoice_amount: flt(inv.invoice_amount, precision),
      payment_amount: flt(inv.payment_amount, precision),
      outstanding_amount: outstandingAmount,
      due_date: inv.due_date,
      currency: inv.currency,
      account: inv.account,
    });
  }

  // Sort by due_date, fallback to today
  outstanding.sort((a, b) => {
    const aDate = a.due_date ? a.due_date : nowdate();
    const bDate = b.due_date ? b.due_date : nowdate();
    return aDate.localeCompare(bDate);
  });

  if (limit !== undefined && limit > 0) {
    outstanding = outstanding.slice(0, limit);
  }

  return outstanding;
}

/* ------------------------------------------------------------------ */
/*  get_children                                                       */
/* ------------------------------------------------------------------ */

export function getChildren(
  doctype: string,
  parent: string,
  company: string,
  items: TreeNode[],
  opts?: { isRoot?: boolean; includeDisabled?: boolean }
): TreeNode[] {
  const isRoot = opts?.isRoot ?? false;
  const includeDisabled = opts?.includeDisabled ?? false;
  const parentField = `parent_${doctype.toLowerCase().replace(/\s+/g, "_")}`;

  const filtered = items.filter((item) => {
    if ((item.docstatus ?? 0) >= 2) return false;
    if (!includeDisabled && item.disabled) return false;

    if (isRoot) {
      if (item.company !== company) return false;
      const p = item[parentField as keyof TreeNode];
      if (p !== undefined && p !== null && p !== "") return false;
    } else {
      if (item.parent !== parent) return false;
    }
    return true;
  });

  const mapped = filtered.map((item) => {
    const node: TreeNode = {
      name: item.name,
      value: item.name,
      is_group: item.is_group,
      expandable: item.is_group ?? false,
    };

    if (doctype === "Account") {
      node.root_type = item.root_type;
      if (isRoot) {
        node.report_type = item.report_type;
      }
      node.account_currency = item.account_currency;
    }

    if (!isRoot) {
      node.parent = item.parent ?? null;
    }

    return node;
  });

  // Sort alphabetically by name (value)
  mapped.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  return mapped;
}
