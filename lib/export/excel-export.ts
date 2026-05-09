/**
 * Excel Export Engine — exceljs-powered, TypeScript-safe.
 *
 * Provides:
 *  1. `exportToExcel`  — single-sheet export with styled headers & auto-filter
 *  2. `createWorkbook` — multi-sheet export
 *
 * Both return a Node.js Buffer; the caller is responsible for sending
 * it to the client (e.g. via a server action / API route).
 */

import ExcelJS from 'exceljs';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ExcelExportOptions {
  /** Sheet name — defaults to "Sheet1". */
  sheetName?: string;
  /** Apply bold + gray background + auto-filter to the header row. Default: true. */
  styleHeaders?: boolean;
  /** Auto-size column widths based on content. Default: true. */
  autoSizeColumns?: boolean;
  /** Freeze the header row. Default: true. */
  freezeHeader?: boolean;
  /** Explicit column widths (overrides auto-size when provided). */
  columnWidths?: Record<string, number>;
  /** Optional column configs for label mapping and formatting. */
  columns?: ExcelColumnConfig[];
}

export interface ExcelColumnConfig {
  /** Header label. Defaults to `field` if omitted. */
  header?: string;
  /** Field path in the row object. */
  field: string;
  /** Width override. */
  width?: number;
  /** Optional formatter applied before writing. */
  formatter?: (value: unknown) => string | number;
}

export interface SheetData {
  /** Sheet name. */
  name: string;
  /** Row data. */
  data: Record<string, unknown>[];
  /** Per-sheet column config. */
  columns?: ExcelColumnConfig[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Resolve a dot-path on an object. */
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

/** Coerce a value for Excel cell insertion. */
function toCellValue(value: unknown, formatter?: (val: unknown) => string | number): string | number | Date | null {
  if (formatter) return formatter(value);
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** Compute the maximum content length per column for auto-sizing. */
function computeColumnWidths(
  worksheet: ExcelJS.Worksheet,
  columns: ExcelColumnConfig[],
  data: Record<string, unknown>[],
  minWidth: number,
  maxWidth: number,
): Record<string, number> {
  const widths: Record<string, number> = {};

  // Start with header label lengths
  for (const col of columns) {
    const key = col.header ?? col.field;
    widths[col.field] = Math.max(minWidth, key.length + 2);
  }

  // Expand based on content
  for (const row of data) {
    for (const col of columns) {
      const raw = resolvePath(row, col.field);
      const cellVal = toCellValue(raw, col.formatter);
      const len = String(cellVal).length + 2;
      widths[col.field] = Math.max(widths[col.field] ?? minWidth, Math.min(len, maxWidth));
    }
  }

  return widths;
}

/** Style the header row: bold, gray background, borders. */
function styleHeaderRow(worksheet: ExcelJS.Worksheet): void {
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF1F2937' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF3F4F6' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  headerRow.height = 28;
}

/** Write a single worksheet. */
function populateSheet(
  worksheet: ExcelJS.Worksheet,
  data: Record<string, unknown>[],
  options: ExcelExportOptions,
): void {
  const styleHeaders = options.styleHeaders ?? true;
  const autoSize = options.autoSizeColumns ?? true;
  const freezeHeader = options.freezeHeader ?? true;

  // Determine columns
  const cols: ExcelColumnConfig[] =
    options.columns ?? Object.keys(data[0] ?? {}).map((key) => ({ field: key }));

  // Add columns to worksheet
  worksheet.columns = cols.map((col) => ({
    header: col.header ?? col.field,
    key: col.field,
    width: col.width ?? undefined,
  }));

  // Add rows
  for (const row of data) {
    const rowData: Record<string, string | number | Date | null> = {};
    for (const col of cols) {
      const raw = resolvePath(row, col.field);
      rowData[col.field] = toCellValue(raw, col.formatter);
    }
    worksheet.addRow(rowData);
  }

  // Style headers
  if (styleHeaders) {
    styleHeaderRow(worksheet);
  }

  // Auto-filter on all columns
  if (data.length > 0) {
    const lastColLetter = String.fromCharCode(64 + cols.length);
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: data.length + 1, column: cols.length },
    };
  }

  // Freeze header row
  if (freezeHeader) {
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // Auto-size columns
  if (autoSize && data.length > 0) {
    const widths = computeColumnWidths(worksheet, cols, data, 12, 50);

    // Apply explicit columnWidths overrides
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      const explicit = options.columnWidths?.[col.header ?? col.field];
      const colWidth = col.width;
      if (explicit) {
        worksheet.getColumn(i + 1).width = explicit;
      } else if (colWidth) {
        worksheet.getColumn(i + 1).width = colWidth;
      } else {
        worksheet.getColumn(i + 1).width = widths[col.field] ?? 15;
      }
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Export data to a single-sheet Excel workbook.
 *
 * @returns Buffer containing the .xlsx file.
 */
export async function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  options?: ExcelExportOptions,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aries ERP';
  workbook.created = new Date();

  const sheetName = options?.sheetName ?? 'Sheet1';
  const worksheet = workbook.addWorksheet(sheetName);

  populateSheet(worksheet, data, options ?? {});

  const buffer = await workbook.xlsx.writeBuffer();
  const nodeBuffer = Buffer.from(buffer);

  console.log(`[excel-export] Generated ${data.length} rows for "${filename}" (${nodeBuffer.length} bytes)`);

  return nodeBuffer;
}

/**
 * Create a multi-sheet Excel workbook.
 *
 * @returns Buffer containing the .xlsx file.
 */
export async function createWorkbook(
  sheets: SheetData[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Aries ERP';
  workbook.created = new Date();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    populateSheet(worksheet, sheet.data, {
      columns: sheet.columns,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
