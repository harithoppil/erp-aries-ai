import { errorMessage } from '@/lib/utils';
/**
 * Ported from erpnext/accounts/doctype/bank_account/bank_account.py
 * Pure logic for Bank Account DocType.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BankAccountDoc {
  name: string;
  account?: string;
  account_name: string;
  account_subtype?: string;
  account_type?: string;
  bank: string;
  bank_account_no?: string;
  branch_code?: string;
  company?: string;
  disabled: boolean;
  iban?: string;
  integration_id?: string;
  is_company_account: boolean;
  is_default: boolean;
  last_integration_date?: string;
  mask?: string;
  party?: string;
  party_type?: string;
}

/* ------------------------------------------------------------------ */
/*  Auto-name                                                          */
/* ------------------------------------------------------------------ */

export function getBankAccountAutoname(accountName: string, bank: string): string {
  return `${accountName} - ${bank}`;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export interface BankAccountValidationResult {
  success: boolean;
  error?: string;
  /** Names of other bank accounts that should have is_default cleared */
  clearDefaultFor?: string[];
}

export function validateIsCompanyAccount(doc: BankAccountDoc): string | null {
  if (!doc.is_company_account) {
    return null;
  }

  if (!doc.company) {
    return "Company is mandatory for company account";
  }

  if (!doc.account) {
    return "Company Account is mandatory";
  }

  return null;
}

export function validateAccountUniqueness(
  doc: BankAccountDoc,
  otherAccountsUsingSameAccount: string[]
): string | null {
  if (!doc.account) {
    return null;
  }

  if (otherAccountsUsingSameAccount.length > 0) {
    const others = otherAccountsUsingSameAccount.join(", ");
    return `'${doc.account}' account is already used by ${others}. Use another account.`;
  }

  return null;
}

/**
 * Determine which other bank accounts should have is_default cleared
 * when this account is set as default.
 */
export function getAccountsToClearDefault(
  doc: BankAccountDoc,
  otherBankAccounts: BankAccountDoc[]
): string[] {
  if (!doc.is_default || doc.disabled) {
    return [];
  }

  const toClear: string[] = [];
  for (const other of otherBankAccounts) {
    if (other.name === doc.name) continue;
    if (
      other.party_type === doc.party_type &&
      other.party === doc.party &&
      other.is_company_account === doc.is_company_account &&
      other.company === doc.company &&
      other.is_default &&
      !other.disabled
    ) {
      toClear.push(other.name);
    }
  }

  return toClear;
}

export function validateBankAccount(
  doc: BankAccountDoc,
  ctx: {
    otherAccountsUsingSameAccount?: string[];
    otherBankAccounts?: BankAccountDoc[];
  } = {}
): BankAccountValidationResult {
  try {
    const isCompanyErr = validateIsCompanyAccount(doc);
    if (isCompanyErr) {
      return { success: false, error: isCompanyErr };
    }

    const uniqueErr = validateAccountUniqueness(
      doc,
      ctx.otherAccountsUsingSameAccount ?? []
    );
    if (uniqueErr) {
      return { success: false, error: uniqueErr };
    }

    const clearDefaultFor = getAccountsToClearDefault(
      doc,
      ctx.otherBankAccounts ?? []
    );

    return { success: true, clearDefaultFor };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Lookup helpers (pure — caller passes data)                         */
/* ------------------------------------------------------------------ */

export function getPartyBankAccount(
  partyType: string,
  party: string,
  bankAccounts: BankAccountDoc[]
): BankAccountDoc | undefined {
  return bankAccounts.find(
    (ba) =>
      ba.party_type === partyType &&
      ba.party === party &&
      ba.is_default &&
      !ba.disabled
  );
}

export function getDefaultCompanyBankAccount(
  company: string,
  bankAccounts: BankAccountDoc[],
  partyType?: string,
  party?: string,
  partyDefaultBankAccount?: string,
  partyDefaultBankAccountCompany?: string
): BankAccountDoc | undefined {
  if (partyDefaultBankAccount) {
    if (company === partyDefaultBankAccountCompany) {
      const found = bankAccounts.find((ba) => ba.name === partyDefaultBankAccount);
      if (found) return found;
    }
  }

  return bankAccounts.find(
    (ba) =>
      ba.company === company &&
      ba.is_company_account &&
      ba.is_default
  );
}

export interface BankAccountDetails {
  account?: string;
  bank: string;
  bank_account_no?: string;
}

export function getBankAccountDetails(
  bankAccount: BankAccountDoc
): BankAccountDetails {
  return {
    account: bankAccount.account,
    bank: bankAccount.bank,
    bank_account_no: bankAccount.bank_account_no,
  };
}
