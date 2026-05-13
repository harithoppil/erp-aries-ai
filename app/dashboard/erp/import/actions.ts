'use server';

// Bulk import server actions. Supports:
// 1. Four enhanced importers (Customer, Item, Supplier, Account) with Zod schemas
// 2. ANY DocType via Prisma DMMF metadata-driven import (required/optional fields auto-discovered)
// 3. Preview/validate step before committing

import { z } from 'zod';
import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { errorMessage } from '@/lib/utils';
import { getDelegate, toAccessor, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { Prisma } from '@/prisma/client';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ImportFieldInfo {
  fieldname: string;
  label: string;
  type: string;
  required: boolean;
  hasDefault: boolean;
}

export interface ImportableDocType {
  name: string;
  label: string;
  category: 'enhanced' | 'generic';
  requiredFields: ImportFieldInfo[];
  optionalFields: ImportFieldInfo[];
}

export interface ImportRowError {
  rowIndex: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  doctype: string;
  total: number;
  inserted: number;
  failed: number;
  errors: ImportRowError[];
  message?: string;
}

export interface PreviewResult {
  doctype: string;
  total: number;
  valid: number;
  failed: number;
  errors: ImportRowError[];
  previewRows: Record<string, unknown>[];
  requiredFields: string[];
  optionalFields: string[];
}

// ── Enhanced importers (4 DocTypes with Zod schemas) ─────────────────────────

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

interface EnhancedImporterConfig {
  label: string;
  schema: z.ZodObject<z.ZodRawShape>;
  requiredColumns: string[];
  optionalColumns: string[];
  derivePk: (row: Record<string, unknown>) => string | null;
  buildCreateData: (row: Record<string, unknown>, name: string) => Record<string, unknown>;
  accessor: string;
}

const ENHANCED_IMPORTERS: Record<string, EnhancedImporterConfig> = {
  Customer: {
    label: 'Customer',
    schema: CustomerSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['customer_name'],
    optionalColumns: ['customer_type', 'customer_group', 'territory', 'email_id', 'mobile_no', 'tax_id'],
    derivePk: (row) => (row.name as string) || (row.customer_name as string) || null,
    accessor: 'customer',
    buildCreateData: (row, name) => ({
      name,
      customer_name: row.customer_name as string,
      customer_type: (row.customer_type as string) || 'Individual',
      customer_group: (row.customer_group as string) || 'All Customer Groups',
      territory: (row.territory as string) || 'All Territories',
      email_id: (row.email_id as string) || null,
      mobile_no: (row.mobile_no as string) || null,
      tax_id: (row.tax_id as string) || null,
      default_commission_rate: 0,
      disabled: false,
      owner: 'Administrator',
      modified_by: 'Administrator',
    }),
  },
  Item: {
    label: 'Item',
    schema: ItemSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['item_code', 'item_name'],
    optionalColumns: ['item_group', 'stock_uom', 'description', 'is_stock_item'],
    derivePk: (row) => (row.name as string) || (row.item_code as string) || null,
    accessor: 'item',
    buildCreateData: (row, name) => ({
      name,
      item_code: row.item_code as string,
      item_name: row.item_name as string,
      item_group: (row.item_group as string) || 'All Item Groups',
      stock_uom: (row.stock_uom as string) || 'Nos',
      description: (row.description as string) || null,
      is_stock_item: row.is_stock_item as boolean,
      opening_stock: 0,
      valuation_rate: 0,
      standard_rate: 0,
      shelf_life_in_days: 0,
      end_of_life: new Date('2099-12-31'),
      warranty_period: '0',
      weight_per_unit: 0,
      weight_uom: '',
      min_order_qty: 0,
      safety_stock: 0,
      lead_time_days: 0,
      sample_quantity: 0,
      last_purchase_rate: 0,
      max_discount: 0,
      no_of_months: 0,
      no_of_months_exp: 0,
      total_projected_qty: 0,
      over_delivery_receipt_allowance: 0,
      over_billing_allowance: 0,
      production_capacity: 0,
      is_fixed_asset: false,
      is_sales_item: true,
      is_purchase_item: true,
      disabled: false,
      owner: 'Administrator',
      modified_by: 'Administrator',
    }),
  },
  Supplier: {
    label: 'Supplier',
    schema: SupplierSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['supplier_name'],
    optionalColumns: ['supplier_type', 'supplier_group', 'country', 'email_id', 'mobile_no'],
    derivePk: (row) => (row.name as string) || (row.supplier_name as string) || null,
    accessor: 'supplier',
    buildCreateData: (row, name) => ({
      name,
      supplier_name: row.supplier_name as string,
      supplier_type: (row.supplier_type as string) || 'Company',
      supplier_group: (row.supplier_group as string) || 'All Supplier Groups',
      country: (row.country as string) || null,
      email_id: (row.email_id as string) || null,
      mobile_no: (row.mobile_no as string) || null,
      owner: 'Administrator',
      modified_by: 'Administrator',
    }),
  },
  Account: {
    label: 'Account (Chart of Accounts)',
    schema: AccountSchema as unknown as z.ZodObject<z.ZodRawShape>,
    requiredColumns: ['account_name', 'parent_account', 'company'],
    optionalColumns: ['account_type', 'account_currency', 'is_group', 'root_type', 'report_type'],
    derivePk: (row) => (row.name as string) || (row.account_name as string) || null,
    accessor: 'account',
    buildCreateData: (row, name) => ({
      name,
      account_name: row.account_name as string,
      parent_account: row.parent_account as string,
      company: row.company as string,
      account_type: (row.account_type as string) || null,
      account_currency: (row.account_currency as string) || 'AED',
      is_group: row.is_group as boolean,
      root_type: (row.root_type as string) || null,
      report_type: (row.report_type as string) || null,
      tax_rate: 0,
      lft: 0,
      rgt: 0,
      owner: 'Administrator',
      modified_by: 'Administrator',
    }),
  },
};

// ── Discover importable DocTypes ─────────────────────────────────────────────

function getModelFields(modelName: string) {
  const models = Prisma.dmmf.datamodel.models;
  const model = models.find(
    (m) => m.name === modelName || m.name === modelName.charAt(0).toLowerCase() + modelName.slice(1),
  );
  if (!model) return null;
  return model;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSchemaFieldsForModel(model: { fields: readonly any[] }): {
  required: ImportFieldInfo[];
  optional: ImportFieldInfo[];
} {
  const required: ImportFieldInfo[] = [];
  const optional: ImportFieldInfo[] = [];

  for (const f of model.fields) {
    // Skip relation fields, list fields, id fields, generated fields
    if (f.kind === 'object' || f.isList || f.isId || f.isGenerated) continue;

    const info: ImportFieldInfo = {
      fieldname: f.name,
      label: f.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      type: f.type,
      required: f.isRequired && !f.hasDefaultValue,
      hasDefault: f.hasDefaultValue,
    };

    if (info.required) {
      required.push(info);
    } else {
      optional.push(info);
    }
  }

  return { required, optional };
}

export async function listImportableDocTypes(): Promise<ImportableDocType[]> {
  const results: ImportableDocType[] = [];

  // Add enhanced importers first
  for (const [name, cfg] of Object.entries(ENHANCED_IMPORTERS)) {
    results.push({
      name,
      label: cfg.label,
      category: 'enhanced',
      requiredFields: cfg.requiredColumns.map((c) => ({
        fieldname: c,
        label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        type: 'string',
        required: true,
        hasDefault: false,
      })),
      optionalFields: cfg.optionalColumns.map((c) => ({
        fieldname: c,
        label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        type: 'string',
        required: false,
        hasDefault: false,
      })),
    });
  }

  // Add generic DocTypes from Prisma schema
  const models = Prisma.dmmf.datamodel.models;
  for (const model of models) {
    // Skip enhanced importers (already added above)
    if (model.name in ENHANCED_IMPORTERS) continue;
    // Skip internal/system models
    if (model.name.startsWith('_') || model.name.startsWith('__')) continue;
    // Skip workflow models (not user-importable)
    if (['Workflow', 'WorkflowDocumentState', 'WorkflowTransitionRule', 'WorkflowAction'].includes(model.name)) continue;

    const delegate = getDelegate(prisma, model.name);
    if (!delegate) continue;

    const { required, optional } = getSchemaFieldsForModel(model);

    // Only include if there are importable fields
    if (required.length === 0 && optional.length === 0) continue;

    results.push({
      name: model.name,
      label: toDisplayLabel(model.name),
      category: 'generic',
      requiredFields: required,
      optionalFields: optional,
    });
  }

  return results;
}

export async function getDocTypeImportMeta(doctype: string): Promise<ImportableDocType | null> {
  // Check enhanced importers first
  const enhanced = ENHANCED_IMPORTERS[doctype];
  if (enhanced) {
    return {
      name: doctype,
      label: enhanced.label,
      category: 'enhanced',
      requiredFields: enhanced.requiredColumns.map((c) => ({
        fieldname: c,
        label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        type: 'string',
        required: true,
        hasDefault: false,
      })),
      optionalFields: enhanced.optionalColumns.map((c) => ({
        fieldname: c,
        label: c.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        type: 'string',
        required: false,
        hasDefault: false,
      })),
    };
  }

  // Generic: use DMMF
  const model = getModelFields(doctype);
  if (!model) return null;

  const { required, optional } = getSchemaFieldsForModel(model);
  return {
    name: doctype,
    label: toDisplayLabel(doctype),
    category: 'generic',
    requiredFields: required,
    optionalFields: optional,
  };
}

// ── File parsing ─────────────────────────────────────────────────────────────

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

// ── Type coercion for generic import ─────────────────────────────────────────

function coerceValue(value: unknown, fieldType: string): unknown {
  if (value === null || value === undefined || value === '') return null;

  const str = String(value).trim();
  if (str === '') return null;

  switch (fieldType) {
    case 'Int':
    case 'BigInt': {
      const n = Number(str);
      return Number.isFinite(n) ? Math.round(n) : null;
    }
    case 'Float':
    case 'Decimal': {
      const f = Number(str);
      return Number.isFinite(f) ? f : null;
    }
    case 'Boolean': {
      const lower = str.toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(lower)) return true;
      if (['false', '0', 'no', 'n'].includes(lower)) return false;
      return null;
    }
    case 'DateTime': {
      const d = new Date(str);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    default:
      return str;
  }
}

// ── Preview (validate without committing) ────────────────────────────────────

export async function previewImport(
  doctype: string,
  formData: FormData,
): Promise<PreviewResult> {
  const meta = await getDocTypeImportMeta(doctype);
  if (!meta) {
    return {
      doctype,
      total: 0,
      valid: 0,
      failed: 0,
      errors: [{ rowIndex: 0, message: `Unknown DocType: ${doctype}` }],
      previewRows: [],
      requiredFields: [],
      optionalFields: [],
    };
  }

  let rows: Record<string, unknown>[];
  try {
    const file = formData.get('file');
    if (!(file instanceof File)) throw new Error('No file uploaded');
    rows = await readUpload(file);
  } catch (err) {
    return {
      doctype,
      total: 0,
      valid: 0,
      failed: 0,
      errors: [{ rowIndex: 0, message: errorMessage(err, 'Failed to read upload') }],
      previewRows: [],
      requiredFields: meta.requiredFields.map((f) => f.fieldname),
      optionalFields: meta.optionalFields.map((f) => f.fieldname),
    };
  }

  const requiredNames = meta.requiredFields.map((f) => f.fieldname);
  const allFieldNames = new Set([
    ...requiredNames,
    ...meta.optionalFields.map((f) => f.fieldname),
  ]);

  // Build a type map for coercion
  const fieldTypeMap = new Map<string, string>();
  for (const f of [...meta.requiredFields, ...meta.optionalFields]) {
    fieldTypeMap.set(f.fieldname, f.type);
  }

  const errors: ImportRowError[] = [];
  const validRows: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowErrors: string[] = [];

    // Check for missing required fields
    for (const req of requiredNames) {
      const val = raw[req];
      if (val === undefined || val === null || String(val).trim() === '') {
        rowErrors.push(`${req} is required`);
      }
    }

    // Coerce values and filter to known fields
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (!allFieldNames.has(key)) continue;
      const fieldType = fieldTypeMap.get(key) || 'String';
      cleaned[key] = coerceValue(val, fieldType);
    }

    // For enhanced importers, also run Zod validation
    if (meta.category === 'enhanced') {
      const enhanced = ENHANCED_IMPORTERS[doctype];
      if (enhanced) {
        const result = enhanced.schema.safeParse(raw);
        if (!result.success) {
          for (const iss of result.error.issues) {
            rowErrors.push(`${iss.path.join('.')}: ${iss.message}`);
          }
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push({
        rowIndex: i + 2,
        message: rowErrors.join('; '),
      });
    } else {
      validRows.push(cleaned);
    }
  }

  return {
    doctype,
    total: rows.length,
    valid: validRows.length,
    failed: errors.length,
    errors,
    previewRows: validRows.slice(0, 20),
    requiredFields: requiredNames,
    optionalFields: meta.optionalFields.map((f) => f.fieldname),
  };
}

// ── Import action ────────────────────────────────────────────────────────────

export async function importDoctypeFile(
  doctype: string,
  formData: FormData,
): Promise<ImportResult> {
  const meta = await getDocTypeImportMeta(doctype);
  if (!meta) {
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

  const requiredNames = meta.requiredFields.map((f) => f.fieldname);
  const allFieldNames = new Set([
    ...requiredNames,
    ...meta.optionalFields.map((f) => f.fieldname),
  ]);
  const fieldTypeMap = new Map<string, string>();
  for (const f of [...meta.requiredFields, ...meta.optionalFields]) {
    fieldTypeMap.set(f.fieldname, f.type);
  }

  // ── Enhanced importer path ──────────────────────────────────────────────
  if (meta.category === 'enhanced') {
    const enhanced = ENHANCED_IMPORTERS[doctype];
    if (!enhanced) {
      return { success: false, doctype, total: 0, inserted: 0, failed: 0, errors: [], message: 'Enhanced importer not found' };
    }

    const validated: { row: Record<string, unknown>; pk: string; rowIndex: number }[] = [];
    const errors: ImportRowError[] = [];

    rows.forEach((raw, i) => {
      const result = enhanced.schema.safeParse(raw);
      if (!result.success) {
        errors.push({
          rowIndex: i + 2,
          message: result.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; '),
        });
        return;
      }
      const pk = (enhanced.derivePk(result.data as Record<string, unknown>) ?? '').trim();
      if (!pk) {
        errors.push({ rowIndex: i + 2, message: 'Could not derive a unique name (PK) for this row' });
        return;
      }
      validated.push({ row: result.data as Record<string, unknown>, pk, rowIndex: i + 2 });
    });

    let inserted = 0;
    try {
      await prisma.$transaction(async (tx) => {
        const txDelegate = getDelegateByAccessor(tx, enhanced.accessor);
        if (!txDelegate) throw new Error(`No Prisma delegate for ${doctype}`);

        for (const v of validated) {
          try {
            const data = enhanced.buildCreateData(v.row, v.pk);
            await (txDelegate as { create: (args: unknown) => Promise<unknown> }).create({ data });
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

    return { success: inserted > 0, doctype, total: rows.length, inserted, failed: errors.length, errors };
  }

  // ── Generic importer path (any DocType via DMMF metadata) ───────────────
  const validated: { data: Record<string, unknown>; rowIndex: number }[] = [];
  const errors: ImportRowError[] = [];

  rows.forEach((raw, i) => {
    const rowErrors: string[] = [];

    // Check required fields
    for (const req of requiredNames) {
      const val = raw[req];
      if (val === undefined || val === null || String(val).trim() === '') {
        rowErrors.push(`${req} is required`);
      }
    }

    // Coerce and filter to known fields
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (!allFieldNames.has(key)) continue;
      const fieldType = fieldTypeMap.get(key) || 'String';
      cleaned[key] = coerceValue(val, fieldType);
    }

    // Ensure PK (name) is present
    if (!cleaned.name || String(cleaned.name).trim() === '') {
      // Try to derive from the first required field
      const firstRequired = requiredNames.find((r) => r !== 'name');
      if (firstRequired && cleaned[firstRequired]) {
        cleaned.name = String(cleaned[firstRequired]).trim();
      } else {
        rowErrors.push('Could not derive a unique name (PK) for this row');
      }
    }

    // Add system fields
    cleaned.owner = 'Administrator';
    cleaned.modified_by = 'Administrator';
    cleaned.creation = new Date();
    cleaned.modified = new Date();

    if (rowErrors.length > 0) {
      errors.push({ rowIndex: i + 2, message: rowErrors.join('; ') });
    } else {
      validated.push({ data: cleaned, rowIndex: i + 2 });
    }
  });

  let inserted = 0;
  const accessor = toAccessor(doctype);

  try {
    await prisma.$transaction(async (tx) => {
      const txDelegate = getDelegateByAccessor(tx, accessor);
      if (!txDelegate) throw new Error(`No Prisma delegate for ${doctype}`);

      for (const v of validated) {
        try {
          await (txDelegate as { create: (args: unknown) => Promise<unknown> }).create({ data: v.data });
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

  return { success: inserted > 0, doctype, total: rows.length, inserted, failed: errors.length, errors };
}

// ── Helper: get delegate by accessor from tx ─────────────────────────────────

function getDelegateByAccessor(client: Record<string, unknown>, accessor: string) {
  const delegate = client[accessor];
  if (!delegate || typeof delegate !== 'object' || !('findMany' in (delegate as object))) return null;
  return delegate;
}

// ── Template generator ───────────────────────────────────────────────────────

export async function getImportTemplate(
  doctype: string,
): Promise<{ filename: string; csv: string }> {
  const meta = await getDocTypeImportMeta(doctype);
  if (!meta) throw new Error(`Unsupported doctype: ${doctype}`);

  const headers = [
    ...meta.requiredFields.map((f) => f.fieldname),
    ...meta.optionalFields.map((f) => f.fieldname),
  ];

  // Build a sample row with hints for required fields
  const sampleRow = headers.map((h) => {
    const isRequired = meta.requiredFields.some((f) => f.fieldname === h);
    return isRequired ? `<${h}>` : '';
  });

  const csv = headers.join(',') + '\n' + sampleRow.join(',') + '\n';
  return { filename: `${doctype}-import-template.csv`, csv };
}

// ── Legacy compat ────────────────────────────────────────────────────────────

export type ImportDoctype = string;
