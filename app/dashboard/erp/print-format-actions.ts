'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

export interface PrintFormatOption {
  name: string;
  doc_type: string;
  print_format_type: string;
  standard: string;
  custom_format: boolean;
  disabled: boolean;
}

export interface PrintFormatData {
  format: PrintFormatOption & {
    html: string | null;
    format_data: string | null;
    css: string | null;
  };
  record: Record<string, unknown>;
  childTables: Record<string, Record<string, unknown>[]>;
}

export interface PrintFormatsResult {
  success: true;
  formats: PrintFormatOption[];
}
export interface PrintFormatsError {
  success: false;
  error: string;
}
export type FetchPrintFormatsResult = PrintFormatsResult | PrintFormatsError;

export interface PrintFormatResult {
  success: true;
  data: PrintFormatData;
}
export interface PrintFormatError {
  success: false;
  error: string;
}
export type FetchPrintFormatResult = PrintFormatResult | PrintFormatError;

export async function fetchPrintFormats(doctype: string): Promise<FetchPrintFormatsResult> {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT name, doc_type, print_format_type, standard, custom_format, disabled
       FROM print_format
       WHERE doc_type = $1 AND disabled = false
       ORDER BY standard = 'Yes' DESC, name`,
      doctype,
    ) as PrintFormatOption[];
    return { success: true, formats: rows };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchPrintFormats]', msg);
    return { success: false, error: 'Failed to load print formats' };
  }
}

export async function fetchPrintFormatData(
  doctype: string,
  recordName: string,
  formatName: string,
): Promise<FetchPrintFormatResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    // Fetch the record
    const record = await delegate.findUnique({
      where: { name: recordName },
    }) as Record<string, unknown> | null;

    if (!record) {
      return { success: false, error: 'Record not found' };
    }

    // Fetch child table data
    const childTables: Record<string, Record<string, unknown>[]> = {};
    if (record.items && Array.isArray(record.items)) {
      childTables.items = record.items as Record<string, unknown>[];
    }
    if (record.taxes && Array.isArray(record.taxes)) {
      childTables.taxes = record.taxes as Record<string, unknown>[];
    }
    if (record.accounts && Array.isArray(record.accounts)) {
      childTables.accounts = record.accounts as Record<string, unknown>[];
    }

    // Fetch the print format template
    const formatRows = await prisma.$queryRawUnsafe(
      `SELECT name, doc_type, print_format_type, standard, custom_format, disabled,
              html, format_data, css
       FROM print_format
       WHERE name = $1 AND doc_type = $2 AND disabled = false
       LIMIT 1`,
      formatName,
      doctype,
    ) as Array<PrintFormatOption & { html: string | null; format_data: string | null; css: string | null }>;

    if (formatRows.length === 0) {
      return { success: false, error: `Print format "${formatName}" not found` };
    }

    return {
      success: true,
      data: {
        format: formatRows[0],
        record,
        childTables,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchPrintFormatData]', msg);
    return { success: false, error: 'Failed to load print format' };
  }
}

/**
 * Render a Jinja-like template with record data.
 * Converts {{ doc.field }} → record field value
 * Converts {% for item in doc.items %} → loops over child table
 * Strips frappe.* helper calls, replaces with plain values
 * Handles {% if condition %} blocks (simple field checks)
 */
export function renderJinjaTemplate(
  template: string,
  record: Record<string, unknown>,
  childTables: Record<string, Record<string, unknown>[]>,
): string {
  let html = template;

  // Replace {{ doc.field }} with record values
  html = html.replace(/\{\{\s*doc\.(\w+)\s*\}\}/g, (_, field) => {
    const val = record[field];
    if (val === null || val === undefined) return '';
    return String(val);
  });

  // Replace {{ doc.get_formatted("field") }} with plain value
  html = html.replace(/\{\{\s*doc\.get_formatted\(\s*["'](\w+)["']\s*(?:,\s*doc\s*)?\)\s*\}\}/g, (_, field) => {
    const val = record[field];
    if (val === null || val === undefined) return '';
    return String(val);
  });

  // Replace {{ item.field }} in loops — will be handled by loop expansion below
  // Replace {{ item.get_formatted("field", doc) }}
  html = html.replace(/\{\{\s*item\.get_formatted\(\s*["'](\w+)["']\s*(?:,\s*doc\s*)?\)\s*\}\}/g, '{{ item.$1 }}');

  // Replace {{ tax.get_formatted("field") }}
  html = html.replace(/\{\{\s*tax\.get_formatted\(\s*["'](\w+)["']\s*\)\s*\}\}/g, '{{ tax.$1 }}');

  // Replace frappe.utils.format_date(doc.field) with plain value
  html = html.replace(/\{\{\s*frappe\.utils\.format_date\(doc\.(\w+)\)\s*\}\}/g, (_, field) => {
    const val = record[field];
    if (val === null || val === undefined) return '';
    // Format ISO date to readable
    try {
      const d = new Date(String(val));
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return String(val);
    }
  });

  // Replace {{ _("text") }} with just the text (no i18n)
  html = html.replace(/\{\{\s*_\(["']([^"']+)["']\)\s*\}\}/g, '$1');

  // Replace {{ loop.index }} with placeholder (handled in loop expansion)
  // Keep as-is, handled below

  // Handle {% for item in doc.items %} loops
  html = expandForLoops(html, record, childTables);

  // Handle simple {% if doc.field %} conditionals
  html = html.replace(/\{%\s*if\s+doc\.(\w+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (_, field, body) => {
    const val = record[field];
    if (val && val !== '' && val !== 0 && val !== false) {
      return body;
    }
    return '';
  });

  // Handle {% if field %} within loops (already expanded)
  html = html.replace(/\{%\s*if\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (_, field, body) => {
    return body; // After loop expansion, just include the body
  });

  // Strip remaining frappe.db.get_value and frappe.db.get_single_value calls
  html = html.replace(/\{%\s*set\s+\w+\s*=\s*frappe\.db\.\w+\([^)]*\)\s*%\}/g, '');
  html = html.replace(/\{\{-?\s*frappe\.[^}]+\}\}/g, '');

  // Strip {% if doc.meta.is_submittable %} blocks (just include them)
  html = html.replace(/\{%\s*if\s+doc\.meta\.\w+[^%]*%\}([\s\S]*?)\{%\s*endif\s*%\}/g, '$1');

  // Strip Jinja macros that we can't render
  html = html.replace(/\{%-?\s*macro\s+[\s\S]*?\{%-?\s*endmacro\s*-?\%\}/g, '');

  // Remove remaining unhandled Jinja tags
  html = html.replace(/\{%-?\s*endfor\s*-?\%\}/g, '');
  html = html.replace(/\{%-?\s*else\s*-?\%\}/g, '');
  html = html.replace(/\{%[\s\S]*?%\}/g, ''); // strip any remaining Jinja tags
  html = html.replace(/\{\{[\s\S]*?\}\}/g, ''); // strip any remaining expressions

  // Clean up empty lines
  html = html.replace(/\n\s*\n\s*\n/g, '\n\n');

  return html;
}

function expandForLoops(
  html: string,
  record: Record<string, unknown>,
  childTables: Record<string, Record<string, unknown>[]>,
): string {
  // Match {% for item in doc.items %} ... {% endfor %}
  const forRegex = /\{%\s*for\s+(\w+)\s+in\s+doc\.(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g;

  return html.replace(forRegex, (_, loopVar, tableName, body) => {
    const rows = childTables[tableName] || [];
    if (rows.length === 0) return '';

    return rows.map((row, index) => {
      let rowHtml = body;
      // Replace {{ loop.index }} with 1-based index
      rowHtml = rowHtml.replace(/\{\{\s*loop\.index\s*\}\}/g, String(index + 1));
      // Replace {{ item.field }} with row values
      rowHtml = rowHtml.replace(new RegExp(`\\{\\{\\s*${loopVar}\\.(\\w+)\\s*\\}\\}`, 'g'), (_match: string, field: string) => {
        const val = row[field];
        if (val === null || val === undefined) return '';
        return String(val);
      });
      return rowHtml;
    }).join('\n');
  });
}
