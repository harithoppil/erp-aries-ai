/**
 * Ported from erpnext/accounts/doctype/mode_of_payment/mode_of_payment.py
 * Pure logic for Mode of Payment DocType.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ModeOfPaymentAccount {
  name?: string;
  company: string;
  default_account?: string;
}

export interface ModeOfPaymentDoc {
  name: string;
  mode_of_payment: string;
  enabled: boolean;
  type: "Cash" | "Bank" | "General" | "Phone";
  accounts: ModeOfPaymentAccount[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export interface AccountCompanyMap {
  [accountName: string]: string;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export interface ModeOfPaymentValidationResult {
  success: boolean;
  error?: string;
}

/**
 * Error when Same Company is entered multiple times in accounts.
 */
export function validateRepeatingCompanies(
  accounts: ModeOfPaymentAccount[]
): string | null {
  const companies: string[] = [];
  for (const entry of accounts) {
    companies.push(entry.company);
  }

  if (companies.length !== new Set(companies).size) {
    return "Same Company is entered more than once";
  }

  return null;
}

/**
 * Error when Company of Ledger account doesn't match with Company Selected.
 */
export function validateAccounts(
  doc: ModeOfPaymentDoc,
  accountCompanyMap: AccountCompanyMap
): string | null {
  for (const entry of doc.accounts) {
    if (!entry.default_account) continue;

    const accountCompany = accountCompanyMap[entry.default_account];
    if (accountCompany && accountCompany !== entry.company) {
      return `Account ${entry.default_account} does not match with Company ${entry.company} in Mode of Account: ${doc.name}`;
    }
  }

  return null;
}

/**
 * Validate that a disabled Mode of Payment is not referenced in POS Profiles.
 */
export function validatePOSModeOfPayment(
  doc: ModeOfPaymentDoc,
  posProfilesUsingThisMode: string[]
): string | null {
  if (doc.enabled) {
    return null;
  }

  if (posProfilesUsingThisMode.length > 0) {
    const profiles = posProfilesUsingThisMode.join(", ");
    return `POS Profile ${profiles} contains Mode of Payment ${doc.mode_of_payment}. Please remove them to disable this mode.`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

export interface ValidateModeOfPaymentContext {
  accountCompanyMap: AccountCompanyMap;
  posProfilesUsingThisMode?: string[];
}

export function validateModeOfPayment(
  doc: ModeOfPaymentDoc,
  ctx: ValidateModeOfPaymentContext
): ModeOfPaymentValidationResult {
  try {
    const accountsErr = validateAccounts(doc, ctx.accountCompanyMap);
    if (accountsErr) {
      return { success: false, error: accountsErr };
    }

    const repeatingErr = validateRepeatingCompanies(doc.accounts);
    if (repeatingErr) {
      return { success: false, error: repeatingErr };
    }

    const posErr = validatePOSModeOfPayment(
      doc,
      ctx.posProfilesUsingThisMode ?? []
    );
    if (posErr) {
      return { success: false, error: posErr };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}
