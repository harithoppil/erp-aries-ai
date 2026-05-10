import { errorMessage } from '@/lib/utils';
/**
 * Ported from erpnext/accounts/doctype/journal_entry/journal_entry.py
 * Pure validation logic for Journal Entry DocType.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface JournalEntryAccount {
  idx: number;
  account: string;
  account_type?: string;
  account_currency?: string;
  party_type?: string;
  party?: string;
  cost_center?: string;
  project?: string;
  debit_in_account_currency?: number;
  credit_in_account_currency?: number;
  debit?: number;
  credit?: number;
  exchange_rate?: number;
  reference_type?: string;
  reference_name?: string;
  reference_detail_no?: string;
  reference_due_date?: string;
  user_remark?: string;
  against_account?: string;
  is_advance?: string;
  bank_account?: string;
  advance_voucher_type?: string;
  advance_voucher_no?: string;
}

export interface JournalEntryDoc {
  name?: string;
  voucher_type: string;
  company: string;
  posting_date: string;
  company_currency?: string;
  multi_currency: boolean;
  is_opening?: string;
  is_system_generated?: boolean;
  docstatus: number;
  party_not_required?: boolean;
  difference?: number;
  total_debit?: number;
  total_credit?: number;
  total_amount?: number;
  total_amount_currency?: string;
  total_amount_in_words?: string;
  pay_to_recd_from?: string;
  title?: string;
  remark?: string;
  custom_remark?: boolean;
  cheque_no?: string;
  cheque_date?: string;
  clearance_date?: string | null;
  due_date?: string;
  finance_book?: string;
  stock_entry?: string;
  inter_company_journal_entry_reference?: string;
  reversal_of?: string;
  write_off_based_on?: string;
  write_off_amount?: number;
  periodic_entry_difference_account?: string;
  for_all_stock_asset_accounts?: boolean;
  stock_asset_account?: string;
  mode_of_payment?: string;
  accounts: JournalEntryAccount[];
}

export interface AccountDetails {
  account_currency?: string;
  account_type?: string;
  root_type?: string;
  company?: string;
}

export interface ReferenceDocInfo {
  docstatus: number;
  per_billed?: number;
  status?: string;
  grand_total?: number;
  base_grand_total?: number;
  outstanding_amount?: number;
  party?: string;
  party_account?: string;
  conversion_rate?: number;
  bill_no?: string;
  bill_date?: string;
  account_currency?: string;
  advance_paid?: number;
}

export interface PartyTypeAccountType {
  party_type: string;
  account_type: string;
}

export interface JournalValidationContext {
  /** Account details map: account_name → AccountDetails */
  accountDetailsMap?: Record<string, AccountDetails>;
  /** Reference doc info map: "Doctype|Name" → ReferenceDocInfo */
  referenceDocMap?: Record<string, ReferenceDocInfo>;
  /** Party type → account_type mapping */
  partyTypeAccountTypeMap?: Record<string, string>;
  /** Whether stock entry is submitted */
  stockEntryDocstatus?: number;
  /** Whether another JE exists for this stock entry */
  existingStockEntryJE?: boolean;
  /** Exchange rate function / lookup: (fromCurrency, toCurrency, date) => rate */
  exchangeRateLookup?: (fromCurrency: string, toCurrency: string, date: string) => number | undefined;
  /** Company default currency */
  companyCurrency?: string;
  /** Ignore exchange rate flag */
  ignoreExchangeRate?: boolean;
  /** Advance payment doctypes list */
  advanceDoctypes?: string[];
  /** For validate_against_jv: matched JE account rows */
  againstJVEntries?: Array<{
    debit: number;
    credit: number;
    reference_type?: string;
  }>;
  /** Linked JE details for inter-company validation */
  linkedJE?: {
    total_debit: number;
    total_credit: number;
    company: string;
  };
  /** Linked company currencies for inter-company */
  linkedCompanyCurrency?: string;
}

export interface JournalValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  /** Updated fields that should be applied to the doc */
  updates?: Partial<JournalEntryDoc>;
  /** Updated account rows */
  accountUpdates?: Array<Partial<JournalEntryAccount> & { idx: number }>;
}

export interface GLEntryRow {
  account: string;
  party_type?: string;
  party?: string;
  due_date?: string;
  against?: string;
  debit: number;
  credit: number;
  account_currency?: string;
  debit_in_account_currency?: number;
  credit_in_account_currency?: number;
  transaction_currency?: string;
  transaction_exchange_rate?: number;
  debit_in_transaction_currency?: number;
  credit_in_transaction_currency?: number;
  against_voucher_type?: string;
  against_voucher?: string;
  remarks?: string;
  voucher_detail_no?: string;
  cost_center?: string;
  project?: string;
  finance_book?: string;
  advance_voucher_type?: string;
  advance_voucher_no?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: unknown): number {
  return Number(value) || 0;
}

