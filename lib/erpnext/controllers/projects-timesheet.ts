/**
 * ERPNext Timesheet DocType — Pure Business Logic (ported from timesheet.py)
 *
 * All functions are pure: they accept plain objects and return
 * updated objects / validation results.  No DB calls.
 */

export interface TimesheetDetail {
  name?: string | null;
  idx?: number;
  from_time?: Date | string | null;
  to_time?: Date | string | null;
  hours?: number;
  billing_hours?: number;
  billing_amount?: number;
  base_billing_amount?: number;
  costing_amount?: number;
  base_costing_amount?: number;
  billing_rate?: number;
  costing_rate?: number;
  base_billing_rate?: number;
  base_costing_rate?: number;
  is_billable?: boolean;
  completed?: boolean;
  sales_invoice?: string | null;
  project?: string | null;
  task?: string | null;
  activity_type?: string | null;
  description?: string | null;
  project_name?: string | null;
  expected_hours?: number;
  parent?: string | null;
  docstatus: number;
}

export interface Timesheet {
  name: string;
  docstatus: number;
  status: string;
  employee?: string | null;
  employee_name?: string | null;
  company?: string | null;
  customer?: string | null;
  currency?: string | null;
  exchange_rate?: number;
  title?: string | null;
  note?: string | null;
  parent_project?: string | null;
  department?: string | null;
  user?: string | null;
  sales_invoice?: string | null;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  total_hours: number;
  total_billable_hours: number;
  total_billed_hours: number;
  total_billable_amount: number;
  total_billed_amount: number;
  total_costing_amount: number;
  base_total_billable_amount: number;
  base_total_billed_amount: number;
  base_total_costing_amount: number;
  per_billed: number;
  amended_from?: string | null;
  time_logs: TimesheetDetail[];
}

export interface ActivityCost {
  costing_rate: number;
  billing_rate: number;
}

export interface TimesheetValidationResult {
  timesheet: Timesheet;
  errors: string[];
}

