'use server';

// Bulk import server actions for the four highest-impact masters: Customer,
// Item, Supplier, Account. Accepts CSV or XLSX, validates each row against a
// per-doctype Zod schema, and inserts non-failing rows in a single transaction.

import { z } from 'zod';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { errorMessage } from '@/lib/utils';

// ── Importable doctypes ─────────────────────────────────────────────────────

export type ImportDoctype = 'customer' | 'item' | 'supplier' | 'account';

interface ImporterConfig<T extends z.ZodRawShape> {
  label: string;
  schema: z.ZodObject<T>;
  /** Required CSV/XLSX columns the user must include. */
  requiredColumns: string[];
  /** Optional columns the user can include (for the template generator). */
  optionalColumns: string[];
  /** Build the PK (`name`) from the parsed row. Returns null to use the row's `name` column. */
  derivePk?: (row: z.infer<z.ZodObject<T>>) => string | null;
  /** Insert one validated row into Prisma. */
  insert: (row: z.infer<z.ZodObject<T>>, name: string) => Promise<void>;
}

// Loosened where appropriate — these are import schemas, the database has the
// full constraints. We trust users to provide enough fields to satisfy NOT NULL.

const CustomerSchema = z.object({
  name: z.string().trim().min(1).optional(),
  customer_name: z.string().trim().min(1, 'customer_name is required'),
  customer_type: z.string().optional().default('Individual'),
  customer_group: z.string().optional().default('All Customer Groups'),
  territory: z.string().optional().default('All Territories'),
  email_id: z.string().email().optional().nullable().or(z.literal('')),
  mobile_no: z.string().optional().nullable(),
  tax_id: z.string().optional().nullable(),
});

const ItemSchema = z.object({
  name: z.string().trim().min(1).optional(),
  item_code: z.string().trim().min(1, 'item_code is required'),
  item_name: z.string().trim().min(1, 'item_name is required'),
  item_group: z.string().optional().default('All Item Groups'),
  stock_uom: z.string().optional().default('Nos'),
  description: z.string().optional().nullable(),
  is_stock_item: z.coerce.boolean().optional().default(true),
});

const SupplierSchema = z.object({
  name: z.string().trim().min(1).optional(),
  supplier_name: z.string().trim().min(1, 'supplier_name is required'),
  supplier_type: z.string().optional().default('Company'),
  supplier_group: z.string().optional().default('All Supplier Groups'),
  country: z.string().optional().nullable(),
  email_id: z.string().email().optional().nullable().or(z.literal('')),
  mobile_no: z.string().optional().nullable(),
});

const AccountSchema = z.object({
  name: z.string().trim().min(1).optional(),
  account_name: z.string().trim().min(1, 'account_name is required'),
  parent_account: z.string().trim().min(1, 'parent_account is required'),
  company: z.string().trim().min(1, 'company is required'),
  account_type: z.string().optional().nullable(),
  account_currency: z.string().optional().default('AED'),
  is_group: z.coerce.boolean().optional().default(false),
  root_type: z.string().optional().nullable(),
  report_type: z.string().optional().nullable(),
});

