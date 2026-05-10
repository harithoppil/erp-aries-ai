import { errorMessage } from '@/lib/utils';
/**
 * ERPNext Asset Category DocType — Pure Business Logic (ported from asset_category.py)
 *
 * All functions are pure: they accept plain objects and return
 * updated objects / validation results.  No DB calls.
 */

export interface AssetCategoryAccount {
  company_name: string;
  fixed_asset_account?: string | null;
  accumulated_depreciation_account?: string | null;
  depreciation_expense_account?: string | null;
  capital_work_in_progress_account?: string | null;
  idx?: number;
}

export interface AssetCategoryFinanceBook {
  finance_book?: string | null;
  depreciation_method: string;
  total_number_of_depreciations: number;
  frequency_of_depreciation: number;
  daily_prorata_based?: boolean;
  shift_based?: boolean;
  salvage_value_percentage?: number;
  expected_value_after_useful_life?: number;
  depreciation_start_date?: Date | string | null;
  rate_of_depreciation?: number;
  idx?: number;
}

export interface AssetCategory {
  name: string;
  asset_category_name: string;
  enable_cwip_accounting: boolean;
  non_depreciable_category: boolean;
  accounts: AssetCategoryAccount[];
  finance_books: AssetCategoryFinanceBook[];
}

export interface CompanyAccountDefaults {
  capital_work_in_progress_account?: string | null;
  accumulated_depreciation_account?: string | null;
  depreciation_expense_account?: string | null;
  default_currency?: string | null;
}

export interface AccountMeta {
  account_currency?: string | null;
  account_type?: string | null;
  root_type?: string | null;
}

