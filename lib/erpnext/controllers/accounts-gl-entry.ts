import { errorMessage } from '@/lib/utils';
/**
 * Ported from erpnext/accounts/doctype/gl_entry/gl_entry.py
 * Pure validation logic for GL Entry DocType.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface GLEntryDoc {
  name: string;
  account: string;
  account_currency?: string;
  against?: string;
  against_voucher?: string;
  against_voucher_type?: string;
  company: string;
  cost_center?: string;
  credit: number;
  credit_in_account_currency: number;
  credit_in_reporting_currency: number;
  credit_in_transaction_currency: number;
  debit: number;
  debit_in_account_currency: number;
  debit_in_reporting_currency: number;
  debit_in_transaction_currency: number;
  due_date?: string;
  finance_book?: string;
  fiscal_year?: string;
  is_advance: string;
  is_cancelled: boolean;
  is_opening: string;
  party?: string;
  party_type?: string;
  posting_date?: string;
  project?: string;
  remarks?: string;
  reporting_currency_exchange_rate: number;
  to_rename: boolean;
  transaction_currency?: string;
  transaction_date?: string;
  transaction_exchange_rate: number;
  voucher_detail_no?: string;
  voucher_no: string;
  voucher_subtype?: string;
  voucher_type: string;
}

export interface GLEntryValidationContext {
  /** Account details from cached lookup */
  accountDetails?: {
    is_group: boolean;
    docstatus: number;
    company: string;
    report_type?: string;
    account_type?: string;
    balance_must_be?: string;
    freeze_account?: string;
    account_currency?: string;
  };
  /** Cost Center details from cached lookup */
  costCenterDetails?: {
    is_group: boolean;
    company: string;
  };
  /** Company default currency */
  companyCurrency?: string;
  /** Company reporting currency */
  companyReportingCurrency?: string;
  /** Previous state of the document (for updates) */
  docBeforeSave?: GLEntryDoc;
  /** Whether this is an advance adjustment */
  advAdj?: boolean;
  /** Whether this is from repost */
  fromRepost?: boolean;
  /** Whether update outstanding is enabled */
  updateOutstanding?: string;
  /** Whether this is a reverse depreciation entry */
  isReverseDeprEntry?: boolean;
  /** Whether party is not required (bypass validation) */
  partyNotRequired?: boolean;
  /** Journal Entry voucher type (if voucher_type === "Journal Entry") */
  journalEntryVoucherType?: string;
  /** Fiscal year lookup result */
  fiscalYear?: string;
  /** Exchange rate from default currency to reporting currency */
  reportingExchangeRate?: number;
  /** Current user roles (for frozen account check) */
  userRoles?: string[];
  /** Role allowed for frozen entries */
  roleAllowedForFrozenEntries?: string;
  /** Accounting dimensions with mandatory checks */
  accountingDimensions?: AccountingDimensionCheck[];
  /** Party validation context */
  partyContext?: PartyValidationContext;
}

export interface AccountingDimensionCheck {
  fieldname: string;
  label: string;
  company: string;
  mandatory_for_pl: boolean;
  mandatory_for_bs: boolean;
}

export interface PartyValidationContext {
  partyFrozen?: boolean;
  partyDisabled?: boolean;
  validPartyAccountType?: boolean;
  partyGleCurrencyValid?: boolean;
}

export interface GLEntryValidationResult {
  success: boolean;
  error?: string;
  /** Updated fields that should be applied to the doc */
  updates?: Partial<GLEntryDoc>;
}

export interface OutstandingContext {
  /** Existing GL entries for the against voucher */
  existingGLEntries: {
    debit_in_account_currency: number;
    credit_in_account_currency: number;
    account: string;
    party_type?: string;
    party?: string;
  }[];
  /** For Sales Invoice: the debit_to account */
  salesInvoicePartyAccount?: string;
  /** For Journal Entry: the JE amount on the account */
  journalEntryAmount?: number;
  /** Whether this is on cancel */
  onCancel?: boolean;
}

