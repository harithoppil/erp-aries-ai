'use server';

// ── Server Actions for Generic Detail Page ────────────────────────────────────
// All CRUD operations go directly to Prisma — no internal HTTP fetch.

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/prisma/client';
import {
  PrismaDelegate,
  DmmfField,
  DmmfModel,
  toAccessor,
  toDisplayLabel,
  getDelegate,
  getDelegateByAccessor,
} from '@/lib/erpnext/prisma-delegate';
import {
  submitDocument as orchestratorSubmit,
  cancelDocument as orchestratorCancel,
} from '@/lib/erpnext/document-orchestrator';

async function getAuthToken(): Promise<string | undefined> {
  return (await cookies()).get('token')?.value;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function getModel(doctype: string): { model: PrismaDelegate; accessor: string } | null {
  const accessor = toAccessor(doctype);
  const model = getDelegate(prisma, doctype);
  if (!model) return null;
  return { model, accessor };
}

function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];
  const dmmfModels = Prisma.dmmf.datamodel.models as unknown as DmmfModel[];

  for (const m of dmmfModels) {
    const hasParentType = m.fields.some((f: DmmfField) => f.name === 'parenttype');
    const hasParent = m.fields.some((f: DmmfField) => f.name === 'parent');
    if (hasParentType && hasParent) {
      const defaultMatchesParent = m.fields.some(
        (f: DmmfField) =>
          f.name === 'parenttype' &&
          f.default != null &&
          (String(f.default) === doctype ||
            (typeof f.default === 'object' && f.default !== null && String((f.default as { value: string }).value) === doctype)),
      );
      if (defaultMatchesParent || m.name.startsWith(doctype)) {
        results.push(toAccessor(m.name));
      }
    }
  }
  return results;
}

