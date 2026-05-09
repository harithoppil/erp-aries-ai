/**
 * CSV Export Engine — papaparse-powered, TypeScript-safe.
 *
 * Provides two modes:
 *  1. `exportToCSV`  — explicit column config (header label, field path, formatter)
 *  2. `exportListToCSV` — auto-detect columns from first row
 *
 * Both return the CSV string; the client component is responsible for
 * triggering the browser download.
 */

import Papa from 'papaparse';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ColumnConfig {
  /** Header label shown in the CSV. Defaults to `field` if omitted. */
  header?: string;
  /** Dot-path into the row object, e.g. `"customer_name"` or `"address.city"`. */
  field: string;
  /** Optional formatter applied before writing. */
  formatter?: (value: unknown) => string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve a dot-path on an object, returning `undefined` for missing segments. */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = obj;
  for (const seg of segments) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Coerce a value to a CSV-safe string. */
function valueToString(value: unknown, formatter?: (val: unknown) => string): string {
  if (formatter) return formatter(value);
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Export with explicit column configuration.
 *
 * @returns CSV string (with BOM prefix for Excel UTF-8 compatibility).
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: ColumnConfig[],
): string {
  if (!data.length) return '';

  // ── Auto-detect columns when none provided ──
  const cols: ColumnConfig[] =
    columns ?? Object.keys(data[0]).map((key) => ({ field: key }));

  // Build the rows that papaparse will serialize
  const headers = cols.map((c) => c.header ?? c.field);
  const rows: Record<string, string>[] = data.map((row) => {
    const out: Record<string, string> = {};
    for (const col of cols) {
      const key = col.header ?? col.field;
      const raw = resolvePath(row, col.field);
      out[key] = valueToString(raw, col.formatter);
    }
    return out;
  });

  // papaparse handles quoting, escaping, and special characters
  const csv = Papa.unparse(rows, {
    columns: headers,
    header: true,
    // Ensure consistent quoting for fields containing commas / quotes / newlines
    quoteChar: '"',
    escapeChar: '"',
    escapeFormulae: true, // Prevent CSV injection (= + - @ | \t \r \n)
  });

  // BOM for Excel UTF-8 compatibility
  const bom = '﻿';
  const result = bom + csv;

  // Log for debugging (filename is unused by this function but useful for tracing)
  console.log(`[csv-export] Generated ${data.length} rows for "${filename}" (${result.length} bytes)`);

  return result;
}

/**
 * Auto-detect columns from the first row and export.
 *
 * @returns CSV string (with BOM prefix for Excel UTF-8 compatibility).
 */
export function exportListToCSV(
  data: unknown[],
  filename: string,
): string {
  if (!data.length) return '';

  const records = data as Record<string, unknown>[];
  return exportToCSV(records, filename);
}

/**
 * Trigger a CSV file download in the browser.
 *
 * Intended for use in client components after generating the CSV string.
 */
export function downloadCSV(csvString: string, filename: string): void {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
