/**
 * Ported from erpnext/accounts/doctype/fiscal_year/fiscal_year.py
 * Pure business logic for Fiscal Year DocType.
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: number | string | boolean | undefined): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  const v = typeof value === "string" ? parseInt(value, 10) : value ?? 0;
  return Number.isNaN(v) ? 0 : v;
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function formatDateISO(date: Date): string {
  return date.toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FiscalYearCompany {
  company: string;
}

export interface FiscalYearDoc {
  name?: string;
  year: string;
  year_start_date: string;
  year_end_date: string;
  disabled?: number;
  is_short_year?: number;
  auto_created?: number;
  companies: FiscalYearCompany[];
}

export interface FiscalYearLookup {
  name: string;
  year: string;
  year_start_date: string;
  year_end_date: string;
  is_short_year?: number;
  companies?: FiscalYearCompany[];
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface DateRangeResult {
  from_date: string;
  to_date: string;
}

/* ------------------------------------------------------------------ */
/*  validateFiscalYear                                                 */
/* ------------------------------------------------------------------ */

export function validateFiscalYear(
  doc: FiscalYearDoc,
  existingFiscalYears?: FiscalYearLookup[]
): ValidationResult {
  const warnings: string[] = [];

  const datesErr = validateDates(doc);
  if (datesErr) return { success: false, error: datesErr };

  if (existingFiscalYears) {
    const overlapErr = validateOverlap(doc, existingFiscalYears);
    if (overlapErr) return { success: false, error: overlapErr };
  }

  return { success: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  validateDates                                                      */
/* ------------------------------------------------------------------ */

export function validateDates(doc: FiscalYearDoc): string | undefined {
  const startDate = getdate(doc.year_start_date);
  const endDate = getdate(doc.year_end_date);

  if (endDate < startDate) {
    return "Year End Date should be after Year Start Date";
  }

  if (doc.is_short_year) {
    return undefined;
  }

  const expectedEnd = addDays(addYears(startDate, 1), -1);
  if (formatDateISO(endDate) !== formatDateISO(expectedEnd)) {
    return "Fiscal Year End Date should be one year after Fiscal Year Start Date";
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateOverlap                                                    */
/* ------------------------------------------------------------------ */

export function validateOverlap(
  doc: FiscalYearDoc,
  existingFiscalYears: FiscalYearLookup[]
): string | undefined {
  const name = doc.name || doc.year;
  const startDate = getdate(doc.year_start_date);
  const endDate = getdate(doc.year_end_date);

  const docCompanies = new Set(doc.companies.map((c) => c.company));

  for (const existing of existingFiscalYears) {
    if (existing.name === name) continue;

    const existingStart = getdate(existing.year_start_date);
    const existingEnd = getdate(existing.year_end_date);

    // Check date overlap
    if (endDate < existingStart || startDate > existingEnd) {
      continue;
    }

    // Check company overlap
    let overlap = false;
    const existingCompanies = new Set((existing.companies || []).map((c) => c.company));

    if (doc.companies.length === 0 && existingCompanies.size === 0) {
      overlap = true;
    } else {
      for (const company of Array.from(docCompanies)) {
        if (existingCompanies.has(company)) {
          overlap = true;
          break;
        }
      }
    }

    if (overlap) {
      return `Year start date or end date is overlapping with ${existing.name}. To avoid please set company`;
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  autoCreateFiscalYear                                               */
/* ------------------------------------------------------------------ */

export function autoCreateFiscalYear(
  currentFiscalYear: FiscalYearDoc
): FiscalYearDoc | undefined {
  if (cint(currentFiscalYear.is_short_year)) {
    return undefined;
  }

  const newStartDate = addDays(getdate(currentFiscalYear.year_end_date), 1);
  const newEndDate = addYears(getdate(currentFiscalYear.year_end_date), 1);

  const startYear = String(newStartDate.getFullYear());
  const endYear = String(newEndDate.getFullYear());
  const yearName = startYear === endYear ? startYear : `${startYear}-${endYear}`;

  return {
    year: yearName,
    year_start_date: formatDateISO(newStartDate),
    year_end_date: formatDateISO(newEndDate),
    disabled: currentFiscalYear.disabled,
    auto_created: 1,
    companies: currentFiscalYear.companies.map((c) => ({ company: c.company })),
  };
}

/* ------------------------------------------------------------------ */
/*  getFromAndToDate                                                   */
/* ------------------------------------------------------------------ */

export function getFromAndToDate(fiscalYear: FiscalYearDoc): DateRangeResult {
  return {
    from_date: fiscalYear.year_start_date,
    to_date: fiscalYear.year_end_date,
  };
}

/* ------------------------------------------------------------------ */
/*  isDateInFiscalYear                                                 */
/* ------------------------------------------------------------------ */

export function isDateInFiscalYear(dateStr: string, fiscalYear: FiscalYearDoc): boolean {
  const date = getdate(dateStr);
  const start = getdate(fiscalYear.year_start_date);
  const end = getdate(fiscalYear.year_end_date);
  return date >= start && date <= end;
}

/* ------------------------------------------------------------------ */
/*  getFiscalYearForDate                                               */
/* ------------------------------------------------------------------ */

export function getFiscalYearForDate(
  dateStr: string,
  fiscalYears: FiscalYearLookup[],
  company?: string
): FiscalYearLookup | undefined {
  const date = getdate(dateStr);

  for (const fy of fiscalYears) {
    const start = getdate(fy.year_start_date);
    const end = getdate(fy.year_end_date);

    if (date >= start && date <= end) {
      if (company) {
        const fyCompanies = new Set((fy.companies || []).map((c) => c.company));
        if (fyCompanies.size > 0 && !fyCompanies.has(company)) {
          continue;
        }
      }
      return fy;
    }
  }

  return undefined;
}
