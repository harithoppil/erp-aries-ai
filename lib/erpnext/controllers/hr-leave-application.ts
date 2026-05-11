/**
 * Ported from erpnext/hr/doctype/leave_application/leave_application.py
 * Pure business logic for Leave Application validation and lifecycle.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LeaveApplicationDoc {
  name: string;
  employee: string;
  employee_name?: string;
  leave_type: string;
  from_date: string;
  to_date: string;
  half_day?: boolean;
  half_day_date?: string;
  total_leave_days: number;
  docstatus: number;
  company?: string;
  status?: string;
  description?: string;
  leave_approver?: string;
}

export interface LeaveValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Validate a Leave Application document.
 *
 * Checks:
 * - Employee is required
 * - Leave Type is required
 * - From Date and To Date are required
 * - From Date must be before or equal to To Date
 * - Total leave days must be positive
 * - Half day date (if set) must fall within the leave period
 */
export function validateLeaveApplication(doc: LeaveApplicationDoc): LeaveValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!doc.employee) {
    errors.push("Employee is required");
  }

  if (!doc.leave_type) {
    errors.push("Leave Type is required");
  }

  if (!doc.from_date) {
    errors.push("From Date is required");
  }

  if (!doc.to_date) {
    errors.push("To Date is required");
  }

  if (doc.from_date && doc.to_date) {
    const fromDate = new Date(doc.from_date);
    const toDate = new Date(doc.to_date);

    if (fromDate > toDate) {
      errors.push("From Date must be before or equal to To Date");
    }
  }

  if (doc.total_leave_days !== undefined && doc.total_leave_days <= 0) {
    errors.push("Total Leave Days must be greater than 0");
  }

  if (doc.half_day && doc.half_day_date) {
    if (doc.from_date && doc.to_date) {
      const halfDayDate = new Date(doc.half_day_date);
      const fromDate = new Date(doc.from_date);
      const toDate = new Date(doc.to_date);

      if (halfDayDate < fromDate || halfDayDate > toDate) {
        errors.push("Half Day Date must be within the leave period");
      }
    }
  }

  if (!doc.company) {
    warnings.push("Company is not set; leave may not post correctly");
  }

  return { valid: errors.length === 0, errors, warnings };
}
