'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toAccessor, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

export interface KanbanColumn {
  value: string;
  label: string;
  color: string;
}

export interface KanbanCard {
  name: string;
  title: string;
  columnValue: string;
  [key: string]: unknown;
}

export interface KanbanConfig {
  doctype: string;
  doctypeLabel: string;
  fieldname: string;
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

export interface KanbanResult {
  success: true;
  config: KanbanConfig;
}
export interface KanbanError {
  success: false;
  error: string;
}
export type FetchKanbanResult = KanbanResult | KanbanError;

const COLUMN_COLORS = [
  'bg-blue-100 border-blue-300',
  'bg-green-100 border-green-300',
  'bg-amber-100 border-amber-300',
  'bg-purple-100 border-purple-300',
  'bg-pink-100 border-pink-300',
  'bg-teal-100 border-teal-300',
  'bg-orange-100 border-orange-300',
  'bg-red-100 border-red-300',
];

// Default kanban configs per doctype (until we read from DB)
const KANBAN_CONFIGS: Record<string, { fieldname: string; columnField?: string }> = {
  'task': { fieldname: 'status', columnField: 'status' },
  'lead': { fieldname: 'status', columnField: 'status' },
  'opportunity': { fieldname: 'status', columnField: 'status' },
  'project': { fieldname: 'status', columnField: 'status' },
  'sales-order': { fieldname: 'docstatus' },
  'purchase-order': { fieldname: 'docstatus' },
  'sales-invoice': { fieldname: 'docstatus' },
  'purchase-invoice': { fieldname: 'docstatus' },
  'quotation': { fieldname: 'docstatus' },
  'issue': { fieldname: 'status', columnField: 'status' },
};

// Known select field options for columns
const STATUS_OPTIONS: Record<string, string[]> = {
  'status': ['Open', 'In Progress', 'Completed', 'Closed', 'Cancelled'],
  'docstatus': ['Draft', 'Submitted', 'Cancelled'],
};

// Title fields per doctype
const TITLE_FIELDS: Record<string, string> = {
  'task': 'subject',
  'lead': 'lead_name',
  'opportunity': 'customer_name',
  'project': 'project_name',
  'sales-order': 'customer_name',
  'purchase-order': 'supplier_name',
  'sales-invoice': 'customer_name',
  'purchase-invoice': 'supplier_name',
  'quotation': 'customer_name',
  'issue': 'subject',
  'item': 'item_name',
  'customer': 'customer_name',
  'supplier': 'supplier_name',
  'employee': 'employee_name',
};

export async function fetchKanbanData(
  doctype: string,
): Promise<FetchKanbanResult> {
  try {
    const config = KANBAN_CONFIGS[doctype];
    if (!config) {
      return { success: false, error: `No Kanban configuration for ${toDisplayLabel(doctype)}` };
    }

    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const { fieldname } = config;
    const titleField = TITLE_FIELDS[doctype] || 'name';

    // Fetch all records
    const records = await delegate.findMany({
      where: { docstatus: { not: 2 } },
      orderBy: { creation: 'desc' },
    }) as Record<string, unknown>[];

    // Determine columns from the actual data
    const uniqueValues = new Set<string>();
    for (const r of records) {
      const val = String(r[fieldname] ?? 'Unset');
      uniqueValues.add(val);
    }

    // Also add known options if they exist
    const knownOptions = STATUS_OPTIONS[fieldname] ?? STATUS_OPTIONS[config.columnField ?? ''] ?? [];
    for (const opt of knownOptions) {
      uniqueValues.add(opt);
    }

    // Build columns
    const columns: KanbanColumn[] = Array.from(uniqueValues).map((val, i) => ({
      value: val,
      label: val === '0' ? 'Draft' : val === '1' ? 'Submitted' : val === '2' ? 'Cancelled' : val || 'Unset',
      color: COLUMN_COLORS[i % COLUMN_COLORS.length],
    }));

    // Build cards
    const cards: KanbanCard[] = records.map((r) => ({
      name: String(r.name ?? ''),
      title: String(r[titleField] ?? r.name ?? ''),
      columnValue: String(r[fieldname] ?? 'Unset'),
      ...Object.fromEntries(
        Object.entries(r).filter(([k]) => !['creation', 'modified', 'owner', 'modified_by'].includes(k))
      ),
    }));

    return {
      success: true,
      config: {
        doctype,
        doctypeLabel: toDisplayLabel(doctype),
        fieldname,
        columns,
        cards,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchKanbanData]', msg);
    return { success: false, error: `Failed to load Kanban board` };
  }
}

export async function updateKanbanCardField(
  doctype: string,
  name: string,
  fieldname: string,
  value: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, error: `Unknown DocType: ${doctype}` };

    // Convert display labels back to values for docstatus
    let actualValue: string | number = value;
    if (fieldname === 'docstatus') {
      if (value === 'Draft') actualValue = 0;
      else if (value === 'Submitted') actualValue = 1;
      else if (value === 'Cancelled') actualValue = 2;
    }

    await delegate.update({
      where: { name },
      data: { [fieldname]: actualValue, modified: new Date(), modified_by: 'Administrator' },
    });

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[updateKanbanCardField]', msg);
    return { success: false, error: 'Failed to update card' };
  }
}
