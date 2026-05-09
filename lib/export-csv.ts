/**
 * Legacy CSV export — backward-compatible wrapper around the new export engine.
 *
 * @deprecated Import from `@/lib/export/csv-export` instead.
 */

import { exportToCSV as _exportToCSV, downloadCSV } from '@/lib/export/csv-export';

/**
 * Export data to CSV and trigger a browser download.
 *
 * @deprecated Use `ExportButton` component or `exportToCSV` + `downloadCSV` from `@/lib/export/csv-export`.
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  const csv = _exportToCSV(data, filename);
  if (csv) {
    downloadCSV(csv, filename);
  }
}
