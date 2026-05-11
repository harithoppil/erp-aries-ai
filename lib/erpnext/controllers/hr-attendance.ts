/**
 * Ported from erpnext/hr/doctype/attendance/attendance.py
 * Pure validation logic for Attendance document.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AttendanceDoc {
  name: string;
  employee: string;
  employee_name?: string;
  attendance_date: string;
  status: string;
  company?: string;
  docstatus: number;
  shift?: string;
  late_entry?: boolean;
  early_exit?: boolean;
  in_time?: string;
  out_time?: string;
}

export interface AttendanceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Validate an Attendance document.
 *
 * Checks:
 * - Employee is required
 * - Attendance Date is required
 * - Status must be one of: Present, Absent Half Day, Work From Home
 * - In time / out time consistency (if provided)
 */
export function validateAttendance(doc: AttendanceDoc): AttendanceValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const validStatuses = ["Present", "Absent", "Half Day", "Work From Home"];

  if (!doc.employee) {
    errors.push("Employee is required");
  }

  if (!doc.attendance_date) {
    errors.push("Attendance Date is required");
  }

  if (!doc.status) {
    errors.push("Status is required");
  } else if (!validStatuses.includes(doc.status)) {
    errors.push(`Status must be one of: ${validStatuses.join(", ")}`);
  }

  // In time / out time consistency
  if (doc.in_time && doc.out_time) {
    const inTime = new Date(doc.in_time);
    const outTime = new Date(doc.out_time);

    if (outTime < inTime) {
      errors.push("Out Time cannot be before In Time");
    }
  }

  if (!doc.company) {
    warnings.push("Company is not set");
  }

  return { valid: errors.length === 0, errors, warnings };
}