const IMPORTERS: { [K in ImportDoctype]: ImporterConfig<z.ZodRawShape> } = {
  customer: {
    label: 'Customer',
    schema: CustomerSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['customer_name'],
    optionalColumns: ['customer_type', 'customer_group', 'territory', 'email_id', 'mobile_no', 'tax_id'],
    derivePk: (row) => (row.name as string) || (row.customer_name as string),
    insert: async (row, name) => {
      await prisma.customer.create({
        data: {
          name,
          customer_name: row.customer_name as string,
          customer_type: (row.customer_type as string) || 'Individual',
          customer_group: (row.customer_group as string) || 'All Customer Groups',
          territory: (row.territory as string) || 'All Territories',
          email_id: (row.email_id as string) || null,
          mobile_no: (row.mobile_no as string) || null,
          tax_id: (row.tax_id as string) || null,
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    },
  },
  item: {
    label: 'Item',
    schema: ItemSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['item_code', 'item_name'],
    optionalColumns: ['item_group', 'stock_uom', 'description', 'is_stock_item'],
    derivePk: (row) => (row.name as string) || (row.item_code as string),
    insert: async (row, name) => {
      await prisma.item.create({
        data: {
          name,
          item_code: row.item_code as string,
          item_name: row.item_name as string,
          item_group: (row.item_group as string) || 'All Item Groups',
          stock_uom: (row.stock_uom as string) || 'Nos',
          description: (row.description as string) || null,
          is_stock_item: row.is_stock_item as boolean,
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    },
  },
  supplier: {
    label: 'Supplier',
    schema: SupplierSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['supplier_name'],
    optionalColumns: ['supplier_type', 'supplier_group', 'country', 'email_id', 'mobile_no'],
    derivePk: (row) => (row.name as string) || (row.supplier_name as string),
    insert: async (row, name) => {
      await prisma.supplier.create({
        data: {
          name,
          supplier_name: row.supplier_name as string,
          supplier_type: (row.supplier_type as string) || 'Company',
          supplier_group: (row.supplier_group as string) || 'All Supplier Groups',
          country: (row.country as string) || null,
          email_id: (row.email_id as string) || null,
          mobile_no: (row.mobile_no as string) || null,
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    },
  },
  account: {
    label: 'Account (Chart of Accounts)',
    schema: AccountSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['account_name', 'parent_account', 'company'],
    optionalColumns: ['account_type', 'account_currency', 'is_group', 'root_type', 'report_type'],
    derivePk: (row) => (row.name as string) || (row.account_name as string),
    insert: async (row, name) => {
      await prisma.account.create({
        data: {
          name,
          account_name: row.account_name as string,
          parent_account: row.parent_account as string,
          company: row.company as string,
          account_type: (row.account_type as string) || null,
          account_currency: (row.account_currency as string) || 'AED',
          is_group: row.is_group as boolean,
          root_type: (row.root_type as string) || null,
          report_type: (row.report_type as string) || null,
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    },
  },
};

export async function getImportConfig(
  doctype: ImportDoctype,
): Promise<{ label: string; requiredColumns: string[]; optionalColumns: string[] }> {
  const cfg = IMPORTERS[doctype];
  return {
    label: cfg.label,
    requiredColumns: cfg.requiredColumns,
    optionalColumns: cfg.optionalColumns,
  };
}

// ── File parsing ────────────────────────────────────────────────────────────

async function readUpload(file: File): Promise<Record<string, unknown>[]> {
  const lower = file.name.toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (lower.endsWith('.csv') || file.type === 'text/csv') {
    return parseCsv(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, unknown>[];
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const workbook = new ExcelJS.Workbook();
    // ExcelJS types want a stricter Buffer; ArrayBuffer is also accepted at runtime.
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Empty workbook');
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, col) => {
      headers[col - 1] = String(cell.value ?? '').trim();
    });
    const rows: Record<string, unknown>[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
      if (rowNum === 1) return;
      const obj: Record<string, unknown> = {};
      row.eachCell((cell, col) => {
        const key = headers[col - 1];
        if (!key) return;
        const v = cell.value;
        // Coerce Excel rich text / formula cells to plain strings
        if (v && typeof v === 'object' && 'text' in v) {
          obj[key] = (v as { text: string }).text;
        } else if (v && typeof v === 'object' && 'result' in v) {
          obj[key] = (v as { result: unknown }).result;
        } else {
          obj[key] = v;
        }
      });
      rows.push(obj);
    });
    return rows;
  }

  throw new Error('Unsupported file type. Use .csv or .xlsx.');
}

// ── Import action ───────────────────────────────────────────────────────────

export interface ImportRowError {
  rowIndex: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  doctype: ImportDoctype;
  total: number;
  inserted: number;
  failed: number;
  errors: ImportRowError[];
  message?: string;
}

export async function importDoctypeFile(
  doctype: ImportDoctype,
  formData: FormData,
): Promise<ImportResult> {
  const cfg = IMPORTERS[doctype];
  if (!cfg) {
    return {
      success: false,
      doctype,
      total: 0,
      inserted: 0,
      failed: 0,
      errors: [],
      message: `Unsupported doctype: ${doctype}`,
    };
  }

  let rows: Record<string, unknown>[];
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) throw new Error('No file uploaded');
    rows = await readUpload(file);
  } catch (err) {
    return {
      success: false,
      doctype,
      total: 0,
      inserted: 0,
      failed: 0,
      errors: [],
      message: errorMessage(err, 'Failed to read upload'),
    };
  }

  // Validate all rows up-front; only insert the ones that parse cleanly.
  const validated: { row: z.infer<typeof cfg.schema>; pk: string; rowIndex: number }[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((raw, i) => {
    const result = cfg.schema.safeParse(raw);
    if (!result.success) {
      errors.push({
        rowIndex: i + 2, // header is row 1, first data row is 2
        message: result.error.issues
          .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
          .join('; '),
      });
      return;
    }
    const pk = (cfg.derivePk?.(result.data) ?? '').trim();
    if (!pk) {
      errors.push({
        rowIndex: i + 2,
        message: 'Could not derive a unique name (PK) for this row',
      });
      return;
    }
    validated.push({ row: result.data, pk, rowIndex: i + 2 });
  });

  // Insert in a single transaction so partial failures don't leave the DB
  // half-updated. Rows that failed schema validation are skipped — they're
  // reported in `errors` and never reach Prisma.
  let inserted = 0;
  try {
    await prisma.$transaction(async () => {
      for (const v of validated) {
        try {
          await cfg.insert(v.row, v.pk);
          inserted++;
        } catch (err) {
          errors.push({ rowIndex: v.rowIndex, message: errorMessage(err) });
        }
      }
    });
  } catch (err) {
    return {
      success: false,
      doctype,
      total: rows.length,
      inserted: 0,
      failed: rows.length,
      errors: [...errors, { rowIndex: 0, message: errorMessage(err, 'Transaction failed') }],
      message: 'Transaction rolled back — no rows imported',
    };
  }

  return {
    success: inserted > 0,
    doctype,
    total: rows.length,
    inserted,
    failed: errors.length,
    errors,
  };
}

// ── Template generator ──────────────────────────────────────────────────────

export async function getImportTemplate(
  doctype: ImportDoctype,
): Promise<{ filename: string; csv: string }> {
  const cfg = IMPORTERS[doctype];
  if (!cfg) throw new Error(`Unsupported doctype: ${doctype}`);
  const headers = [...cfg.requiredColumns, ...cfg.optionalColumns];
  const csv = headers.join(',') + '\n';
  return { filename: `${doctype}-import-template.csv`, csv };
}