export interface AssetCategoryValidationResult {
  category: AssetCategory;
  errors: string[];
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function cint(val: number | string | boolean | null | undefined): number {
  if (val === true) return 1;
  if (val === false) return 0;
  const num = typeof val === "string" ? parseInt(val, 10) : val ?? 0;
  return isNaN(num) ? 0 : num;
}

/* ────────────────────────────────────────────────────────────────
   Validation
   ──────────────────────────────────────────────────────────────── */

export function validateAssetCategory(
  category: AssetCategory,
  companyDefaults: Record<string, CompanyAccountDefaults>,
  accountMeta: Record<string, AccountMeta>,
  companiesWithAssets?: string[]
): AssetCategoryValidationResult {
  const errors: string[] = [];
  const pushError = (msg: string) => errors.push(msg);

  try {
    validateFinanceBooks(category, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateAccountTypes(category, accountMeta, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateAccountCurrency(category, companyDefaults, accountMeta, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateAccounts(category, companyDefaults, companiesWithAssets ?? [], pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  return { category, errors };
}

export function validateFinanceBooks(
  category: AssetCategory,
  onError?: (msg: string) => void
): void {
  for (const d of category.finance_books) {
    for (const field of ["Total Number of Depreciations", "Frequency of Depreciation"] as const) {
      const scrubbed = field.toLowerCase().replace(/\s+/g, "_");
      const val = (d as unknown as Record<string, number | undefined>)[scrubbed];
      if (cint(val) < 1) {
        const msg = `Row ${d.idx ?? 0}: ${field} must be greater than 0`;
        if (onError) onError(msg);
        else throw new Error(msg);
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   Account Currency
   ──────────────────────────────────────────────────────────────── */

export function validateAccountCurrency(
  category: AssetCategory,
  companyDefaults: Record<string, CompanyAccountDefaults>,
  accountMeta: Record<string, AccountMeta>,
  onError?: (msg: string) => void
): void {
  const accountTypes = [
    "fixed_asset_account",
    "accumulated_depreciation_account",
    "depreciation_expense_account",
    "capital_work_in_progress_account",
  ] as const;

  const invalidAccounts: Array<{ type: string; idx: number; account: string }> = [];

  for (const d of category.accounts) {
    const companyCurrency = companyDefaults[d.company_name]?.default_currency;
    for (const typeOfAccount of accountTypes) {
      const account = (d as unknown as Record<string, string | null | undefined>)[typeOfAccount];
      if (account) {
        const accountCurrency = accountMeta[account]?.account_currency;
        if (accountCurrency && companyCurrency && accountCurrency !== companyCurrency) {
          invalidAccounts.push({ type: typeOfAccount, idx: d.idx ?? 0, account });
        }
      }
    }
  }

  for (const d of invalidAccounts) {
    const msg = `Row #${d.idx}: Currency of ${d.type} - ${d.account} doesn't match company currency.`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

/* ────────────────────────────────────────────────────────────────
   Account Types
   ──────────────────────────────────────────────────────────────── */

export function validateAccountTypes(
  category: AssetCategory,
  accountMeta: Record<string, AccountMeta>,
  onError?: (msg: string) => void
): void {
  const accountTypeMap: Record<string, { account_type: string[] }> = {
    fixed_asset_account: { account_type: ["Fixed Asset"] },
    accumulated_depreciation_account: { account_type: ["Accumulated Depreciation"] },
    depreciation_expense_account: { account_type: ["Depreciation"] },
    capital_work_in_progress_account: { account_type: ["Capital Work in Progress"] },
  };

  for (const d of category.accounts) {
    for (const fieldname of Object.keys(accountTypeMap)) {
      const selectedAccount = (d as unknown as Record<string, string | null | undefined>)[fieldname];
      if (!selectedAccount) continue;

      const expectedTypes = accountTypeMap[fieldname].account_type;
      const selectedType = accountMeta[selectedAccount]?.account_type;

      if (selectedType && !expectedTypes.includes(selectedType)) {
        const msg = `Row #${d.idx ?? 0}: account_type of ${selectedAccount} should be ${expectedTypes.join(" or ")}. Please update the account_type or select a different account.`;
        if (onError) onError(msg);
        else throw new Error(msg);
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   Accounts Validation
   ──────────────────────────────────────────────────────────────── */

export function validateAccounts(
  category: AssetCategory,
  companyDefaults: Record<string, CompanyAccountDefaults>,
  companiesWithAssets: string[],
  onError?: (msg: string) => void
): void {
  validateDuplicateRows(category, onError);
  validateCwipAccounts(category, companyDefaults, onError);
  validateDepreciationAccounts(category, companyDefaults, companiesWithAssets, onError);
}

export function validateDuplicateRows(
  category: AssetCategory,
  onError?: (msg: string) => void
): void {
  const companies = new Set<string>();
  for (const row of category.accounts) {
    if (companies.has(row.company_name)) {
      const msg = "Cannot set multiple account rows for the same company";
      if (onError) onError(msg);
      else throw new Error(msg);
    }
    companies.add(row.company_name);
  }
}

export function validateCwipAccounts(
  category: AssetCategory,
  companyDefaults: Record<string, CompanyAccountDefaults>,
  onError?: (msg: string) => void
): void {
  if (!category.enable_cwip_accounting) return;

  const missingCwipAccounts: string[] = [];
  for (const d of category.accounts) {
    const hasCwip =
      d.capital_work_in_progress_account ||
      companyDefaults[d.company_name]?.capital_work_in_progress_account;
    if (!hasCwip) {
      missingCwipAccounts.push(d.company_name);
    }
  }

  if (missingCwipAccounts.length > 0) {
    const msg =
      `To enable Capital Work in Progress Accounting, you must select Capital Work in Progress Account in accounts table. ` +
      `You can also set default CWIP account in Company ${missingCwipAccounts.join(", ")}`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateDepreciationAccounts(
  category: AssetCategory,
  companyDefaults: Record<string, CompanyAccountDefaults>,
  companiesWithAssets: string[],
  onError?: (msg: string) => void
): void {
  const depreciationAccountMap: Record<string, string> = {
    accumulated_depreciation_account: "Accumulated Depreciation Account",
    depreciation_expense_account: "Depreciation Expense Account",
  };

  const errorMsg: string[] = [];
  const companiesWithAccounts = new Set<string>();

  function validateCompanyAccounts(company: string, accRow?: AssetCategoryAccount): void {
    const defaults = companyDefaults[company];
    for (const [fieldname, label] of Object.entries(depreciationAccountMap)) {
      const rowValue = accRow ? (accRow as unknown as Record<string, string | null | undefined>)[fieldname] : null;
      const defaultValue = defaults ? (defaults as unknown as Record<string, string | null | undefined>)[fieldname] : null;
      if (!rowValue && !defaultValue) {
        if (accRow) {
          errorMsg.push(`Row #${accRow.idx ?? 0}: Missing ${label} for company ${company}.`);
        } else {
          const msg = `Missing account configuration for company ${company}.`;
          if (!errorMsg.includes(msg)) errorMsg.push(msg);
        }
      }
    }
  }

  for (const accRow of category.accounts) {
    companiesWithAccounts.add(accRow.company_name);
    if (companiesWithAssets.includes(accRow.company_name)) {
      validateCompanyAccounts(accRow.company_name, accRow);
    }
  }

  for (const company of companiesWithAssets) {
    if (!companiesWithAccounts.has(company)) {
      validateCompanyAccounts(company);
    }
  }

  if (errorMsg.length > 0) {
    const msg =
      `Since there are active depreciable assets under this category, the following accounts are required. ` +
      `You can either configure default depreciation accounts in the Company or set the required accounts in the following rows: ` +
      errorMsg.join("\n");
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

/* ────────────────────────────────────────────────────────────────
   get_asset_category_account helper
   ──────────────────────────────────────────────────────────────── */

export function getAssetCategoryAccount(
  fieldname: string,
  assetCategoryAccounts: AssetCategoryAccount[],
  company: string
): string | null {
  const row = assetCategoryAccounts.find((a) => a.company_name === company);
  if (!row) return null;
  return (row as unknown as Record<string, string | null | undefined>)[fieldname] ?? null;
}