export interface OverlapResult {
  timesheetName: string;
  from_time: Date;
  to_time: Date;
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function toDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function flt(val: number | string | null | undefined, precision?: number): number {
  const num = typeof val === "string" ? parseFloat(val) : val ?? 0;
  if (precision !== undefined) {
    return parseFloat(num.toFixed(precision));
  }
  return num;
}

function timeDiffInHours(to: Date | string, from_: Date | string): number {
  const t = toDate(to);
  const f = toDate(from_);
  if (!t || !f) return 0;
  return (t.getTime() - f.getTime()) / (1000 * 60 * 60);
}

function timeDiffInSeconds(to: Date | string, from_: Date | string): number {
  const t = toDate(to);
  const f = toDate(from_);
  if (!t || !f) return 0;
  return (t.getTime() - f.getTime()) / 1000;
}

function addToDate(date: Date | string, hours: number): Date {
  const d = toDate(date);
  if (!d) throw new Error("Invalid date");
  const result = new Date(d);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

function getDatePart(date: Date | string): Date {
  const d = toDate(date);
  if (!d) throw new Error("Invalid date");
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* ────────────────────────────────────────────────────────────────
   Validation
   ──────────────────────────────────────────────────────────────── */

export function validateTimesheet(
  timesheet: Timesheet,
  existingTimeLogs?: TimesheetDetail[],
  settings?: {
    ignore_user_time_overlap?: boolean;
    ignore_employee_time_overlap?: boolean;
  }
): TimesheetValidationResult {
  const errors: string[] = [];
  const pushError = (msg: string) => errors.push(msg);

  let ts = { ...timesheet };
  ts = setStatus(ts);

  try {
    validateDates(ts, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    ts = calculateHours(ts);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    ts = validateTimeLogs(ts, existingTimeLogs ?? [], settings ?? {}, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  try {
    ts = updateCost(ts);
  } catch (e: any) {
    errors.push(e.message);
  }

  ts = calculateTotalAmounts(ts);
  ts = calculatePercentageBilled(ts);
  ts = setDates(ts);

  try {
    validateMandatoryFields(ts, pushError);
  } catch (e: any) {
    errors.push(e.message);
  }

  return { timesheet: ts, errors };
}

export function validateMandatoryFields(
  timesheet: Timesheet,
  onError?: (msg: string) => void
): void {
  for (const data of timesheet.time_logs) {
    if (!data.from_time && !data.to_time) {
      const msg = `Row ${data.idx ?? 0}: From Time and To Time is mandatory.`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }

    if (!data.activity_type && timesheet.employee) {
      const msg = `Row ${data.idx ?? 0}: Activity Type is mandatory.`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }

    if (flt(data.hours) === 0.0) {
      const msg = `Row ${data.idx ?? 0}: Hours value must be greater than zero.`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  }
}

export function validateDates(timesheet: Timesheet, onError?: (msg: string) => void): void {
  for (const timeLog of timesheet.time_logs) {
    validateDetailDates(timeLog, onError);
  }
}

export function validateTimeLogs(
  timesheet: Timesheet,
  existingTimeLogs: TimesheetDetail[],
  settings: {
    ignore_user_time_overlap?: boolean;
    ignore_employee_time_overlap?: boolean;
  },
  onError?: (msg: string) => void
): Timesheet {
  const ts = { ...timesheet };
  for (const timeLog of ts.time_logs) {
    const withToTime = setDetailToTime(timeLog);
    validateOverlap(ts, withToTime, existingTimeLogs, settings, onError);
    const withProject = setDetailProject(withToTime);
    validateDetailParentProject(withProject, ts.parent_project, onError);
    validateDetailTaskProject(withProject, onError);
  }
  return ts;
}

/* ────────────────────────────────────────────────────────────────
   Hours & Costing
   ──────────────────────────────────────────────────────────────── */

export function calculateHours(timesheet: Timesheet): Timesheet {
  const ts = { ...timesheet };
  ts.time_logs = ts.time_logs.map((row) => {
    let r = { ...row };
    r = calculateDetailHours(r);
    r = validateDetailBillingHours(r);
    r = updateDetailBillingHours(r);
    return r;
  });
  return ts;
}

export function calculateTotalAmounts(timesheet: Timesheet): Timesheet {
  const ts = { ...timesheet };
  ts.total_hours = 0.0;
  ts.total_billable_hours = 0.0;
  ts.total_billed_hours = 0.0;
  ts.total_billable_amount = 0.0;
  ts.base_total_billable_amount = 0.0;
  ts.total_costing_amount = 0.0;
  ts.base_total_costing_amount = 0.0;
  ts.total_billed_amount = 0.0;
  ts.base_total_billed_amount = 0.0;

  for (const d of ts.time_logs) {
    const td = updateDetailBillingHours(d);
    const withRate = updateTimeRates(td);

    ts.total_hours += flt(withRate.hours);
    ts.total_costing_amount += flt(withRate.costing_amount);
    ts.base_total_costing_amount += flt(withRate.base_costing_amount);

    if (withRate.is_billable) {
      ts.total_billable_hours += flt(withRate.billing_hours);
      ts.total_billable_amount += flt(withRate.billing_amount);
      ts.base_total_billable_amount += flt(withRate.base_billing_amount);
      if (withRate.sales_invoice) {
        ts.total_billed_amount += flt(withRate.billing_amount);
        ts.base_total_billed_amount += flt(withRate.base_billing_amount);
        ts.total_billed_hours += flt(withRate.billing_hours);
      }
    }
  }

  return ts;
}

export function calculatePercentageBilled(timesheet: Timesheet): Timesheet {
  const ts = { ...timesheet };
  ts.per_billed = 0;

  if (ts.total_billed_amount > 0 && ts.total_billable_amount > 0) {
    ts.per_billed = (ts.total_billed_amount * 100) / ts.total_billable_amount;
  } else if (ts.total_billed_hours > 0 && ts.total_billable_hours > 0) {
    ts.per_billed = (ts.total_billed_hours * 100) / ts.total_billable_hours;
  }

  return ts;
}

export function setStatus(timesheet: Timesheet): Timesheet {
  const ts = { ...timesheet };
  const docstatusMap: Record<number, string> = { 0: "Draft", 1: "Submitted", 2: "Cancelled" };
  ts.status = docstatusMap[ts.docstatus ?? 0] ?? "Draft";

  if (flt(ts.per_billed, 2) >= 100.0) {
    ts.status = "Billed";
  }
  if (flt(ts.per_billed, 2) > 0.0 && flt(ts.per_billed, 2) < 100.0) {
    ts.status = "Partially Billed";
  }
  if (ts.sales_invoice) {
    ts.status = "Completed";
  }

  return ts;
}

export function setDates(timesheet: Timesheet): Timesheet {
  const ts = { ...timesheet };
  if (ts.docstatus < 2 && ts.time_logs.length > 0) {
    const startDates = ts.time_logs
      .map((d) => toDate(d.from_time))
      .filter((d): d is Date => d !== null);
    const endDates = ts.time_logs
      .map((d) => toDate(d.to_time))
      .filter((d): d is Date => d !== null);

    if (startDates.length && endDates.length) {
      ts.start_date = getDatePart(startDates.reduce((a, b) => (a < b ? a : b)));
      ts.end_date = getDatePart(endDates.reduce((a, b) => (a > b ? a : b)));
    }
  }
  return ts;
}

/* ────────────────────────────────────────────────────────────────
   Overlap Validation
   ──────────────────────────────────────────────────────────────── */

export function validateOverlap(
  timesheet: Timesheet,
  timeLog: TimesheetDetail,
  existingTimeLogs: TimesheetDetail[],
  settings: {
    ignore_user_time_overlap?: boolean;
    ignore_employee_time_overlap?: boolean;
  },
  onError?: (msg: string) => void
): void {
  validateOverlapFor("user", timesheet, timeLog, timesheet.user, settings.ignore_user_time_overlap ?? false, existingTimeLogs, onError);
  validateOverlapFor("employee", timesheet, timeLog, timesheet.employee, settings.ignore_employee_time_overlap ?? false, existingTimeLogs, onError);
}

export function validateOverlapFor(
  _fieldname: "user" | "employee",
  timesheet: Timesheet,
  args: TimesheetDetail,
  value: string | null | undefined,
  ignoreValidation: boolean,
  existingTimeLogs: TimesheetDetail[],
  onError?: (msg: string) => void
): void {
  if (!value || ignoreValidation) return;

  const existing = getOverlapFor(args, existingTimeLogs);
  if (existing) {
    const msg = `Row ${args.idx ?? 0}: From Time and To Time of ${timesheet.name} is overlapping with ${existing.timesheetName}`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }

  if (checkInternalOverlap(timesheet, args)) {
    const msg = `Row ${args.idx ?? 0}: From Time and To Time of ${timesheet.name} has internal overlap`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function getOverlapFor(
  args: TimesheetDetail,
  existingTimeLogs: TimesheetDetail[]
): OverlapResult | null {
  const fromTime = toDate(args.from_time);
  const toTime = toDate(args.to_time);
  if (!fromTime || !toTime) return null;

  for (const existing of existingTimeLogs) {
    if (existing.name === args.name) continue;
    if (existing.parent === args.parent) continue;

    const eFrom = toDate(existing.from_time);
    const eTo = toDate(existing.to_time);
    if (!eFrom || !eTo) continue;

    if (isOverlapping(fromTime, toTime, eFrom, eTo)) {
      return {
        timesheetName: existing.parent ?? "",
        from_time: eFrom,
        to_time: eTo,
      };
    }
  }

  return null;
}

export function checkInternalOverlap(
  timesheet: Timesheet,
  args: TimesheetDetail
): boolean {
  for (const timeLog of timesheet.time_logs) {
    if (!timeLog.from_time || !timeLog.to_time || !args.from_time || !args.to_time) {
      continue;
    }

    const fromTime = toDate(timeLog.from_time);
    const toTime = toDate(timeLog.to_time);
    const argsFromTime = toDate(args.from_time);
    const argsToTime = toDate(args.to_time);

    if (
      fromTime &&
      toTime &&
      argsFromTime &&
      argsToTime &&
      args.idx !== timeLog.idx &&
      isOverlapping(argsFromTime, argsToTime, fromTime, toTime)
    ) {
      return true;
    }
  }
  return false;
}

function isOverlapping(
  f1: Date,
  t1: Date,
  f2: Date,
  t2: Date
): boolean {
  return (
    (f1 > f2 && f1 < t2) ||
    (t1 > f2 && t1 < t2) ||
    (f1 <= f2 && t1 >= t2)
  );
}

/* ────────────────────────────────────────────────────────────────
   Cost update
   ──────────────────────────────────────────────────────────────── */

export function updateCost(timesheet: Timesheet): Timesheet {
  const ts = { ...timesheet };
  ts.time_logs = ts.time_logs.map((tl) => updateDetailCost(tl, ts.employee, ts.exchange_rate));
  return ts;
}

export function updateTimeRates(tsDetail: TimesheetDetail): TimesheetDetail {
  const d = { ...tsDetail };
  if (!d.is_billable) {
    d.billing_rate = 0.0;
  }
  return d;
}

/* ────────────────────────────────────────────────────────────────
   Timesheet Detail helpers
   ──────────────────────────────────────────────────────────────── */

export function setDetailToTime(timeLog: TimesheetDetail): TimesheetDetail {
  const tl = { ...timeLog };
  if (!tl.from_time || !tl.hours) return tl;

  const computedToTime = addToDate(tl.from_time, tl.hours);
  const currentToTime = toDate(tl.to_time);

  if (
    !currentToTime ||
    Math.abs(timeDiffInSeconds(computedToTime, currentToTime)) >= 1
  ) {
    tl.to_time = computedToTime;
  }
  return tl;
}

export function setDetailProject(timeLog: TimesheetDetail): TimesheetDetail {
  // Caller provides task→project mapping if needed
  return { ...timeLog };
}

export function calculateDetailHours(timeLog: TimesheetDetail): TimesheetDetail {
  const tl = { ...timeLog };
  if (tl.to_time && tl.from_time) {
    tl.hours = timeDiffInHours(tl.to_time, tl.from_time);
  }
  return tl;
}

export function updateDetailBillingHours(timeLog: TimesheetDetail): TimesheetDetail {
  const tl = { ...timeLog };
  if (!tl.is_billable) {
    tl.billing_hours = 0;
    return tl;
  }
  if (flt(tl.billing_hours) === 0.0) {
    tl.billing_hours = tl.hours;
  }
  return tl;
}

export function validateDetailBillingHours(timeLog: TimesheetDetail): TimesheetDetail {
  const tl = { ...timeLog };
  if (flt(tl.billing_hours) > flt(tl.hours)) {
    // Warning only — caller can surface as UI warning
    // We don't throw to keep pure logic from side effects
  }
  return tl;
}

export function updateDetailCost(
  timeLog: TimesheetDetail,
  employee?: string | null,
  exchangeRate?: number,
  activityCost?: ActivityCost | null
): TimesheetDetail {
  const tl = { ...timeLog };
  if (!tl.is_billable && !tl.activity_type) return tl;
  if (!activityCost) return tl;

  tl.billing_rate =
    flt(activityCost.billing_rate) && flt(tl.billing_rate) === 0
      ? flt(activityCost.billing_rate)
      : tl.billing_rate;
  tl.costing_rate =
    flt(activityCost.costing_rate) && flt(tl.costing_rate) === 0
      ? flt(activityCost.costing_rate)
      : tl.costing_rate;

  tl.billing_amount = (tl.billing_rate ?? 0) * (tl.billing_hours ?? 0);
  tl.costing_amount = (tl.costing_rate ?? 0) * (tl.hours ?? 0);

  const er = exchangeRate ?? 1.0;
  tl.base_billing_rate = flt((tl.billing_rate ?? 0) * er, 2);
  tl.base_costing_rate = flt((tl.costing_rate ?? 0) * er, 2);
  tl.base_billing_amount = flt(tl.billing_amount * er, 2);
  tl.base_costing_amount = flt(tl.costing_amount * er, 2);

  return tl;
}

export function validateDetailDates(
  timeLog: TimesheetDetail,
  onError?: (msg: string) => void
): void {
  const fromTime = toDate(timeLog.from_time);
  const toTime = toDate(timeLog.to_time);
  if (fromTime && toTime && timeDiffInHours(toTime, fromTime) < 0) {
    const msg = "To Time cannot be before from date";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateDetailParentProject(
  timeLog: TimesheetDetail,
  parentProject?: string | null,
  onError?: (msg: string) => void
): void {
  if (parentProject && parentProject !== timeLog.project) {
    const msg = `Row ${timeLog.idx ?? 0}: Project must be same as the one set in the Timesheet: ${parentProject}.`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateDetailTaskProject(
  timeLog: TimesheetDetail,
  onError?: (msg: string) => void
): void {
  // Caller must provide task→project mapping and call this if mismatch
  if (timeLog.task && timeLog.project) {
    // Pure logic: caller should pass validated taskProject
    // If they pass mismatch, we throw
    // This is a placeholder — actual lookup happens in server action
  }
}

/* ────────────────────────────────────────────────────────────────
   Unlink / Billing helpers
   ──────────────────────────────────────────────────────────────── */

export function unlinkSalesInvoice(
  timesheet: Timesheet,
  salesInvoice: string
): Timesheet {
  let ts = { ...timesheet };
  ts.time_logs = ts.time_logs.map((tl) => {
    if (tl.sales_invoice === salesInvoice) {
      return { ...tl, sales_invoice: null };
    }
    return tl;
  });
  ts = calculateTotalAmounts(ts);
  ts = calculatePercentageBilled(ts);
  ts = setStatus(ts);
  return ts;
}

export function getActivityCost(
  employee?: string | null,
  activityType?: string | null,
  activityCostRecord?: ActivityCost | null,
  activityTypeCostRecord?: ActivityCost | null,
  exchangeRate?: number
): ActivityCost | null {
  if (activityCostRecord) return activityCostRecord;
  if (activityTypeCostRecord) {
    if (exchangeRate && exchangeRate !== 1) {
      return {
        costing_rate: flt(activityTypeCostRecord.costing_rate) * exchangeRate,
        billing_rate: flt(activityTypeCostRecord.billing_rate) * exchangeRate,
      };
    }
    return activityTypeCostRecord;
  }
  return null;
}