function cstr(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

/* ------------------------------------------------------------------ */
/*  Main validate orchestrator                                         */
/* ------------------------------------------------------------------ */

export function validateJournalEntry(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): JournalValidationResult {
  const updates: Partial<JournalEntryDoc> = {};
  const accountUpdates: Array<Partial<JournalEntryAccount> & { idx: number }> = [];
  const warnings: string[] = [];

  try {
    // 1. Opening entry defaults
    if (doc.voucher_type === "Opening Entry") {
      updates.is_opening = "Yes";
    }
    if (!updates.is_opening && !doc.is_opening) {
      updates.is_opening = "No";
    }
    updates.clearance_date = null;

    // 2. Validate party
    const partyErr = validateParty(doc.accounts, ctx.accountDetailsMap, doc.party_not_required, ctx.partyTypeAccountTypeMap);
    if (partyErr) return { success: false, error: partyErr };

    // 3. Validate entries for advance
    const advanceErr = validateEntriesForAdvance(doc.accounts);
    if (advanceErr) return { success: false, error: advanceErr };

    // 4. Validate multi-currency and set exchange rates
    const multiCurrencyErr = validateMultiCurrency(doc, ctx);
    if (multiCurrencyErr.error) return { success: false, error: multiCurrencyErr.error };
    if (multiCurrencyErr.accountUpdates) {
      accountUpdates.push(...multiCurrencyErr.accountUpdates);
    }

    // 5. Set amounts in company currency
    const amountsResult = setAmountsInCompanyCurrency(doc.accounts, doc.voucher_type, doc.multi_currency);
    if (amountsResult.accountUpdates) {
      accountUpdates.push(...amountsResult.accountUpdates);
    }

    // 6. Validate debit/credit amount
    const debitCreditErr = validateDebitCreditAmount(doc.accounts, doc.voucher_type, doc.multi_currency);
    if (debitCreditErr) return { success: false, error: debitCreditErr };

    // 7. Set total debit / credit
    const totalsResult = setTotalDebitCredit(doc.accounts);
    updates.total_debit = totalsResult.totalDebit;
    updates.total_credit = totalsResult.totalCredit;
    updates.difference = totalsResult.difference;

    // 8. Validate against JV (skip if reverse depr entry)
    const againstJVErr = validateAgainstJV(doc, ctx);
    if (againstJVErr) return { success: false, error: againstJVErr };

    // 9. Validate stock accounts
    const stockErr = validateStockAccounts(doc, ctx);
    if (stockErr) return { success: false, error: stockErr };

    // 10. Validate reference doc
    const refErr = validateReferenceDoc(doc, ctx);
    if (refErr) return { success: false, error: refErr };

    // 11. Set against account (only if docstatus == 0)
    if (doc.docstatus === 0) {
      const againstResult = setAgainstAccount(doc.accounts, doc.voucher_type, ctx.referenceDocMap);
      for (const au of againstResult) {
        accountUpdates.push(au);
      }
    }

    // 12. Create remarks
    const remarksResult = createRemarks(doc, ctx);
    if (remarksResult) {
      updates.remark = remarksResult;
    }

    // 13. Set print format fields
    const printResult = setPrintFormatFields(doc.accounts, ctx.accountDetailsMap);
    if (printResult.pay_to_recd_from !== undefined) {
      updates.pay_to_recd_from = printResult.pay_to_recd_from;
    }
    if (printResult.total_amount !== undefined) {
      updates.total_amount = printResult.total_amount;
      updates.total_amount_currency = printResult.total_amount_currency;
    }

    // 14. Validate credit/debit note
    const noteErr = validateCreditDebitNote(doc.stock_entry, ctx.stockEntryDocstatus, ctx.existingStockEntryJE, doc.voucher_type, doc.name);
    if (noteErr) warnings.push(noteErr);

    // 15. Validate empty accounts table
    const emptyErr = validateEmptyAccountsTable(doc.accounts);
    if (emptyErr) return { success: false, error: emptyErr };

    // 16. Validate inter-company accounts
    const interCompanyErr = validateInterCompanyAccounts(doc, ctx);
    if (interCompanyErr) return { success: false, error: interCompanyErr };

    // 17. Validate depreciation account
    const deprErr = validateDeprAccountAndDeprEntryVoucherType(doc.accounts, ctx.accountDetailsMap, doc.voucher_type);
    if (deprErr) return { success: false, error: deprErr };

    // 18. Set title
    if (!doc.title) {
      updates.title = doc.pay_to_recd_from ?? doc.accounts[0]?.account ?? "";
    }

    return { success: true, warnings, updates, accountUpdates };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Validate Party                                                     */
/* ------------------------------------------------------------------ */

export function validateParty(
  accounts: JournalEntryAccount[],
  accountDetailsMap?: Record<string, AccountDetails>,
  partyNotRequired?: boolean,
  partyTypeAccountTypeMap?: Record<string, string>
): string | null {
  for (const d of accounts) {
    const accountType = accountDetailsMap?.[d.account]?.account_type;
    if (!accountType || !["Receivable", "Payable"].includes(accountType)) continue;

    if (!d.party_type && !d.party && !partyNotRequired) {
      return `Row ${d.idx}: Party Type and Party is required for Receivable / Payable account ${d.account}`;
    }

    if (d.party_type) {
      const expectedType = partyTypeAccountTypeMap?.[d.party_type];
      if (expectedType && expectedType !== accountType && d.party_type !== "Employee") {
        return `Row ${d.idx}: Account ${d.account} and Party Type ${d.party_type} have different account types`;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Entries for Advance                                       */
/* ------------------------------------------------------------------ */

export function validateEntriesForAdvance(accounts: JournalEntryAccount[]): string | null {
  for (const d of accounts) {
    const refType = d.reference_type;
    if (refType && !["Sales Invoice", "Purchase Invoice", "Journal Entry"].includes(refType)) {
      const isCustomerCredit = d.party_type === "Customer" && flt(d.credit_in_account_currency) > 0;
      const isSupplierDebit = d.party_type === "Supplier" && flt(d.debit_in_account_currency) > 0;

      if (isCustomerCredit || isSupplierDebit) {
        if (d.is_advance === "No") {
          // warning only
          continue;
        }
        if (["Sales Order", "Purchase Order"].includes(refType ?? "") && d.is_advance !== "Yes") {
          return `Row ${d.idx}: Payment against Sales/Purchase Order should always be marked as advance`;
        }
      }

      if (d.is_advance === "Yes") {
        if (d.party_type === "Customer" && flt(d.debit_in_account_currency) > 0) {
          return `Row ${d.idx}: Advance against Customer must be credit`;
        }
        if (d.party_type === "Supplier" && flt(d.credit_in_account_currency) > 0) {
          return `Row ${d.idx}: Advance against Supplier must be debit`;
        }
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Multi Currency                                            */
/* ------------------------------------------------------------------ */

export function validateMultiCurrency(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): { error?: string; accountUpdates?: Array<Partial<JournalEntryAccount> & { idx: number }> } {
  const accountUpdates: Array<Partial<JournalEntryAccount> & { idx: number }> = [];
  const alternateCurrencies: string[] = [];

  for (const d of doc.accounts) {
    const account = ctx.accountDetailsMap?.[d.account];
    let accountCurrency = account?.account_currency;
    const accountType = account?.account_type;

    if (!accountCurrency) {
      accountCurrency = ctx.companyCurrency ?? "";
    }

    accountUpdates.push({
      idx: d.idx,
      account_currency: accountCurrency,
      account_type: accountType,
    });

    if (accountCurrency !== ctx.companyCurrency && !alternateCurrencies.includes(accountCurrency)) {
      alternateCurrencies.push(accountCurrency);
    }
  }

  if (alternateCurrencies.length > 0 && !doc.multi_currency) {
    return { error: "Please check Multi Currency option to allow accounts with other currency" };
  }

  // Set exchange rates
  const exchangeResult = setExchangeRate(doc, ctx);
  if (exchangeResult.error) {
    return { error: exchangeResult.error };
  }
  if (exchangeResult.accountUpdates) {
    accountUpdates.push(...exchangeResult.accountUpdates);
  }

  return { accountUpdates };
}

/* ------------------------------------------------------------------ */
/*  Set Exchange Rate                                                  */
/* ------------------------------------------------------------------ */

export function setExchangeRate(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): { error?: string; accountUpdates?: Array<Partial<JournalEntryAccount> & { idx: number }> } {
  const accountUpdates: Array<Partial<JournalEntryAccount> & { idx: number }> = [];

  for (const d of doc.accounts) {
    const accountCurrency = d.account_currency ?? ctx.companyCurrency ?? "";

    if (accountCurrency === ctx.companyCurrency) {
      accountUpdates.push({ idx: d.idx, exchange_rate: 1 });
      continue;
    }

    let rate = d.exchange_rate;

    // If linked to Sales/Purchase Invoice, use conversion_rate from invoice
    if (
      d.reference_type &&
      ["Sales Invoice", "Purchase Invoice"].includes(d.reference_type) &&
      d.reference_name &&
      doc.posting_date
    ) {
      const refKey = `${d.reference_type}|${d.reference_name}`;
      const refDoc = ctx.referenceDocMap?.[refKey];
      if (refDoc?.conversion_rate) {
        rate = refDoc.conversion_rate;
      }
    }

    // If no rate or rate == 1, fetch from exchange rate lookup
    if ((!rate || rate === 1) && accountCurrency && doc.posting_date && ctx.exchangeRateLookup) {
      const lookedUp = ctx.exchangeRateLookup(
        accountCurrency,
        ctx.companyCurrency ?? "",
        doc.posting_date
      );
      if (lookedUp) {
        rate = lookedUp;
      }
    }

    if (!rate) {
      return { error: `Row ${d.idx}: Exchange Rate is mandatory` };
    }

    accountUpdates.push({ idx: d.idx, exchange_rate: rate });
  }

  return { accountUpdates };
}

/* ------------------------------------------------------------------ */
/*  Set Amounts in Company Currency                                    */
/* ------------------------------------------------------------------ */

export function setAmountsInCompanyCurrency(
  accounts: JournalEntryAccount[],
  voucherType: string,
  multiCurrency: boolean
): { accountUpdates?: Array<Partial<JournalEntryAccount> & { idx: number }> } {
  const accountUpdates: Array<Partial<JournalEntryAccount> & { idx: number }> = [];

  if (voucherType === "Exchange Gain Or Loss" && multiCurrency) {
    return {};
  }

  for (const d of accounts) {
    const debitInAcc = flt(d.debit_in_account_currency, 2);
    const creditInAcc = flt(d.credit_in_account_currency, 2);
    const exchangeRate = flt(d.exchange_rate, 9) || 1;

    accountUpdates.push({
      idx: d.idx,
      debit_in_account_currency: debitInAcc,
      credit_in_account_currency: creditInAcc,
      debit: flt(debitInAcc * exchangeRate, 2),
      credit: flt(creditInAcc * exchangeRate, 2),
    });
  }

  return { accountUpdates };
}

/* ------------------------------------------------------------------ */
/*  Validate Debit / Credit Amount                                     */
/* ------------------------------------------------------------------ */

export function validateDebitCreditAmount(
  accounts: JournalEntryAccount[],
  voucherType: string,
  multiCurrency: boolean
): string | null {
  if (voucherType === "Exchange Gain Or Loss" && multiCurrency) {
    return null;
  }

  for (const d of accounts) {
    if (!flt(d.debit) && !flt(d.credit)) {
      return `Row ${d.idx}: Both Debit and Credit values cannot be zero`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Set Total Debit / Credit                                           */
/* ------------------------------------------------------------------ */

export function setTotalDebitCredit(accounts: JournalEntryAccount[]): {
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const d of accounts) {
    if (flt(d.debit) && flt(d.credit)) {
      throw new Error("You cannot credit and debit same account at the same time");
    }
    totalDebit += flt(d.debit, 2);
    totalCredit += flt(d.credit, 2);
  }

  const difference = flt(totalDebit, 2) - flt(totalCredit, 2);
  return { totalDebit: flt(totalDebit, 2), totalCredit: flt(totalCredit, 2), difference };
}

/* ------------------------------------------------------------------ */
/*  Validate Total Debit and Credit (for submit)                       */
/* ------------------------------------------------------------------ */

export function validateTotalDebitAndCredit(
  difference: number,
  voucherType: string,
  multiCurrency: boolean
): string | null {
  if (voucherType === "Exchange Gain Or Loss" && multiCurrency) {
    return null;
  }
  if (difference) {
    return `Total Debit must be equal to Total Credit. The difference is ${difference}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Against JV                                                */
/* ------------------------------------------------------------------ */

export function validateAgainstJV(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): string | null {
  const isSystemGeneratedGainLoss =
    doc.voucher_type === "Exchange Gain Or Loss" && doc.multi_currency && doc.is_system_generated;

  for (const d of accountsWithRefType(doc.accounts, "Journal Entry")) {
    const rootType = ctx.accountDetailsMap?.[d.account]?.root_type;

    if (rootType === "Asset" && flt(d.debit) > 0 && !isSystemGeneratedGainLoss) {
      return `Row #${d.idx}: For ${d.account}, you can select reference document only if account gets credited`;
    }
    if (rootType === "Liability" && flt(d.credit) > 0 && !isSystemGeneratedGainLoss) {
      return `Row #${d.idx}: For ${d.account}, you can select reference document only if account gets debited`;
    }

    if (d.reference_name === doc.name) {
      return "You can not enter current voucher in 'Against Journal Entry' column";
    }

    // Check against entries from context
    const againstEntries = ctx.againstJVEntries ?? [];
    if (againstEntries.length === 0) {
      if (doc.voucher_type !== "Exchange Gain Or Loss") {
        return `Journal Entry ${d.reference_name} does not have account ${d.account} or already matched against other voucher`;
      }
    } else {
      const drOrCr = flt(d.credit) > 0 ? "debit" : "credit";
      const valid = againstEntries.some((jvd) => flt(jvd[drOrCr as "debit" | "credit"]) > 0);
      if (!valid && !isSystemGeneratedGainLoss) {
        return `Against Journal Entry ${d.reference_name} does not have any unmatched ${drOrCr} entry`;
      }
    }
  }

  return null;
}

function accountsWithRefType(
  accounts: JournalEntryAccount[],
  refType: string
): JournalEntryAccount[] {
  return accounts.filter((a) => a.reference_type === refType);
}

/* ------------------------------------------------------------------ */
/*  Validate Stock Accounts                                            */
/* ------------------------------------------------------------------ */

export function validateStockAccounts(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): string | null {
  // Skip if perpetual inventory disabled or periodic accounting entry
  // (Caller must decide perpetual inventory status)
  if (doc.voucher_type === "Periodic Accounting Entry") {
    return null;
  }

  // Pure function: caller passes stock account list and balances
  // This is a placeholder for the actual stock account validation
  // which requires stock_ledger + account balance comparison.
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Reference Doc                                             */
/* ------------------------------------------------------------------ */

export function validateReferenceDoc(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): string | null {
  const fieldDict: Record<string, string[]> = {
    "Sales Invoice": ["Customer", "Debit To"],
    "Purchase Invoice": ["Supplier", "Credit To"],
    "Sales Order": ["Customer"],
    "Purchase Order": ["Supplier"],
  };

  const referenceTotals: Record<string, number> = {};
  const referenceTypes: Record<string, string> = {};
  const referenceAccounts: Record<string, string> = {};

  for (const d of doc.accounts) {
    if (!d.reference_type) {
      // eslint-disable-next-line no-param-reassign
      d.reference_name = undefined;
    }
    if (!d.reference_name) {
      // eslint-disable-next-line no-param-reassign
      d.reference_type = undefined;
    }

    if (!d.reference_type || !d.reference_name || !fieldDict[d.reference_type]) continue;

    const drOrCr =
      d.reference_type === "Sales Order" || d.reference_type === "Sales Invoice"
        ? "credit_in_account_currency"
        : "debit_in_account_currency";

    // Check debit/credit type for Sales/Purchase Order
    if (d.reference_type === "Sales Order" && flt(d.debit) > 0) {
      return `Row ${d.idx}: Debit entry can not be linked with a Sales Order`;
    }
    if (d.reference_type === "Purchase Order" && flt(d.credit) > 0) {
      return `Row ${d.idx}: Credit entry can not be linked with a Purchase Order`;
    }

    // Set totals
    const refKey = `${d.reference_type}|${d.reference_name}`;
    if (referenceTotals[d.reference_name] === undefined) {
      referenceTotals[d.reference_name] = 0;
    }

    if (doc.voucher_type !== "Deferred Revenue" && doc.voucher_type !== "Deferred Expense") {
      const amount = drOrCr === "credit_in_account_currency" ? d.credit_in_account_currency : d.debit_in_account_currency;
      referenceTotals[d.reference_name] += flt(amount);
    }

    referenceTypes[d.reference_name] = d.reference_type;
    referenceAccounts[d.reference_name] = d.account;

    // Validate reference doc exists
    const refDoc = ctx.referenceDocMap?.[refKey];
    if (!refDoc) {
      return `Row ${d.idx}: Invalid reference ${d.reference_name}`;
    }

    // Check party and account match for invoices
    if (d.reference_type === "Sales Invoice" || d.reference_type === "Purchase Invoice") {
      const partyField = fieldDict[d.reference_type][0];
      const expectedParty = refDoc.party;
      const expectedAccount = refDoc.party_account;

      if (expectedParty !== d.party && doc.voucher_type !== "Exchange Gain Or Loss") {
        return `Row ${d.idx}: Party / Account does not match with ${partyField} / ${fieldDict[d.reference_type][1]} in ${d.reference_type} ${d.reference_name}`;
      }
      if (expectedAccount !== d.account && doc.voucher_type !== "Exchange Gain Or Loss") {
        return `Row ${d.idx}: Party / Account does not match with ${partyField} / ${fieldDict[d.reference_type][1]} in ${d.reference_type} ${d.reference_name}`;
      }
    }

    // Check party matches for orders
    if (d.reference_type === "Sales Order" || d.reference_type === "Purchase Order") {
      if (refDoc.party !== d.party) {
        return `Row ${d.idx}: ${d.party_type} ${d.party} does not match with ${d.reference_type}`;
      }
    }
  }

  // Validate orders
  const orderErr = validateOrders(referenceTotals, referenceTypes, ctx);
  if (orderErr) return orderErr;

  // Validate invoices
  const invoiceErr = validateInvoices(referenceTotals, referenceTypes, ctx, doc.voucher_type);
  if (invoiceErr) return invoiceErr;

  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Orders                                                    */
/* ------------------------------------------------------------------ */

export function validateOrders(
  referenceTotals: Record<string, number>,
  referenceTypes: Record<string, string>,
  ctx: JournalValidationContext
): string | null {
  for (const [referenceName, total] of Object.entries(referenceTotals)) {
    const refType = referenceTypes[referenceName];
    if (refType !== "Sales Order" && refType !== "Purchase Order") continue;

    const refKey = `${refType}|${referenceName}`;
    const order = ctx.referenceDocMap?.[refKey];
    if (!order) continue;

    if (order.docstatus !== 1) {
      return `${refType} ${referenceName} is not submitted`;
    }
    if (flt(order.per_billed) >= 100) {
      return `${refType} ${referenceName} is fully billed`;
    }
    if (order.status === "Closed") {
      return `${refType} ${referenceName} is closed`;
    }

    const voucherTotal =
      order.account_currency === ctx.companyCurrency ? order.base_grand_total : order.grand_total;

    if (flt(voucherTotal) < flt(order.advance_paid ?? 0) + total) {
      return `Advance paid against ${refType} ${referenceName} cannot be greater than Grand Total ${voucherTotal}`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Invoices                                                  */
/* ------------------------------------------------------------------ */

export function validateInvoices(
  referenceTotals: Record<string, number>,
  referenceTypes: Record<string, string>,
  ctx: JournalValidationContext,
  voucherType: string
): string | null {
  if (voucherType === "Debit Note" || voucherType === "Credit Note") {
    return null;
  }

  for (const [referenceName, total] of Object.entries(referenceTotals)) {
    const refType = referenceTypes[referenceName];
    if (refType !== "Sales Invoice" && refType !== "Purchase Invoice") continue;

    const refKey = `${refType}|${referenceName}`;
    const invoice = ctx.referenceDocMap?.[refKey];
    if (!invoice) continue;

    if (invoice.docstatus !== 1) {
      return `${refType} ${referenceName} is not submitted`;
    }

    const outstanding = flt(invoice.outstanding_amount, 2);
    if (total && outstanding < flt(total, 2)) {
      return `Payment against ${refType} ${referenceName} cannot be greater than Outstanding Amount ${outstanding}`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Set Against Account                                                */
/* ------------------------------------------------------------------ */

export function setAgainstAccount(
  accounts: JournalEntryAccount[],
  voucherType: string,
  referenceDocMap?: Record<string, ReferenceDocInfo>
): Array<Partial<JournalEntryAccount> & { idx: number }> {
  const accountUpdates: Array<Partial<JournalEntryAccount> & { idx: number }> = [];

  if (voucherType === "Deferred Revenue" || voucherType === "Deferred Expense") {
    for (const d of accounts) {
      if (!d.reference_type || !d.reference_name) continue;
      const field = d.reference_type === "Sales Invoice" ? "customer" : "supplier";
      const refKey = `${d.reference_type}|${d.reference_name}`;
      const refDoc = referenceDocMap?.[refKey];
      accountUpdates.push({
        idx: d.idx,
        against_account: refDoc?.[field as keyof ReferenceDocInfo] as string | undefined,
      });
    }
    return accountUpdates;
  }

  const accountsDebited: string[] = [];
  const accountsCredited: string[] = [];

  for (const d of accounts) {
    if (flt(d.debit) > 0) {
      accountsDebited.push(d.party || d.account);
    }
    if (flt(d.credit) > 0) {
      accountsCredited.push(d.party || d.account);
    }
  }

  const uniqueCredited = Array.from(new Set(accountsCredited));
  const uniqueDebited = Array.from(new Set(accountsDebited));

  for (const d of accounts) {
    if (flt(d.debit) > 0) {
      accountUpdates.push({ idx: d.idx, against_account: uniqueCredited.join(", ") });
    }
    if (flt(d.credit) > 0) {
      accountUpdates.push({ idx: d.idx, against_account: uniqueDebited.join(", ") });
    }
  }

  return accountUpdates;
}

/* ------------------------------------------------------------------ */
/*  Create Remarks                                                     */
/* ------------------------------------------------------------------ */

export function createRemarks(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): string | undefined {
  if (doc.custom_remark) return undefined;

  const r: string[] = [];

  if (doc.cheque_no) {
    if (doc.cheque_date) {
      r.push(`Reference #${doc.cheque_no} dated ${doc.cheque_date}`);
    } else {
      // Original throws - here we return undefined or caller handles
      return undefined;
    }
  }

  for (const d of doc.accounts) {
    if (d.reference_type === "Sales Invoice" && d.credit) {
      r.push(`${fmtMoney(flt(d.credit), ctx.companyCurrency)} against Sales Invoice ${d.reference_name}`);
    }
    if (d.reference_type === "Sales Order" && d.credit) {
      r.push(`${fmtMoney(flt(d.credit), ctx.companyCurrency)} against Sales Order ${d.reference_name}`);
    }
    if (d.reference_type === "Purchase Invoice" && d.debit) {
      const refKey = `Purchase Invoice|${d.reference_name}`;
      const refDoc = ctx.referenceDocMap?.[refKey];
      if (refDoc?.bill_no && !["na", "not applicable", "none"].includes(refDoc.bill_no.toLowerCase().trim())) {
        r.push(
          `${fmtMoney(flt(d.debit), ctx.companyCurrency)} against Bill ${refDoc.bill_no} dated ${refDoc.bill_date ?? ""}`
        );
      }
    }
    if (d.reference_type === "Purchase Order" && d.debit) {
      r.push(`${fmtMoney(flt(d.debit), ctx.companyCurrency)} against Purchase Order ${d.reference_name}`);
    }
  }

  return r.length > 0 ? r.join("\n") : undefined;
}

function fmtMoney(amount: number, currency?: string): string {
  return `${currency ?? ""} ${flt(amount, 2).toFixed(2)}`.trim();
}

/* ------------------------------------------------------------------ */
/*  Set Print Format Fields                                            */
/* ------------------------------------------------------------------ */

export function setPrintFormatFields(
  accounts: JournalEntryAccount[],
  accountDetailsMap?: Record<string, AccountDetails>
): {
  pay_to_recd_from?: string;
  total_amount?: number;
  total_amount_currency?: string;
} {
  let bankAmount = 0;
  let partyAmount = 0;
  let payToRecdFrom = "";
  let partyType = "";
  let partyAccountCurrency = "";
  let bankAccountCurrency = "";

  for (const d of accounts) {
    if (["Customer", "Supplier"].includes(d.party_type ?? "") && d.party) {
      partyType = d.party_type ?? "";
      if (!payToRecdFrom) {
        payToRecdFrom = d.party;
      }
      if (payToRecdFrom && payToRecdFrom === d.party) {
        partyAmount += flt(d.debit_in_account_currency) || flt(d.credit_in_account_currency);
        partyAccountCurrency = d.account_currency ?? "";
      }
    } else if (["Bank", "Cash"].includes(accountDetailsMap?.[d.account]?.account_type ?? "")) {
      bankAmount += flt(d.debit_in_account_currency) || flt(d.credit_in_account_currency);
      bankAccountCurrency = d.account_currency ?? "";
    }
  }

  if (partyType && payToRecdFrom) {
    if (bankAmount) {
      return {
        pay_to_recd_from: payToRecdFrom,
        total_amount: bankAmount,
        total_amount_currency: bankAccountCurrency,
      };
    }
    return {
      pay_to_recd_from: payToRecdFrom,
      total_amount: partyAmount,
      total_amount_currency: partyAccountCurrency,
    };
  }

  return {};
}

/* ------------------------------------------------------------------ */
/*  Validate Credit / Debit Note                                       */
/* ------------------------------------------------------------------ */

export function validateCreditDebitNote(
  stockEntry?: string,
  stockEntryDocstatus?: number,
  existingStockEntryJE?: boolean,
  voucherType?: string,
  name?: string
): string | null {
  if (!stockEntry) return null;

  if (stockEntryDocstatus !== 1) {
    return `Stock Entry ${stockEntry} is not submitted`;
  }

  if (existingStockEntryJE) {
    return `Warning: Another ${voucherType} # ${name} exists against stock entry ${stockEntry}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Empty Accounts Table                                      */
/* ------------------------------------------------------------------ */

export function validateEmptyAccountsTable(accounts: JournalEntryAccount[]): string | null {
  if (!accounts || accounts.length === 0) {
    return "Accounts table cannot be blank.";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Inter-Company Accounts                                    */
/* ------------------------------------------------------------------ */

export function validateInterCompanyAccounts(
  doc: JournalEntryDoc,
  ctx: JournalValidationContext
): string | null {
  if (
    doc.voucher_type !== "Inter Company Journal Entry" ||
    !doc.inter_company_journal_entry_reference ||
    !ctx.linkedJE
  ) {
    return null;
  }

  const linked = ctx.linkedJE;
  const accountCurrency = ctx.companyCurrency ?? "";
  const previousAccountCurrency = ctx.linkedCompanyCurrency ?? "";

  if (accountCurrency === previousAccountCurrency) {
    if (
      flt(doc.total_credit, 2) !== flt(linked.total_debit, 2) ||
      flt(doc.total_debit, 2) !== flt(linked.total_credit, 2)
    ) {
      return "Total Credit/ Debit Amount should be same as linked Journal Entry";
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Depreciation Account                                      */
/* ------------------------------------------------------------------ */

export function validateDeprAccountAndDeprEntryVoucherType(
  accounts: JournalEntryAccount[],
  accountDetailsMap?: Record<string, AccountDetails>,
  voucherType?: string
): string | null {
  for (const d of accounts) {
    const rootType = accountDetailsMap?.[d.account]?.root_type;
    if (d.account_type === "Depreciation") {
      if (voucherType !== "Depreciation Entry") {
        return "Journal Entry type should be set as Depreciation Entry for asset depreciation";
      }
      if (rootType !== "Expense") {
        return `Account ${d.account} should be of type Expense`;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Validate Cheque Info                                               */
/* ------------------------------------------------------------------ */

export function validateChequeInfo(
  voucherType: string,
  chequeNo?: string,
  chequeDate?: string
): string | null {
  if (voucherType === "Bank Entry") {
    if (!chequeNo || !chequeDate) {
      return `Reference No & Reference Date is required for ${voucherType}`;
    }
  }
  if (chequeDate && !chequeNo) {
    return "Reference No is mandatory if you entered Reference Date";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Get Balance (difference entry)                                     */
/* ------------------------------------------------------------------ */

export function getBalanceEntry(
  accounts: JournalEntryAccount[],
  difference: number,
  differenceAccount?: string,
  defaultCostCenter?: string
): {
  accounts: JournalEntryAccount[];
  error?: string;
} {
  if (!accounts || accounts.length === 0) {
    return { accounts, error: "'Entries' cannot be empty" };
  }

  const result = [...accounts];
  let diff = flt(difference, 2);

  if (diff) {
    let blankRow = result.find(
      (d) => !d.credit_in_account_currency && !d.debit_in_account_currency && diff !== 0
    );

    if (!blankRow && differenceAccount) {
      blankRow = {
        idx: result.length + 1,
        account: differenceAccount,
        cost_center: defaultCostCenter,
        exchange_rate: 1,
      };
      result.push(blankRow);
    }

    if (blankRow) {
      if (diff > 0) {
        blankRow.credit_in_account_currency = diff;
        blankRow.credit = diff;
      } else {
        blankRow.debit_in_account_currency = Math.abs(diff);
        blankRow.debit = Math.abs(diff);
      }
    }
  }

  return { accounts: result };
}

/* ------------------------------------------------------------------ */
/*  Build GL Map                                                       */
/* ------------------------------------------------------------------ */

export function buildGLMap(
  doc: JournalEntryDoc,
  advanceDoctypes: string[] = []
): GLEntryRow[] {
  const glMap: GLEntryRow[] = [];
  const companyCurrency = doc.company_currency ?? "";
  let transactionCurrency = companyCurrency;
  let transactionExchangeRate = 1;

  if (doc.multi_currency) {
    for (const row of doc.accounts) {
      if (row.account_currency && row.account_currency !== companyCurrency) {
        transactionCurrency = row.account_currency;
        transactionExchangeRate = row.exchange_rate ?? 1;
        break;
      }
    }
  }

  for (const d of doc.accounts) {
    if (!d.debit && !d.credit && doc.voucher_type !== "Exchange Gain Or Loss") continue;

    const remarks = [d.user_remark, doc.remark].filter(Boolean).join("\n");

    const isTransactionCurrency = transactionCurrency === d.account_currency;

    const row: GLEntryRow = {
      account: d.account,
      party_type: d.party_type,
      party: d.party,
      due_date: doc.due_date,
      against: d.against_account,
      debit: flt(d.debit ?? 0, 2),
      credit: flt(d.credit ?? 0, 2),
      account_currency: d.account_currency,
      debit_in_account_currency: flt(d.debit_in_account_currency ?? 0, 2),
      credit_in_account_currency: flt(d.credit_in_account_currency ?? 0, 2),
      transaction_currency: transactionCurrency,
      transaction_exchange_rate: transactionExchangeRate,
      debit_in_transaction_currency: isTransactionCurrency
        ? flt(d.debit_in_account_currency ?? 0, 2)
        : flt(d.debit ?? 0, 2) / transactionExchangeRate,
      credit_in_transaction_currency: isTransactionCurrency
        ? flt(d.credit_in_account_currency ?? 0, 2)
        : flt(d.credit ?? 0, 2) / transactionExchangeRate,
      against_voucher_type: d.reference_type,
      against_voucher: d.reference_name,
      remarks,
      voucher_detail_no: d.reference_detail_no,
      cost_center: d.cost_center,
      project: d.project,
      finance_book: doc.finance_book,
      advance_voucher_type: d.advance_voucher_type,
      advance_voucher_no: d.advance_voucher_no,
    };

    if (d.reference_type && advanceDoctypes.includes(d.reference_type)) {
      row.against_voucher_type = "Journal Entry";
      row.against_voucher = doc.name;
      row.advance_voucher_type = d.reference_type;
      row.advance_voucher_no = d.reference_name;
    }

    glMap.push(row);
  }

  return glMap;
}

/* ------------------------------------------------------------------ */
/*  Get Outstanding (for reference docs)                               */
/* ------------------------------------------------------------------ */

export function getOutstandingForInvoice(
  outstandingAmount: number,
  isSalesInvoice: boolean
): { amountField: string; amount: number } {
  if (isSalesInvoice) {
    const amountField = outstandingAmount > 0 ? "credit_in_account_currency" : "debit_in_account_currency";
    return { amountField, amount: Math.abs(outstandingAmount) };
  }
  const amountField = outstandingAmount > 0 ? "debit_in_account_currency" : "credit_in_account_currency";
  return { amountField, amount: Math.abs(outstandingAmount) };
}

/* ------------------------------------------------------------------ */
/*  Reverse Journal Entry                                              */
/* ------------------------------------------------------------------ */

export function makeReverseJournalEntry(accounts: JournalEntryAccount[]): JournalEntryAccount[] {
  return accounts.map((d) => ({
    ...d,
    debit_in_account_currency: d.credit_in_account_currency,
    debit: d.credit,
    credit_in_account_currency: d.debit_in_account_currency,
    credit: d.debit,
  }));
}

/* ------------------------------------------------------------------ */
/*  System Generated Gain/Loss Check                                   */
/* ------------------------------------------------------------------ */

export function isSystemGeneratedGainLoss(
  voucherType: string,
  multiCurrency: boolean,
  isSystemGenerated?: boolean
): boolean {
  return voucherType === "Exchange Gain Or Loss" && multiCurrency && !!isSystemGenerated;
}

/* ------------------------------------------------------------------ */
/*  Validate Advance Accounts                                          */
/* ------------------------------------------------------------------ */

export function validateAdvanceAccounts(
  accounts: JournalEntryAccount[],
  advanceAccounts: string[]
): string | null {
  const journalAccounts = accounts.map((x) => x.account);
  const advanceSet = new Set(advanceAccounts);
  const used = journalAccounts.filter((x) => advanceSet.has(x));
  if (used.length > 0) {
    return `Making Journal Entries against advance accounts: ${used.join(", ")} is not recommended. These Journals won't be available for Reconciliation.`;
  }
  return null;
}
