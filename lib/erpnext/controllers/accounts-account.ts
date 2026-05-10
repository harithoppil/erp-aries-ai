/**
 * Ported from erpnext/accounts/doctype/account/account.py
 * Pure validation logic for Account master (Chart of Accounts).
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type AccountType =
  | ""
  | "Accumulated Depreciation"
  | "Asset Received But Not Billed"
  | "Bank"
  | "Cash"
  | "Chargeable"
  | "Capital Work in Progress"
  | "Cost of Goods Sold"
  | "Current Asset"
  | "Current Liability"
  | "Depreciation"
  | "Direct Expense"
  | "Direct Income"
  | "Equity"
  | "Expense Account"
  | "Expenses Included In Asset Valuation"
  | "Expenses Included In Valuation"
  | "Fixed Asset"
  | "Income Account"
  | "Indirect Expense"
  | "Indirect Income"
  | "Liability"
  | "Payable"
  | "Receivable"
  | "Round Off"
  | "Round Off for Opening"
  | "Stock"
  | "Stock Adjustment"
  | "Stock Received But Not Billed"
  | "Service Received But Not Billed"
  | "Tax"
  | "Temporary";

export type RootType = "" | "Asset" | "Liability" | "Income" | "Expense" | "Equity";
export type ReportType = "" | "Balance Sheet" | "Profit and Loss";
export type BalanceMustBe = "" | "Debit" | "Credit";

export interface AccountDoc {
  name?: string;
  account_name: string;
  account_number?: string | null;
  company: string;
  parent_account?: string | null;
  is_group?: boolean;
  disabled?: boolean;
  account_type?: AccountType;
  root_type?: RootType;
  report_type?: ReportType;
  balance_must_be?: BalanceMustBe;
  freeze_account?: "No" | "Yes";
  account_currency?: string | null;
  tax_rate?: number;
  include_in_gross?: boolean;
  account_category?: string | null;
  old_parent?: string | null;
  lft?: number;
  rgt?: number;
}

export interface AccountValidationContext {
  /** Parent account details (null if root). */
  parentAccount: { name: string; is_group: boolean; company: string; account_type?: AccountType; root_type?: RootType; report_type?: ReportType } | null;
  /** Whether this account was root before save. */
  wasRoot: boolean;
  /** Previous disabled state (for updates). */
  previousDisabled?: boolean;
  /** Previous is_group state (for updates). */
  previousIsGroup?: boolean;
  /** Whether GL entries exist for this account. */
  hasGLEntries: boolean;
  /** Whether child accounts exist. */
  hasChildren: boolean;
  /** Current account balance. */
  accountBalance?: number;
  /** GL entry currency (if any). */
  glCurrency?: string | null;
  /** Company default currency. */
  companyDefaultCurrency: string;
  /** Whether this account is set as any company default. */
  isDefaultAccount: boolean;
  /** Whether current user can freeze accounts. */
  canFreezeAccount: boolean;
  /** Previous freeze_account value (for updates). */
  previousFreezeAccount?: string;
  /** Previous account type (for updates). */
  previousAccountType?: AccountType;
  /** Existing account with same number in same company (for uniqueness check). */
  existingAccountWithSameNumber?: string | null;
  /** Map of default account field → human label. */
  defaultAccountFields?: Record<string, string>;
  /** Map of field name → account name set in company defaults. */
  companyDefaultAccounts?: Record<string, string | null>;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface ConversionResult {
  canConvert: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cint(value: unknown): number {
  return Number(value) || 0;
}

/* ------------------------------------------------------------------ */
/*  Naming                                                             */
/* ------------------------------------------------------------------ */

/** Build account autoname from number, name and company abbreviation. */
export function getAccountAutoname(
  accountNumber: string | undefined,
  accountName: string,
  companyAbbr: string
): string {
  const parts: string[] = [accountName.trim(), companyAbbr];
  const num = (accountNumber ?? "").trim();
  if (num) {
    parts.unshift(num);
  }
  return parts.join(" - ");
}

/* ------------------------------------------------------------------ */
/*  Parent validations                                                 */
/* ------------------------------------------------------------------ */

/** Validate parent account constraints. */
export function validateParent(
  doc: AccountDoc,
  parentAccount: { name: string; is_group: boolean; company: string } | null
): string | null {
  if (!doc.parent_account) return null;

  if (!parentAccount) {
    return `Account ${doc.name}: Parent account ${doc.parent_account} does not exist`;
  }
  if (parentAccount.name === doc.name) {
    return `Account ${doc.name}: You can not assign itself as parent account`;
  }
  if (!parentAccount.is_group) {
    return `Account ${doc.name}: Parent account ${doc.parent_account} can not be a ledger`;
  }
  if (parentAccount.company !== doc.company) {
    return `Account ${doc.name}: Parent account ${doc.parent_account} does not belong to company: ${doc.company}`;
  }
  return null;
}

/** Validate that certain account types cannot have a parent of the same type. */
export function validateParentChildAccountType(
  doc: AccountDoc,
  parentAccountType: AccountType | null
): string | null {
  const restrictedTypes: AccountType[] = [
    "Direct Income",
    "Indirect Income",
    "Current Asset",
    "Current Liability",
    "Direct Expense",
    "Indirect Expense",
  ];

  if (doc.parent_account && doc.account_type && restrictedTypes.includes(doc.account_type)) {
    if (parentAccountType === doc.account_type) {
      return `Only Parent can be of type ${doc.account_type}`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Root validations                                                   */
/* ------------------------------------------------------------------ */

/** Validate root account rules. */
export function validateRootDetails(
  doc: AccountDoc,
  wasRoot: boolean,
  previousParentAccount?: string | null
): string | null {
  // Root cannot be edited (parent changed from empty)
  if (wasRoot && previousParentAccount === undefined && doc.parent_account) {
    return "Root cannot be edited.";
  }

  // Root must be a group
  if (!doc.parent_account && !cint(doc.is_group)) {
    return `The root account ${doc.name} must be a group`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Report / Root type inheritance                                     */
/* ------------------------------------------------------------------ */

/** Derive report_type and root_type from parent, or infer report_type from root_type.
 *  Returns the values that should be set on the doc.
 */
export function setRootAndReportType(
  doc: AccountDoc,
  parentReportType: ReportType | null,
  parentRootType: RootType | null
): { report_type?: ReportType; root_type?: RootType } {
  const result: { report_type?: ReportType; root_type?: RootType } = {};

  if (doc.parent_account) {
    if (parentReportType) {
      result.report_type = parentReportType;
    }
    if (parentRootType) {
      result.root_type = parentRootType;
    }
  }

  if (doc.root_type && !result.report_type && !doc.report_type) {
    result.report_type = ["Asset", "Liability", "Equity"].includes(doc.root_type)
      ? "Balance Sheet"
      : "Profit and Loss";
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Mandatory fields                                                   */
/* ------------------------------------------------------------------ */

export function validateMandatory(doc: Pick<AccountDoc, "root_type" | "report_type">): string | null {
  if (!doc.root_type) {
    return "Root Type is mandatory";
  }
  if (!doc.report_type) {
    return "Report Type is mandatory";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Disabled / Group-or-Ledger                                         */
/* ------------------------------------------------------------------ */

/** Validate disabled transition. */
export function validateDisabled(
  doc: AccountDoc,
  previousDisabled: boolean | undefined,
  isDefaultAccount: boolean
): string | null {
  if (previousDisabled === undefined || cint(previousDisabled) === cint(doc.disabled)) {
    return null;
  }

  if (cint(doc.disabled) && isDefaultAccount) {
    return `Account ${doc.name} cannot be disabled as it is already set as a default account for ${doc.company}.`;
  }

  return null;
}

/** Validate group ↔ ledger conversion. */
export function validateGroupOrLedger(
  doc: AccountDoc,
  previousIsGroup: boolean | undefined,
  hasGLEntries: boolean,
  hasChildren: boolean,
  excludeAccountTypeCheck = false
): string | null {
  if (previousIsGroup === undefined || cint(previousIsGroup) === cint(doc.is_group)) {
    return null;
  }

  if (hasGLEntries) {
    return "Account with existing transaction cannot be converted to ledger";
  }

  if (cint(doc.is_group)) {
    if (doc.account_type && !excludeAccountTypeCheck) {
      return "Cannot covert to Group because Account Type is selected.";
    }
  } else if (hasChildren) {
    return "Account with child nodes cannot be set as ledger";
  }

  return null;
}

/** Validate that account is not a company default before disabling/converting. */
export function validateDefaultAccountsInCompany(
  accountName: string,
  isDisabled: boolean,
  defaultAccountFields: Record<string, string>,
  companyDefaultAccounts: Record<string, string | null>
): string | null {
  let msg = `Account ${accountName} cannot be disabled as it is already set as {1} for {2}.`;
  if (!isDisabled) {
    msg = `Account ${accountName} cannot be converted to Group as it is already set as {1} for {2}.`;
  }

  for (const field of Object.keys(defaultAccountFields)) {
    if (companyDefaultAccounts[field] === accountName) {
      return msg.replace("{1}", defaultAccountFields[field]!).replace("{2}", companyDefaultAccounts["company"] || "");
    }
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Frozen account                                                     */
/* ------------------------------------------------------------------ */

export function validateFrozenAccountsModifier(
  previousFreezeAccount: string | undefined,
  freezeAccount: string | undefined,
  canFreeze: boolean
): string | null {
  if (previousFreezeAccount === undefined || previousFreezeAccount === freezeAccount) {
    return null;
  }
  if (!canFreeze) {
    return "You are not authorized to set Frozen value";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Balance must be                                                    */
/* ------------------------------------------------------------------ */

export function validateBalanceMustBeDebitOrCredit(
  accountBalance: number | undefined,
  balanceMustBe: BalanceMustBe | undefined
): string | null {
  if (!balanceMustBe) return null;

  const balance = accountBalance ?? 0;

  if (balance > 0 && balanceMustBe === "Credit") {
    return "Account balance already in Debit, you are not allowed to set 'Balance Must Be' as 'Credit'";
  }
  if (balance < 0 && balanceMustBe === "Debit") {
    return "Account balance already in Credit, you are not allowed to set 'Balance Must Be' as 'Debit'";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Currency                                                           */
/* ------------------------------------------------------------------ */

/** Validate account currency and detect whether user explicitly set it.
 *  Returns the currency to use and whether it was explicitly specified.
 */
export function validateAccountCurrency(
  doc: AccountDoc,
  glCurrency: string | null,
  hasGLEntries: boolean,
  companyDefaultCurrency: string
): { account_currency: string; currency_explicitly_specified: boolean; error?: string } {
  let currencyExplicitlySpecified = true;
  let accountCurrency = doc.account_currency || companyDefaultCurrency;

  if (!doc.account_currency) {
    currencyExplicitlySpecified = false;
    accountCurrency = companyDefaultCurrency;
  }

  if (glCurrency && accountCurrency !== glCurrency && hasGLEntries) {
    return {
      account_currency: accountCurrency,
      currency_explicitly_specified: currencyExplicitlySpecified,
      error: "Currency can not be changed after making entries using some other currency",
    };
  }

  return {
    account_currency: accountCurrency,
    currency_explicitly_specified: currencyExplicitlySpecified,
  };
}

/* ------------------------------------------------------------------ */
/*  Account number                                                     */
/* ------------------------------------------------------------------ */

export function validateAccountNumber(
  accountNumber: string | undefined,
  accountName: string,
  company: string,
  existingAccountWithSameNumber: string | null
): string | null {
  if (!accountNumber) return null;

  if (existingAccountWithSameNumber) {
    return `Account Number ${accountNumber} already used in account ${existingAccountWithSameNumber}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Receivable / Payable type change                                   */
/* ------------------------------------------------------------------ */

/** Warn (via returned string) when changing Receivable/Payable type after ledger entries exist. */
export function validateReceivablePayableAccountType(
  previousAccountType: AccountType | undefined,
  currentAccountType: AccountType | undefined,
  hasGLEntries: boolean
): string | null {
  const receivablePayableTypes: AccountType[] = ["Receivable", "Payable"];

  if (
    previousAccountType &&
    receivablePayableTypes.includes(previousAccountType) &&
    previousAccountType !== currentAccountType &&
    hasGLEntries
  ) {
    return `There are ledger entries against this account. Changing Account Type to non-${previousAccountType} in live system will cause incorrect output in 'Accounts ${previousAccountType}' report`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Master validate                                                    */
/* ------------------------------------------------------------------ */

/** Run all account validations. Returns ValidationResult. */
export function validateAccount(doc: AccountDoc, ctx: AccountValidationContext): ValidationResult {
  const warnings: string[] = [];

  // Parent
  const parentErr = validateParent(doc, ctx.parentAccount);
  if (parentErr) return { success: false, error: parentErr };

  // Parent-child account type
  const parentTypeErr = validateParentChildAccountType(
    doc,
    ctx.parentAccount?.account_type ?? null
  );
  if (parentTypeErr) return { success: false, error: parentTypeErr };

  // Root details
  const rootErr = validateRootDetails(doc, ctx.wasRoot);
  if (rootErr) return { success: false, error: rootErr };

  // Account number
  const numErr = validateAccountNumber(
    doc.account_number ?? undefined,
    doc.account_name,
    doc.company,
    ctx.existingAccountWithSameNumber ?? null
  );
  if (numErr) return { success: false, error: numErr };

  // Disabled
  const disabledErr = validateDisabled(doc, ctx.previousDisabled, ctx.isDefaultAccount);
  if (disabledErr) return { success: false, error: disabledErr };

  // Group / Ledger
  const groupErr = validateGroupOrLedger(doc, ctx.previousIsGroup, ctx.hasGLEntries, ctx.hasChildren);
  if (groupErr) return { success: false, error: groupErr };

  // Mandatory
  const mandatoryErr = validateMandatory(doc);
  if (mandatoryErr) return { success: false, error: mandatoryErr };

  // Frozen account modifier
  const frozenErr = validateFrozenAccountsModifier(
    ctx.previousFreezeAccount,
    doc.freeze_account,
    ctx.canFreezeAccount
  );
  if (frozenErr) return { success: false, error: frozenErr };

  // Balance must be
  const balanceErr = validateBalanceMustBeDebitOrCredit(ctx.accountBalance, doc.balance_must_be);
  if (balanceErr) return { success: false, error: balanceErr };

  // Currency
  const currencyResult = validateAccountCurrency(doc, ctx.glCurrency ?? null, ctx.hasGLEntries, ctx.companyDefaultCurrency);
  if (currencyResult.error) return { success: false, error: currencyResult.error };

  // Receivable / Payable type change warning
  const rpWarning = validateReceivablePayableAccountType(
    ctx.previousAccountType,
    doc.account_type,
    ctx.hasGLEntries
  );
  if (rpWarning) warnings.push(rpWarning);

  return { success: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  Group ↔ Ledger conversion                                          */
/* ------------------------------------------------------------------ */

export function canConvertGroupToLedger(hasChildren: boolean, hasGLEntries: boolean): ConversionResult {
  if (hasChildren) {
    return { canConvert: false, error: "Account with child nodes cannot be converted to ledger" };
  }
  if (hasGLEntries) {
    return { canConvert: false, error: "Account with existing transaction cannot be converted to ledger" };
  }
  return { canConvert: true };
}

export function canConvertLedgerToGroup(
  accountType: AccountType | undefined,
  hasGLEntries: boolean,
  excludeAccountTypeCheck = false
): ConversionResult {
  if (hasGLEntries) {
    return { canConvert: false, error: "Account with existing transaction can not be converted to group." };
  }
  if (accountType && !excludeAccountTypeCheck) {
    return { canConvert: false, error: "Cannot convert to Group because Account Type is selected." };
  }
  return { canConvert: true };
}

/* ------------------------------------------------------------------ */
/*  Merge                                                              */
/* ------------------------------------------------------------------ */

export function validateMergeAccount(
  oldAccount: AccountDoc,
  newAccount: AccountDoc
): string | null {
  if (
    cint(oldAccount.is_group) !== cint(newAccount.is_group) ||
    oldAccount.root_type !== newAccount.root_type ||
    oldAccount.company !== newAccount.company ||
    (oldAccount.account_currency || "") !== (newAccount.account_currency || "")
  ) {
    return "Merging is only possible if following properties are same in both records: Is Group, Root Type, Company and Account Currency";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Company default account fields                                     */
/* ------------------------------------------------------------------ */

/** Return the map of company default account field names to human labels. */
export function getCompanyDefaultAccountFields(): Record<string, string> {
  return {
    default_bank_account: "Default Bank Account",
    default_cash_account: "Default Cash Account",
    default_receivable_account: "Default Receivable Account",
    default_payable_account: "Default Payable Account",
    default_expense_account: "Default Expense Account",
    default_income_account: "Default Income Account",
    stock_received_but_not_billed: "Stock Received But Not Billed Account",
    stock_adjustment_account: "Stock Adjustment Account",
    write_off_account: "Write Off Account",
    default_discount_account: "Default Payment Discount Account",
    unrealized_profit_loss_account: "Unrealized Profit / Loss Account",
    exchange_gain_loss_account: "Exchange Gain / Loss Account",
    unrealized_exchange_gain_loss_account: "Unrealized Exchange Gain / Loss Account",
    round_off_account: "Round Off Account",
    default_deferred_revenue_account: "Default Deferred Revenue Account",
    default_deferred_expense_account: "Default Deferred Expense Account",
    accumulated_depreciation_account: "Accumulated Depreciation Account",
    depreciation_expense_account: "Depreciation Expense Account",
    disposal_account: "Gain/Loss Account on Asset Disposal",
  };
}