function serializeDates(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value && typeof value === 'object' && 'toJSON' in value) {
      out[key] = String(value);
    } else if (Array.isArray(value)) {
      out[key] = value.map((item) =>
        item && typeof item === 'object' && !(item instanceof Date)
          ? serializeDates(item as Record<string, unknown>)
          : item instanceof Date
            ? item.toISOString()
            : item,
      );
    } else if (value && typeof value === 'object') {
      out[key] = serializeDates(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

// ── Fetch Single Record ──────────────────────────────────────────────────────

export async function fetchDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };

    const { model } = resolved;
    const record = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!record) return { success: false, error: 'NOT_FOUND' };

    // Fetch child tables
    const childAccessors = findChildAccessors(doctype);
    const children: Record<string, unknown[]> = {};

    await Promise.all(
      childAccessors.map(async (accessor) => {
        const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, accessor);
        if (childModel) {
          const rows = await childModel.findMany({
            where: { parent: name },
            orderBy: { idx: 'asc' },
          });
          for (const row of rows as Record<string, unknown>[]) {
            const field = (row.parentfield as string) || 'items';
            if (!children[field]) children[field] = [];
            children[field].push(serializeDates(row));
          }
        }
      }),
    );

    return { success: true, data: { ...serializeDates(record), ...children } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetchDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Update Record ─────────────────────────────────────────────────────────────

export async function updateDoctypeRecord(
  doctype: string,
  name: string,
  data: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { model, accessor } = resolved;

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    if (existing.docstatus === 1) return { success: false, error: 'Cannot update submitted record' };
    if (existing.docstatus === 2) return { success: false, error: 'Cannot update cancelled record' };

    // Separate child tables from parent fields
    const childTables: Record<string, unknown[]> = {};
    const parentFields: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(data)) {
      if (Array.isArray(val)) {
        childTables[key] = val;
      } else if (key !== 'name' && key !== 'creation' && key !== 'owner' && key !== 'docstatus') {
        parentFields[key] = val;
      }
    }

    parentFields.modified = new Date();
    parentFields.modified_by = 'Administrator';

    const result = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      await txRecord[accessor].update({ where: { name }, data: parentFields });

      // Update child tables
      const childAccessors = findChildAccessors(doctype);
      for (const [field, rows] of Object.entries(childTables)) {
        let childAccessor: string | null = null;
        for (const ca of childAccessors) {
          const childDelegate = txRecord[ca];
          if (childDelegate) {
            const sample = await childDelegate.findFirst({ where: { parent: name, parentfield: field } });
            if (sample) { childAccessor = ca; break; }
          }
        }

        if (childAccessor) {
          const childModel = txRecord[childAccessor];
          await childModel.deleteMany({ where: { parent: name, parentfield: field } });
          if (rows.length > 0) {
            const childRows = (rows as Record<string, unknown>[]).map((row, i) => ({
              ...row,
              parent: name,
              parentfield: field,
              parenttype: doctype,
              idx: row.idx ?? i + 1,
            }));
            await childModel.createMany({ data: childRows });
          }
        }
      }

      return await txRecord[accessor].findUnique({ where: { name } });
    });

    return { success: true, data: serializeDates(result as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[updateDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Delete Record ─────────────────────────────────────────────────────────────

export async function deleteDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<{ message: string; deleted_children: number }>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { model, accessor } = resolved;

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) return { success: false, error: 'NOT_FOUND' };
    if (existing.docstatus !== 0) {
      return { success: false, error: existing.docstatus === 1 ? 'Cannot delete submitted record. Cancel it first.' : 'Cannot delete cancelled record' };
    }

    const childAccessors = findChildAccessors(doctype);
    let childCount = 0;
    for (const childAccessor of childAccessors) {
      const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, childAccessor);
      if (childModel) {
        childCount += await childModel.count({ where: { parent: name } });
      }
    }

    await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      for (const childAccessor of childAccessors) {
        const childDelegate = txRecord[childAccessor];
        if (childDelegate) await childDelegate.deleteMany({ where: { parent: name } });
      }
      await txRecord[accessor].delete({ where: { name } });
    });

    return { success: true, data: { message: `${doctype} "${name}" deleted`, deleted_children: childCount } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[deleteDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Submit Record ─────────────────────────────────────────────────────────────

export async function submitDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    // Route through the document orchestrator so registered doctypes (Sales
    // Invoice, Purchase Invoice, Journal Entry, Payment Entry, Stock Entry,
    // Delivery Note, Purchase Receipt, ...) actually post their GL/stock
    // ledger entries on submit. The orchestrator falls back to a simple
    // docstatus flip for unregistered doctypes — same as the old behaviour.
    const registryKey = toDisplayLabel(doctype);
    const token = await getAuthToken();
    const result = await orchestratorSubmit(registryKey, name, { token });
    if (!result.success) {
      return { success: false, error: result.error ?? 'Submit failed' };
    }
    return { success: true, data: serializeDates(result.data as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[submitDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Cancel Record ─────────────────────────────────────────────────────────────

export async function cancelDoctypeRecord(
  doctype: string,
  name: string,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const registryKey = toDisplayLabel(doctype);
    const token = await getAuthToken();
    const result = await orchestratorCancel(registryKey, name, { token });
    if (!result.success) {
      return { success: false, error: result.error ?? 'Cancel failed' };
    }
    return { success: true, data: serializeDates(result.data as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cancelDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Fetch Schema (for New Record form) ────────────────────────────────────────

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  default: unknown;
  /** Doctype name this field links to (FK), if any. */
  linkTo?: string;
  /** Display field on the linked doctype to show alongside the PK. */
  linkLabelField?: string;
}

// Field-name → doctype map for fields where the FK target name differs from the
// field's own name (the most common ERPNext convention). Fields not listed here
// are auto-detected by trying field-name → PascalCase and matching DMMF.
const KNOWN_LINK_FIELDS: Record<string, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  item_code: 'Item',
  warehouse: 'Warehouse',
  account: 'Account',
  expense_account: 'Account',
  income_account: 'Account',
  debit_to: 'Account',
  credit_to: 'Account',
  cost_center: 'CostCenter',
  company: 'Company',
  currency: 'Currency',
  uom: 'Uom',
  stock_uom: 'Uom',
  project: 'Project',
  employee: 'Employee',
  department: 'Department',
  branch: 'Branch',
  designation: 'Designation',
  fiscal_year: 'FiscalYear',
  payment_terms_template: 'PaymentTermsTemplate',
  price_list: 'PriceList',
  selling_price_list: 'PriceList',
  buying_price_list: 'PriceList',
  territory: 'Territory',
  customer_group: 'CustomerGroup',
  supplier_group: 'SupplierGroup',
  item_group: 'ItemGroup',
  brand: 'Brand',
  tax_category: 'TaxCategory',
  payment_method: 'ModeOfPayment',
  mode_of_payment: 'ModeOfPayment',
  asset_category: 'AssetCategory',
  asset: 'Asset',
  task: 'Task',
  lead: 'Lead',
  opportunity: 'Opportunity',
  quotation: 'Quotation',
  sales_order: 'SalesOrder',
  purchase_order: 'PurchaseOrder',
  delivery_note: 'DeliveryNote',
  purchase_receipt: 'PurchaseReceipt',
  sales_invoice: 'SalesInvoice',
  purchase_invoice: 'PurchaseInvoice',
};

// Doctypes whose primary "label" field is something other than the convention
// `<doctype>_name` (e.g. Item uses item_name, but Account uses account_name).
const LINK_LABEL_FIELD: Record<string, string> = {
  Customer: 'customer_name',
  Supplier: 'supplier_name',
  Item: 'item_name',
  Warehouse: 'warehouse_name',
  Account: 'account_name',
  CostCenter: 'cost_center_name',
  Company: 'company_name',
  Project: 'project_name',
  Employee: 'employee_name',
  Department: 'department_name',
  Branch: 'branch',
  Designation: 'designation_name',
  CustomerGroup: 'customer_group_name',
  SupplierGroup: 'supplier_group_name',
  ItemGroup: 'item_group_name',
  Brand: 'brand',
  Territory: 'territory_name',
  Currency: 'currency_name',
  Uom: 'uom_name',
  ModeOfPayment: 'mode_of_payment',
  AssetCategory: 'asset_category_name',
  PriceList: 'price_list_name',
  TaxCategory: 'title',
  PaymentTermsTemplate: 'template_name',
  FiscalYear: 'year',
  Lead: 'lead_name',
  Opportunity: 'customer_name',
  Quotation: 'customer_name',
  SalesOrder: 'customer_name',
  PurchaseOrder: 'supplier_name',
  DeliveryNote: 'customer_name',
  PurchaseReceipt: 'supplier_name',
  SalesInvoice: 'customer_name',
  PurchaseInvoice: 'supplier_name',
  Task: 'subject',
  Asset: 'asset_name',
};

function detectLinkTarget(fieldName: string, dmmfModels: DmmfModel[]): string | undefined {
  // 1. Explicit known mapping
  if (KNOWN_LINK_FIELDS[fieldName]) {
    const target = KNOWN_LINK_FIELDS[fieldName];
    if (dmmfModels.some((m) => m.name === target)) return target;
  }
  // 2. Auto: snake_case fieldName → PascalCase, look up DMMF
  const pascal = fieldName
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('');
  if (dmmfModels.some((m) => m.name === pascal)) return pascal;
  return undefined;
}

export async function fetchDoctypeSchema(
  doctype: string,
): Promise<ActionResult<SchemaField[]>> {
  try {
    const dmmfModels = Prisma.dmmf.datamodel.models as unknown as DmmfModel[];
    const model = dmmfModels.find((m) => m.name.toLowerCase() === toAccessor(doctype).toLowerCase());
    if (!model) return { success: false, error: `Unknown DocType: ${doctype}` };

    const systemFields = new Set([
      'creation', 'modified', 'owner', 'modified_by', 'docstatus', 'idx',
      'parent', 'parentfield', 'parenttype', '_user_tags', '_comments', '_assign', '_liked_by',
    ]);

    // Self-referential link detection guard: on the Item form, item_code maps
    // to KNOWN_LINK_FIELDS["item_code"] = "Item" — but item_code is the NEW
    // item's PK, not a reference to another item. Skip links pointing at the
    // current doctype.
    const currentDoctype = model.name;

    const fields = model.fields
      .filter((f) => f.kind === 'scalar' && !systemFields.has(f.name) && f.name !== 'name')
      .map((f) => {
        let linkTo = f.type === 'String' ? detectLinkTarget(f.name, dmmfModels) : undefined;
        if (linkTo === currentDoctype) linkTo = undefined;
        return {
          name: f.name,
          type: f.type,
          required: f.isRequired && !f.hasDefaultValue,
          default: f.default ?? null,
          linkTo,
          linkLabelField: linkTo ? LINK_LABEL_FIELD[linkTo] : undefined,
        };
      });

    return { success: true, data: fields };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[fetchDoctypeSchema]', message);
    return { success: false, error: message };
  }
}

// ── Search records by name + label field (for Link-field autocomplete) ───────

export interface LinkSearchResult {
  name: string;
  label: string;
}

export async function searchDoctypeNames(
  linkTo: string,
  query: string,
  limit = 20,
  extraFilters?: Record<string, unknown> | null,
): Promise<ActionResult<LinkSearchResult[]>> {
  try {
    const delegate = getDelegate(prisma, linkTo);
    if (!delegate) return { success: false, error: `Unknown DocType: ${linkTo}` };

    const labelField = LINK_LABEL_FIELD[linkTo];
    const trimmed = query.trim();

    const searchWhere: Record<string, unknown> = trimmed
      ? labelField
        ? {
            OR: [
              { name: { contains: trimmed, mode: 'insensitive' } },
              { [labelField]: { contains: trimmed, mode: 'insensitive' } },
            ],
          }
        : { name: { contains: trimmed, mode: 'insensitive' } }
      : {};

    // Merge extra filters (from link_filters) with the search where clause
    let where: Record<string, unknown>;
    if (extraFilters && Object.keys(extraFilters).length > 0) {
      where = searchWhere
        ? { AND: [searchWhere, extraFilters] }
        : extraFilters;
    } else {
      where = searchWhere;
    }

    const select = labelField ? { name: true, [labelField]: true } : { name: true };

    const rows = (await delegate.findMany({
      where,
      select,
      take: limit,
      orderBy: { name: 'asc' },
    })) as Record<string, unknown>[];

    const results: LinkSearchResult[] = rows.map((row) => ({
      name: String(row.name),
      label: labelField ? String(row[labelField] ?? '') : '',
    }));

    return { success: true, data: results };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[searchDoctypeNames]', message);
    return { success: false, error: message };
  }
}

// ── Create Record ─────────────────────────────────────────────────────────────

export async function createDoctypeRecord(
  doctype: string,
  data: Record<string, unknown>,
): Promise<ActionResult<Record<string, unknown>>> {
  try {
    const resolved = getModel(doctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${doctype}` };
    const { accessor } = resolved;

    // Derive PK (`name`) when caller hasn't supplied one. Frappe convention:
    // many doctypes' `name` mirrors a key field (Customer.customer_name,
    // Item.item_code, etc.). Fall back to a unique sortable string so the
    // create still succeeds even when no label field is present.
    if (!data.name || (typeof data.name === 'string' && !data.name.trim())) {
      const pascal = toAccessor(doctype).charAt(0).toUpperCase() + toAccessor(doctype).slice(1);
      const labelField = LINK_LABEL_FIELD[pascal];
      const pkCandidates = [
        labelField ? data[labelField] : undefined,
        data.item_code,
        data.customer_name,
        data.supplier_name,
        data.account_name,
        data.project_name,
      ];
      const fromLabel = pkCandidates.find(
        (v) => typeof v === 'string' && v.trim().length > 0,
      ) as string | undefined;
      data.name = fromLabel?.trim() || `${pascal}-${Date.now().toString(36).toUpperCase()}`;
    }

    data.docstatus = 0;
    data.creation = new Date();
    data.modified = new Date();
    data.owner = 'Administrator';
    data.modified_by = 'Administrator';

    const result = await (prisma as unknown as Record<string, PrismaDelegate>)[accessor].create({
      data,
    });

    return { success: true, data: serializeDates(result as Record<string, unknown>) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[createDoctypeRecord]', message);
    return { success: false, error: message };
  }
}

// ── Fetch Linked Record Fields (for fetch_from auto-population) ────────────────

/**
 * Fetch specific field values from a linked DocType record.
 * Used by ERPFormClient to implement fetch_from auto-population when a Link
 * field changes (e.g. selecting a Customer auto-fills customer_name).
 */
export async function fetchLinkedRecordField(
  linkDoctype: string,
  linkName: string,
  fieldsToFetch: string[],
): Promise<Record<string, unknown> | null> {
  'use server';
  const delegate = getDelegate(prisma, linkDoctype);
  if (!delegate) return null;

  const record = await delegate.findUnique({
    where: { name: linkName },
    select: Object.fromEntries(fieldsToFetch.map((f) => [f, true])),
  }) as Record<string, unknown> | null;

  if (!record) return null;
  return serializeDates(record);
}

// ── Save Child Table Rows ──────────────────────────────────────────────────────

/**
 * Persist child-table rows for a given parent fieldname.
 * Uses delete-then-create in a transaction (same pattern as Frappe).
 * Returns counts of deleted, created, and updated rows.
 */
export async function saveChildTableRows(
  parentDoctype: string,
  parentName: string,
  fieldname: string,
  rows: Record<string, unknown>[],
): Promise<ActionResult<{ deleted: number; created: number; updated: number }>> {
  try {
    const resolved = getModel(parentDoctype);
    if (!resolved) return { success: false, error: `Unknown DocType: ${parentDoctype}` };

    const childAccessors = findChildAccessors(toDisplayLabel(parentDoctype));

    // Find which child model has rows with this parentfield
    const childAccessor = await findChildAccessorForField(
      childAccessors,
      parentName,
      fieldname,
    );

    if (!childAccessor) {
      return {
        success: false,
        error: `No child table accessor found for field "${fieldname}" on ${parentDoctype}`,
      };
    }

    const parentDisplayLabel = toDisplayLabel(parentDoctype);

    const result = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      const childModel = txRecord[childAccessor];
      if (!childModel) {
        throw new Error(`Child model ${childAccessor} not found in transaction`);
      }

      // Delete existing rows
      const deleted = await childModel.deleteMany({
        where: { parent: parentName, parentfield: fieldname },
      });

      // Create new rows
      const childRows = rows.map((row, i) => ({
        ...row,
        parent: parentName,
        parenttype: parentDisplayLabel,
        parentfield: fieldname,
        idx: i + 1,
        name: (row.name as string) || crypto.randomUUID(),
      }));

      // Strip client-side markers
      for (const r of childRows) {
        delete (r as Record<string, unknown>).__is_new;
      }

      if (childRows.length > 0) {
        await childModel.createMany({ data: childRows });
      }

      return {
        deleted: deleted.count,
        created: childRows.length,
        updated: 0, // delete+create pattern; no separate update count
      };
    });

    return { success: true, data: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[saveChildTableRows]', message);
    return { success: false, error: message };
  }
}

/**
 * Find the child accessor (Prisma model name) that contains rows for a given
 * parent + parentfield combination. Queries sample rows from each candidate.
 */
async function findChildAccessorForField(
  childAccessors: string[],
  parentName: string,
  fieldname: string,
): Promise<string | null> {
  for (const accessor of childAccessors) {
    const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, accessor);
    if (childModel) {
      const sample = await childModel.findFirst({
        where: { parent: parentName, parentfield: fieldname },
      });
      if (sample) return accessor;
    }
  }
  // If no existing rows found, try the first accessor that has parentfield field
  // (for new records where there are no rows yet)
  if (childAccessors.length > 0) {
    return childAccessors[0];
  }
  return null;
}
