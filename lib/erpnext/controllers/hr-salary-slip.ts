/**
 * Ported from erpnext/payroll/doctype/salary_slip/salary_slip.py
 * Pure business logic for Salary Slip validation, GL entries, and lifecycle.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SalaryDetailRow {
  name?: string;
  idx: number;
  salary_component?: string;
  amount?: number;
  parent?: string;
  parentfield?: string;
  depends_on_lwp?: boolean;
  do_not_include_in_total?: boolean;
  is_tax_applicable?: boolean;
  is_flexible_benefit?: boolean;
  default_account?: string;
  cost_center?: string;
}

export interface SalarySlipDoc {
  name: string;
  employee: string;
  employee_name?: string;
  company: string;
  posting_date: string;
  start_date?: string;
  end_date?: string;
  gross_pay: number;
  total_deduction: number;
  net_pay: number;
  salary_structure?: string;
  docstatus: number;
  payroll_payable_account?: string;
  currency?: string;
  exchange_rate?: number;
  status?: string;
  earnings?: SalaryDetailRow[];
  deductions?: SalaryDetailRow[];
}

export interface SalarySlipGLEntry {
  account: string;
  debit: number;
  credit: number;
  against: string;
  cost_center?: string;
  remarks?: string;
}

export interface SalarySlipSubmitResult {
  success: boolean;
  gl_entries: SalarySlipGLEntry[];
  warnings?: string[];
}

export interface SalarySlipCancelResult {
  success: boolean;
  gl_entries_reversed: boolean;
}

export interface SalarySlipValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Validate a Salary Slip document.
 *
 * Checks:
 * - Employee is required
 * - Company is required
 * - Posting date is required
 * - Start date and end date are required
 * - Net pay must be non-negative
 */
export function validateSalarySlip(doc: SalarySlipDoc): SalarySlipValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc.employee) {
    errors.push("Employee is required");
  }

  if (!doc.company) {
    errors.push("Company is required");
  }

  if (!doc.posting_date) {
    errors.push("Posting Date is required");
  }

  if (!doc.start_date) {
    errors.push("Start Date is required");
  }

  if (!doc.end_date) {
    errors.push("End Date is required");
  }

  if (doc.start_date && doc.end_date) {
    const startDate = new Date(doc.start_date);
    const endDate = new Date(doc.end_date);

    if (startDate > endDate) {
      errors.push("Start Date must be before or equal to End Date");
    }
  }

  if (!doc.salary_structure) {
    warnings.push("Salary Structure is not set");
  }

  if (doc.net_pay < 0) {
    errors.push("Net Pay cannot be negative");
  }

  return { valid: errors.length === 0, errors, warnings };
}

/* ------------------------------------------------------------------ */
/*  Submit — Build GL Entries                                          */
/* ------------------------------------------------------------------ */

/**
 * On submit, Salary Slip creates GL entries:
 *   - For each earning: Debit Salary Expense account
 *   - For each deduction: Credit Statutory Payable account
 *   - Net pay: Credit Salary Payable (Payroll Payable Account)
 *
 * NOTE: In the real ERPNext, accounts come from the Salary Component master.
 * Here we use the default_account from each salary detail row, falling back
 * to reasonable placeholders.
 */
export function onSubmitSalarySlip(doc: SalarySlipDoc): SalarySlipSubmitResult {
  const glEntries: SalarySlipGLEntry[] = [];
  const warnings: string[] = [];
  const payableAccount = doc.payroll_payable_account ?? "Salary Payable";

  // Earning entries: Debit salary expense accounts
  const earnings = doc.earnings ?? [];
  for (const row of earnings) {
    if (row.do_not_include_in_total) continue;
    const amount = row.amount ?? 0;
    if (amount === 0) continue;

    const account = row.default_account ?? `${row.salary_component ?? "Salary Expense"}`;
    glEntries.push({
      account,
      debit: amount,
      credit: 0,
      against: payableAccount,
      cost_center: row.cost_center,
      remarks: `Earning: ${row.salary_component ?? "Unknown"}`,
    });
  }

  // Deduction entries: Credit statutory/deduction payable accounts
  const deductions = doc.deductions ?? [];
  for (const row of deductions) {
    if (row.do_not_include_in_total) continue;
    const amount = row.amount ?? 0;
    if (amount === 0) continue;

    const account = row.default_account ?? `${row.salary_component ?? "Deduction Payable"}`;
    glEntries.push({
      account,
      debit: 0,
      credit: amount,
      against: doc.employee,
      cost_center: row.cost_center,
      remarks: `Deduction: ${row.salary_component ?? "Unknown"}`,
    });
  }

  // Net pay: Credit the payroll payable account
  if (doc.net_pay > 0) {
    glEntries.push({
      account: payableAccount,
      debit: 0,
      credit: doc.net_pay,
      against: doc.employee,
      remarks: `Net Pay for ${doc.employee_name ?? doc.employee}`,
    });
  }

  return { success: true, gl_entries: glEntries, warnings };
}

/* ------------------------------------------------------------------ */
/*  Cancel — Reverse GL Entries                                        */
/* ------------------------------------------------------------------ */

/**
 * On cancel, Salary Slip reverses all GL entries.
 * The actual reversal is handled by the orchestrator's GL reversal mechanism.
 */
export function onCancelSalarySlip(doc: SalarySlipDoc): SalarySlipCancelResult {
  // The orchestrator handles GL reversal by creating mirror entries.
  // We just signal that GL entries should be reversed.
  void doc; // referenced for clarity that cancel depends on doc identity
  return { success: true, gl_entries_reversed: true };
}