export interface UpdateAgainstAccountEntry {
  name: string;
  party?: string;
  against?: string;
  debit: number;
  credit: number;
  account: string;
  company: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: unknown): number {
  return Number(value) || 0;
}

function generateHash(length = 10): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Auto-name                                                          */
/* ------------------------------------------------------------------ */

export function getGLEntryAutoname(useHash = true): { name: string; to_rename: boolean } {
  const name = generateHash(10);
  return {
    name,
    to_rename: useHash ? false : true,
  };
}

/* ------------------------------------------------------------------ */
/*  Mandatory checks                                                   */
/* ------------------------------------------------------------------ */

export function checkMandatory(
  doc: GLEntryDoc,
  accountType: string | undefined,
  partyNotRequired: boolean,
  journalEntryVoucherType: string | undefined
): string | null {
  const mandatory: (keyof GLEntryDoc)[] = ["account", "voucher_type", "voucher_no", "company"];
  for (const k of mandatory) {
    if (!doc[k]) {
      return `${doc.voucher_type} ${doc.voucher_no}: ${String(k)} is required`;
    }
  }

  if (!doc.is_cancelled && !(doc.party_type && doc.party)) {
    if (!partyNotRequired) {
      if (accountType === "Receivable") {
        return `${doc.voucher_type} ${doc.voucher_no}: Customer is required against Receivable account ${doc.account}`;
      }
      if (accountType === "Payable") {
        return `${doc.voucher_type} ${doc.voucher_no}: Supplier is required against Payable account ${doc.account}`;
      }
    }
  }

  const hasDebit = flt(doc.debit, 2) !== 0;
  const hasCredit = flt(doc.credit, 2) !== 0;
  const isExchangeGainLoss =
    doc.voucher_type === "Journal Entry" && journalEntryVoucherType === "Exchange Gain Or Loss";

  if (!hasDebit && !hasCredit && !isExchangeGainLoss) {
    return `${doc.voucher_type} ${doc.voucher_no}: Either debit or credit amount is required for ${doc.account}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Cost Center validation                                             */
/* ------------------------------------------------------------------ */

export function plMustHaveCostCenter(
  doc: GLEntryDoc,
  accountReportType: string | undefined
): string | null {
  if (doc.cost_center || doc.voucher_type === "Period Closing Voucher") {
    return null;
  }

  if (accountReportType === "Profit and Loss") {
    return (
      `${doc.voucher_type} ${doc.voucher_no}: Cost Center is required for 'Profit and Loss' account ${doc.account}. ` +
      `Please set the cost center field in ${doc.voucher_type} or setup a default Cost Center for the Company.`
    );
  }

  return null;
}

export function validateCostCenter(
  doc: GLEntryDoc,
  costCenterDetails?: { is_group: boolean; company: string }
): string | null {
  if (!doc.cost_center || doc.is_cancelled) {
    return null;
  }

  if (!costCenterDetails) {
    return null;
  }

  if (costCenterDetails.company !== doc.company) {
    return `${doc.voucher_type} ${doc.voucher_no}: Cost Center ${doc.cost_center} does not belong to Company ${doc.company}`;
  }

  if (doc.voucher_type !== "Period Closing Voucher" && costCenterDetails.is_group) {
    return `${doc.voucher_type} ${doc.voucher_no}: Cost Center ${doc.cost_center} is a group cost center and group cost centers cannot be used in transactions`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Account / PL validation                                            */
/* ------------------------------------------------------------------ */

export function validateAccountDetails(
  doc: GLEntryDoc,
  accountDetails?: { is_group: boolean; docstatus: number; company: string }
): string | null {
  if (!accountDetails) {
    return null;
  }

  if (accountDetails.is_group) {
    return `${doc.voucher_type} ${doc.voucher_no}: Account ${doc.account} is a Group Account and group accounts cannot be used in transactions`;
  }

  if (accountDetails.docstatus === 2) {
    return `${doc.voucher_type} ${doc.voucher_no}: Account ${doc.account} is inactive`;
  }

  if (accountDetails.company !== doc.company) {
    return `${doc.voucher_type} ${doc.voucher_no}: Account ${doc.account} does not belong to Company ${doc.company}`;
  }

  return null;
}

export function checkPLAccount(
  doc: GLEntryDoc,
  accountReportType: string | undefined
): string | null {
  if (
    doc.is_opening === "Yes" &&
    accountReportType === "Profit and Loss" &&
    !doc.is_cancelled
  ) {
    return `${doc.voucher_type} ${doc.voucher_no}: 'Profit and Loss' type account ${doc.account} not allowed in Opening Entry`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Dimensions validation                                              */
/* ------------------------------------------------------------------ */

export function validateDimensionsForPLAndBS(
  doc: GLEntryDoc,
  accountReportType: string | undefined,
  dimensions: AccountingDimensionCheck[]
): string | null {
  for (const dimension of dimensions) {
    if (
      accountReportType === "Profit and Loss" &&
      doc.company === dimension.company &&
      dimension.mandatory_for_pl &&
      !doc.is_cancelled
    ) {
      const value = doc[dimension.fieldname as keyof GLEntryDoc];
      if (!value) {
        return `Accounting Dimension ${dimension.label} is required for 'Profit and Loss' account ${doc.account}.`;
      }
    }

    if (
      accountReportType === "Balance Sheet" &&
      doc.company === dimension.company &&
      dimension.mandatory_for_bs &&
      !doc.is_cancelled
    ) {
      const value = doc[dimension.fieldname as keyof GLEntryDoc];
      if (!value) {
        return `Accounting Dimension ${dimension.label} is required for 'Balance Sheet' account ${doc.account}.`;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Party validation                                                   */
/* ------------------------------------------------------------------ */

export function validateParty(
  doc: GLEntryDoc,
  partyContext?: PartyValidationContext
): string | null {
  if (!partyContext) {
    return null;
  }

  if (partyContext.partyFrozen) {
    return `Party ${doc.party} is frozen`;
  }
  if (partyContext.partyDisabled) {
    return `Party ${doc.party} is disabled`;
  }
  if (partyContext.validPartyAccountType === false) {
    return `Party Type ${doc.party_type} is not valid for Account ${doc.account}`;
  }
  if (partyContext.partyGleCurrencyValid === false) {
    return `GL Entry currency ${doc.account_currency} does not match party currency`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Currency validation                                                */
/* ------------------------------------------------------------------ */

export function validateGLEntryCurrency(
  doc: GLEntryDoc,
  companyCurrency: string | undefined,
  accountCurrency: string | undefined,
  partyContext?: PartyValidationContext
): { error?: string; updatedAccountCurrency?: string } {
  if (doc.is_cancelled) {
    return {};
  }

  let updatedAccountCurrency = doc.account_currency;
  if (!updatedAccountCurrency) {
    updatedAccountCurrency = accountCurrency || companyCurrency || "";
  }

  if (accountCurrency && accountCurrency !== updatedAccountCurrency) {
    return {
      error: `${doc.voucher_type} ${doc.voucher_no}: Accounting Entry for ${doc.account} can only be made in currency: ${accountCurrency || companyCurrency}`,
    };
  }

  if (doc.party_type && doc.party && partyContext && partyContext.partyGleCurrencyValid === false) {
    return {
      error: `${doc.voucher_type} ${doc.voucher_no}: Party currency does not match account currency`,
    };
  }

  return { updatedAccountCurrency };
}

/* ------------------------------------------------------------------ */
/*  Reporting currency                                                 */
/* ------------------------------------------------------------------ */

export function setAmountInReportingCurrency(
  doc: GLEntryDoc,
  defaultCurrency: string | undefined,
  reportingCurrency: string | undefined,
  exchangeRate: number | undefined
): { error?: string; updates?: Partial<GLEntryDoc> } {
  const transactionDate = doc.transaction_date || doc.posting_date;

  if (!exchangeRate) {
    return {
      error: `Unable to find exchange rate for ${defaultCurrency} to ${reportingCurrency} for key date ${transactionDate}. Please create a Currency Exchange record manually.`,
    };
  }

  const updates: Partial<GLEntryDoc> = {
    reporting_currency_exchange_rate: exchangeRate,
    debit_in_reporting_currency: flt(doc.debit * exchangeRate, 2),
    credit_in_reporting_currency: flt(doc.credit * exchangeRate, 2),
  };

  return { updates };
}

/* ------------------------------------------------------------------ */
/*  Fiscal year                                                        */
/* ------------------------------------------------------------------ */

export function validateAndSetFiscalYear(
  doc: GLEntryDoc,
  fiscalYear?: string
): { error?: string; updatedFiscalYear?: string } {
  if (!doc.fiscal_year) {
    if (!fiscalYear) {
      return { error: "Fiscal Year is required" };
    }
    return { updatedFiscalYear: fiscalYear };
  }
  return {};
}

/* ------------------------------------------------------------------ */
/*  Cancel validation                                                  */
/* ------------------------------------------------------------------ */

export function validateGLEntryCancel(): string | null {
  return "Individual GL Entry cannot be cancelled. Please cancel related transaction.";
}

/* ------------------------------------------------------------------ */
/*  Balance type validation                                            */
/* ------------------------------------------------------------------ */

export function validateBalanceType(
  account: string,
  balanceMustBe: string | undefined,
  accountBalance: number | undefined,
  advAdj = false
): string | null {
  if (advAdj || !account || !balanceMustBe) {
    return null;
  }

  if (accountBalance === undefined) {
    return null;
  }

  if (balanceMustBe === "Debit" && flt(accountBalance, 2) < 0) {
    return `Balance for Account ${account} must always be Debit`;
  }
  if (balanceMustBe === "Credit" && flt(accountBalance, 2) > 0) {
    return `Balance for Account ${account} must always be Credit`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Outstanding amount                                                 */
/* ------------------------------------------------------------------ */

export function updateOutstandingAmt(
  account: string,
  partyType: string | undefined,
  party: string | undefined,
  againstVoucherType: string,
  againstVoucher: string,
  ctx: OutstandingContext
): { outstandingAmount: number; error?: string } {
  let partyCondition = true;
  if (partyType && party) {
    partyCondition = false;
  }

  let accountCondition = true;
  let partyAccount: string | undefined;
  if (againstVoucherType === "Sales Invoice") {
    partyAccount = ctx.salesInvoicePartyAccount;
    accountCondition = false;
  } else {
    accountCondition = false;
  }

  let bal = 0;
  for (const entry of ctx.existingGLEntries) {
    const matchesParty = partyCondition || (entry.party_type === partyType && entry.party === party);
    const matchesAccount =
      accountCondition ||
      (againstVoucherType === "Sales Invoice"
        ? entry.account === account || entry.account === partyAccount
        : entry.account === account);

    if (matchesParty && matchesAccount) {
      bal += flt(entry.debit_in_account_currency, 2) - flt(entry.credit_in_account_currency, 2);
    }
  }

  if (againstVoucherType === "Purchase Invoice") {
    bal = -bal;
  } else if (againstVoucherType === "Journal Entry") {
    const againstVoucherAmount = ctx.journalEntryAmount ?? 0;

    if (!againstVoucherAmount) {
      return {
        outstandingAmount: 0,
        error: `Against Journal Entry ${againstVoucher} is already adjusted against some other voucher`,
      };
    }

    bal = againstVoucherAmount + bal;
    if (againstVoucherAmount < 0) {
      bal = -bal;
    }

    if (bal < 0 && !ctx.onCancel) {
      return {
        outstandingAmount: bal,
        error: `Outstanding for ${againstVoucher} cannot be less than zero (${bal})`,
      };
    }
  }

  return { outstandingAmount: bal };
}

/* ------------------------------------------------------------------ */
/*  Frozen account validation                                          */
/* ------------------------------------------------------------------ */

export function validateFrozenAccount(
  account: string,
  freezeAccount: string | undefined,
  roleAllowedForFrozenEntries: string | undefined,
  userRoles: string[] | undefined,
  advAdj = false
): string | null {
  if (freezeAccount !== "Yes" || advAdj) {
    return null;
  }

  if (!roleAllowedForFrozenEntries) {
    return `Account ${account} is frozen`;
  }

  if (!userRoles || !userRoles.includes(roleAllowedForFrozenEntries)) {
    return `Not authorized to edit frozen Account ${account}`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Update against account                                             */
/* ------------------------------------------------------------------ */

export function updateAgainstAccount(
  entries: UpdateAgainstAccountEntry[],
  precision = 2
): { name: string; newAgainst: string }[] {
  if (!entries || entries.length === 0) {
    return [];
  }

  const accountsDebited: string[] = [];
  const accountsCredited: string[] = [];

  for (const d of entries) {
    if (flt(d.debit, precision) > 0) {
      accountsDebited.push(d.party || d.account);
    }
    if (flt(d.credit, precision) > 0) {
      accountsCredited.push(d.party || d.account);
    }
  }

  const updates: { name: string; newAgainst: string }[] = [];

  for (const d of entries) {
    let newAgainst = "";
    if (flt(d.debit, precision) > 0) {
      newAgainst = Array.from(new Set(accountsCredited)).join(", ");
    }
    if (flt(d.credit, precision) > 0) {
      newAgainst = Array.from(new Set(accountsDebited)).join(", ");
    }

    if (d.against !== newAgainst) {
      updates.push({ name: d.name, newAgainst });
    }
  }

  return updates;
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

export interface ValidateGLEntryOptions {
  fromRepost?: boolean;
  advAdj?: boolean;
  updateOutstanding?: string;
  isReverseDeprEntry?: boolean;
}

export function validateGLEntry(
  doc: GLEntryDoc,
  ctx: GLEntryValidationContext,
  opts: ValidateGLEntryOptions = {}
): GLEntryValidationResult {
  const updates: Partial<GLEntryDoc> = {};

  try {
    // 1. Fiscal year
    const fyResult = validateAndSetFiscalYear(doc, ctx.fiscalYear);
    if (fyResult.error) {
      return { success: false, error: fyResult.error };
    }
    if (fyResult.updatedFiscalYear) {
      updates.fiscal_year = fyResult.updatedFiscalYear;
    }

    // 2. PL must have cost center
    const plErr = plMustHaveCostCenter(doc, ctx.accountDetails?.report_type);
    if (plErr) return { success: false, error: plErr };

    // 3. Mandatory checks (skip for repost / Period Closing Voucher)
    if (!opts.fromRepost && doc.voucher_type !== "Period Closing Voucher") {
      const mandatoryErr = checkMandatory(
        doc,
        ctx.accountDetails?.account_type,
        !!ctx.partyNotRequired,
        ctx.journalEntryVoucherType
      );
      if (mandatoryErr) return { success: false, error: mandatoryErr };

      // 4. Cost center validation
      const ccErr = validateCostCenter(doc, ctx.costCenterDetails);
      if (ccErr) return { success: false, error: ccErr };

      // 5. PL account in opening
      const plAccountErr = checkPLAccount(doc, ctx.accountDetails?.report_type);
      if (plAccountErr) return { success: false, error: plAccountErr };

      // 6. Party validation
      const partyErr = validateParty(doc, ctx.partyContext);
      if (partyErr) return { success: false, error: partyErr };

      // 7. Currency validation
      const currencyResult = validateGLEntryCurrency(
        doc,
        ctx.companyCurrency,
        ctx.accountDetails?.account_currency,
        ctx.partyContext
      );
      if (currencyResult.error) {
        return { success: false, error: currencyResult.error };
      }
      if (currencyResult.updatedAccountCurrency) {
        updates.account_currency = currencyResult.updatedAccountCurrency;
      }
    }

    // 8. Reporting currency
    const reportingResult = setAmountInReportingCurrency(
      doc,
      ctx.companyCurrency,
      ctx.companyReportingCurrency,
      ctx.reportingExchangeRate
    );
    if (reportingResult.error) {
      return { success: false, error: reportingResult.error };
    }
    if (reportingResult.updates) {
      Object.assign(updates, reportingResult.updates);
    }

    return { success: true, updates };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}

export interface OnUpdateGLEntryContext {
  accountDetails?: GLEntryValidationContext["accountDetails"];
  advAdj?: boolean;
  fromRepost?: boolean;
  journalEntryVoucherType?: string;
  updateOutstanding?: string;
  isReverseDeprEntry?: boolean;
  accountingDimensions?: AccountingDimensionCheck[];
  balanceMustBe?: string;
  accountBalance?: number;
  company?: string;
  roleAllowedForFrozenEntries?: string;
  userRoles?: string[];
  outstandingContext?: OutstandingContext;
}

export interface OnUpdateGLEntryResult {
  success: boolean;
  error?: string;
  outstandingUpdate?: {
    againstVoucherType: string;
    againstVoucher: string;
    outstandingAmount: number;
  };
}

export function onUpdateGLEntry(
  doc: GLEntryDoc,
  ctx: OnUpdateGLEntryContext
): OnUpdateGLEntryResult {
  try {
    if (!ctx.fromRepost && doc.voucher_type !== "Period Closing Voucher") {
      // 1. Validate account details
      const accountErr = validateAccountDetails(doc, ctx.accountDetails);
      if (accountErr) return { success: false, error: accountErr };

      // 2. Validate dimensions
      if (ctx.accountingDimensions && ctx.accountingDimensions.length > 0) {
        const dimErr = validateDimensionsForPLAndBS(
          doc,
          ctx.accountDetails?.report_type,
          ctx.accountingDimensions
        );
        if (dimErr) return { success: false, error: dimErr };
      }

      // 3. Validate balance type
      const balanceErr = validateBalanceType(
        doc.account,
        ctx.balanceMustBe,
        ctx.accountBalance,
        ctx.advAdj
      );
      if (balanceErr) return { success: false, error: balanceErr };

      // 4. Validate frozen account
      const frozenErr = validateFrozenAccount(
        doc.account,
        ctx.accountDetails?.freeze_account,
        ctx.roleAllowedForFrozenEntries,
        ctx.userRoles,
        ctx.advAdj
      );
      if (frozenErr) return { success: false, error: frozenErr };

      // 5. Skip outstanding update for Exchange Gain Or Loss Journal Entries
      if (
        doc.voucher_type === "Journal Entry" &&
        ctx.journalEntryVoucherType === "Exchange Gain Or Loss"
      ) {
        return { success: true };
      }

      // 6. Update outstanding amount
      if (
        ctx.accountDetails?.account_type &&
        ["Receivable", "Payable"].includes(ctx.accountDetails.account_type)
      ) {
        // Only update outstanding for non-receivable/payable accounts if conditions match
      }

      if (
        doc.against_voucher_type &&
        ["Journal Entry", "Sales Invoice", "Purchase Invoice", "Fees"].includes(
          doc.against_voucher_type
        ) &&
        doc.against_voucher &&
        ctx.updateOutstanding === "Yes" &&
        !ctx.isReverseDeprEntry
      ) {
        if (
          ctx.accountDetails?.account_type &&
          !["Receivable", "Payable"].includes(ctx.accountDetails.account_type)
        ) {
          if (ctx.outstandingContext) {
            const result = updateOutstandingAmt(
              doc.account,
              doc.party_type,
              doc.party,
              doc.against_voucher_type,
              doc.against_voucher,
              ctx.outstandingContext
            );
            if (result.error) {
              return { success: false, error: result.error };
            }
            return {
              success: true,
              outstandingUpdate: {
                againstVoucherType: doc.against_voucher_type,
                againstVoucher: doc.against_voucher,
                outstandingAmount: result.outstandingAmount,
              },
            };
          }
        }
      }
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}
