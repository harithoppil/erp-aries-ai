/**
 * Ported from erpnext/payroll/doctype/payroll_entry/payroll_entry.py
 * Pure validation logic for Payroll Entry document.
 *
 * Payroll Entry is an orchestrator that creates draft Salary Slips for
 * eligible employees in bulk. The actual slip creation is a background job
 * in Frappe. This controller handles validation only.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PayrollEmployeeDetailRow {
  name?: string;
  idx: number;
  employee?: string;
  employee_name?: string;
  parent?: string;
  parentfield?: string;
  department?: string;
  designation?: string;
}

export interface PayrollEntryDoc {
  name: string;
  company: string;
  posting_date: string;
  start_date: string;
  end_date: string;
  salary_structure?: string;
  docstatus: number;
  currency?: string;
  department?: string;
  branch?: string;
  designation?: string;
  payroll_frequency?: string;
  status?: string;
  employees?: PayrollEmployeeDetailRow[];
}

export interface PayrollEntryValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Validate a Payroll Entry document.
 *
 * Checks:
 * - Company is required
 * - Posting Date is required
 * - Start Date and End Date are required
 * - Start Date must be before or equal to End Date
 * - Salary Structure (if set) consistency
 */
export function validatePayrollEntry(doc: PayrollEntryDoc): PayrollEntryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

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
    warnings.push("Salary Structure is not set; all active structures will be considered");
  }

  if (!doc.payroll_frequency) {
    warnings.push("Payroll Frequency is not set");
  }

  return { valid: errors.length === 0, errors, warnings };
}
