/**
 * Ported from erpnext/accounts/doctype/bank/bank.py
 * Pure logic for Bank DocType.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BankTransactionMapping {
  name?: string;
  bank_transaction_field?: string;
  erpnext_field?: string;
}

export interface BankDoc {
  name: string;
  bank_name: string;
  plaid_access_token?: string;
  swift_number?: string;
  website?: string;
  bank_transaction_mapping?: BankTransactionMapping[];
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

export interface BankValidationResult {
  success: boolean;
  error?: string;
}

export function validateBank(doc: BankDoc): BankValidationResult {
  try {
    if (!doc.bank_name || doc.bank_name.trim().length === 0) {
      return { success: false, error: "Bank Name is required" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Transaction mapping helpers                                        */
/* ------------------------------------------------------------------ */

export function getBankTransactionMapping(
  doc: BankDoc,
  erpnextField: string
): BankTransactionMapping | undefined {
  if (!doc.bank_transaction_mapping) {
    return undefined;
  }
  return doc.bank_transaction_mapping.find((m) => m.erpnext_field === erpnextField);
}

export function getAllMappedFields(doc: BankDoc): string[] {
  if (!doc.bank_transaction_mapping) {
    return [];
  }
  return doc.bank_transaction_mapping
    .map((m) => m.erpnext_field)
    .filter((f): f is string => !!f);
}
