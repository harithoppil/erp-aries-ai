/**
 * accounts-bank-guarantee.ts
 * Ported business logic from ERPNext accounts/doctype/bank_guarantee/bank_guarantee.py
 * Pure validation & calculation functions — NO database calls.
 */

export type BankGuaranteeType = "" | "Receiving" | "Providing";

export interface BankGuarantee {
  name?: string;
  bg_type: BankGuaranteeType;
  customer?: string;
  supplier?: string;
  bank?: string;
  bank_account?: string;
  bank_account_no?: string;
  bank_guarantee_number?: string;
  name_of_beneficiary?: string;
  start_date: string;
  end_date?: string;
  validity?: number;
  amount: number;
  margin_money?: number;
  charges?: number;
  fixed_deposit_number?: string;
  iban?: string;
  swift_number?: string;
  branch_code?: string;
  project?: string;
  account?: string;
  reference_doctype?: string;
  reference_docname?: string;
  more_information?: string;
  docstatus: number;
  amended_from?: string;
}

export interface VoucherDetails {
  grand_total?: number;
  customer?: string;
  supplier?: string;
  project?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/* ── Validation Functions ────────────────────────────────── */

export function validateBankGuarantee(bg: BankGuarantee): ValidationResult {
  const errors: string[] = [];

  if (!bg.customer && !bg.supplier) {
    errors.push("Select the customer or supplier.");
  }

  return { valid: errors.length === 0, errors };
}

export function validateBankGuaranteeOnSubmit(bg: BankGuarantee): ValidationResult {
  const errors: string[] = [];

  if (!bg.bank_guarantee_number) {
    errors.push("Enter the Bank Guarantee Number before submitting.");
  }

  if (!bg.name_of_beneficiary) {
    errors.push("Enter the name of the Beneficiary before submitting.");
  }

  if (!bg.bank) {
    errors.push("Enter the name of the bank or lending institution before submitting.");
  }

  return { valid: errors.length === 0, errors };
}

/* ── Voucher Details Helper ──────────────────────────────── */

export interface VoucherDetailsInput {
  bankGuaranteeType: BankGuaranteeType;
  referenceName: string;
}

export function getVoucherDetailsFields(
  input: VoucherDetailsInput,
): { doctype: string; fields: string[] } {
  if (!input.referenceName || typeof input.referenceName !== "string") {
    throw new TypeError("reference_name must be a string");
  }

  const fieldsToFetch = ["grand_total"];

  if (input.bankGuaranteeType === "Receiving") {
    return {
      doctype: "Sales Order",
      fields: [...fieldsToFetch, "customer", "project"],
    };
  }

  return {
    doctype: "Purchase Order",
    fields: [...fieldsToFetch, "supplier"],
  };
}

/* ── Date / Validity Helpers ─────────────────────────────── */

export interface ValidityResult {
  startDate: Date;
  endDate: Date;
  daysValid: number;
}

export function calculateValidity(
  startDateStr: string,
  endDateStr?: string,
  validityDays?: number,
): ValidityResult {
  const startDate = new Date(startDateStr);
  let endDate: Date;

  if (endDateStr) {
    endDate = new Date(endDateStr);
  } else if (validityDays) {
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + validityDays);
  } else {
    endDate = new Date(startDate);
  }

  const diffTime = endDate.getTime() - startDate.getTime();
  const daysValid = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return { startDate, endDate, daysValid };
}

/* ── Margin / Net Amount Helpers ─────────────────────────── */

export function calculateNetGuaranteeAmount(bg: BankGuarantee): number {
  const amount = bg.amount || 0;
  const margin = bg.margin_money || 0;
  const charges = bg.charges || 0;
  return amount - margin - charges;
}

export function calculateEffectiveAmount(bg: BankGuarantee): number {
  return bg.amount || 0;
}
