'use server';

import { prisma } from '@/lib/prisma';
import { toAccessor, toDisplayLabel, getDelegate } from '@/lib/erpnext/prisma-delegate';
import { dispatchWebhookEvent } from '@/app/dashboard/erp/webhooks/actions';

/** Convert raw Prisma errors into user-friendly messages. */
function friendlyError(err: unknown, doctype: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('does not exist') && msg.includes('table')) {
    return `Table for "${toDisplayLabel(doctype)}" does not exist yet. Run a migration first.`;
  }
  if (msg.includes('Unique constraint failed')) {
    return `A record with this name already exists.`;
  }
  if (msg.includes('Foreign key constraint failed') || msg.includes('violates foreign key')) {
    return `Referenced record not found. Check linked fields.`;
  }
  return `Failed to load ${toDisplayLabel(doctype)}`;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface ListMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export interface ListResult {
  success: true;
  records: Record<string, unknown>[];
  meta: ListMeta;
}

export interface ListError {
  success: false;
  error: string;
}

export type FetchResult = ListResult | ListError;

export interface DeleteResult {
  success: boolean;
  message?: string;
  error?: string;
}

export type FilterOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'not like' | 'in' | 'not in' | 'is set' | 'is not set';

export type FilterValue =
  | string
  | number
  | boolean
  | { from: string; to: string }
  | { operator: FilterOperator; value: unknown }
  | null;

/** Apply a filter operator to a Prisma where clause. */
function applyOperator(
  where: Record<string, unknown>,
  field: string,
  operator: string,
  value: unknown,
): void {
  switch (operator) {
    case '=':
      where[field] = value;
      break;
    case '!=':
      where[field] = { not: value };
      break;
    case '>':
      where[field] = { gt: value };
      break;
    case '<':
      where[field] = { lt: value };
      break;
    case '>=':
      where[field] = { gte: value };
      break;
    case '<=':
      where[field] = { lte: value };
      break;
    case 'like':
      where[field] = { contains: String(value).replace(/[*%]/g, ''), mode: 'insensitive' };
      break;
    case 'not like':
      where[field] = { not: { contains: String(value).replace(/[*%]/g, ''), mode: 'insensitive' } };
      break;
    case 'in': {
      const arr = Array.isArray(value) ? value : String(value).split(',').map((s: string) => s.trim());
      where[field] = { in: arr };
      break;
    }
    case 'not in': {
      const arr = Array.isArray(value) ? value : String(value).split(',').map((s: string) => s.trim());
      where[field] = { notIn: arr };
      break;
    }
    case 'is set':
      where[field] = { not: null };
      break;
    case 'is not set':
      where[field] = null;
      break;
    default:
      where[field] = value;
  }
}

export interface FetchParams {
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: string[];
  orderby?: string;
  order?: 'asc' | 'desc';
  filters?: Record<string, FilterValue>;
}

// ── List ────────────────────────────────────────────────────────────────────

export async function fetchDoctypeList(
  doctype: string,
  params?: FetchParams,
): Promise<FetchResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const page = params?.page ?? 1;
    const pageSize = Math.min(params?.pageSize ?? 20, 200);
    const offset = (page - 1) * pageSize;
    const orderby = params?.orderby ?? 'creation';
    const order = params?.order ?? 'desc';

    const where: Record<string, unknown> = {};
    if (params?.search && params.search.trim()) {
      const searchTerm = params.search.trim();
      const fields = params?.searchFields && params.searchFields.length > 0
        ? params.searchFields
        : ['name'];
      if (fields.length === 1) {
        where[fields[0]] = { contains: searchTerm, mode: 'insensitive' };
      } else {
        where['OR'] = fields.map((f) => ({ [f]: { contains: searchTerm, mode: 'insensitive' } }));
      }
    }

    // Apply filter values to the where clause
    if (params?.filters) {
      for (const [k, v] of Object.entries(params.filters)) {
        if (v == null || v === '') continue;
        // Structured filter: { operator: '!=', value: 'Closed' }
        if (typeof v === 'object' && 'operator' in v) {
          const sf = v as { operator: string; value: unknown };
          const clauses: Record<string, unknown>[] = [];
          applyOperator(where, k, sf.operator, sf.value);
        } else if (typeof v === 'object' && 'from' in v) {
          const rangeVal = v as { from: string; to: string };
          const rangeClause: Record<string, unknown> = {};
          if (rangeVal.from) rangeClause.gte = rangeVal.from;
          if (rangeVal.to) rangeClause.lte = rangeVal.to;
          if (Object.keys(rangeClause).length > 0) where[k] = rangeClause;
        } else if (typeof v === 'string' && /[*%]/.test(v)) {
          where[k] = { contains: v.replace(/[*%]/g, ''), mode: 'insensitive' };
        } else {
          where[k] = v;
        }
      }
    }

    const [records, total] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: { [orderby]: order },
        take: pageSize,
        skip: offset,
      }) as Promise<Record<string, unknown>[]>,
      delegate.count({ where }) as Promise<number>,
    ]);

    const serialized = records.map((row) => serializeDates(row));

    return {
      success: true,
      records: serialized,
      meta: {
        page,
        pageSize,
        total,
        hasMore: offset + pageSize < total,
      },
    };
  } catch (err: unknown) {
    console.error(`[doctype-list] fetchDoctypeList(${doctype}) failed:`, err instanceof Error ? err.message : err);
    return { success: false, error: friendlyError(err, doctype) };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────

export async function deleteDoctypeRecord(
  doctype: string,
  name: string,
): Promise<DeleteResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    await delegate.delete({ where: { name } });
    // Fire after_delete webhook (non-blocking)
    dispatchWebhookEvent(doctype, name, 'after_delete').catch(() => {});
    return { success: true, message: `${doctype} "${name}" deleted` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[doctype-list] deleteDoctypeRecord(${doctype}/${name}) failed:`, msg);
    return { success: false, error: msg || `Failed to delete ${doctype}` };
  }
}

// ── Bulk Operations ──────────────────────────────────────────────────────────

export interface BulkResult {
  success: boolean;
  affected: number;
  failed: number;
  errors?: string[];
}

export async function bulkDeleteDoctypeRecords(
  doctype: string,
  names: string[],
): Promise<BulkResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, affected: 0, failed: names.length, errors: [`Unknown DocType: ${doctype}`] };

    const result = await delegate.deleteMany({
      where: { name: { in: names } },
    });
    // Fire webhooks non-blocking
    for (const name of names) {
      dispatchWebhookEvent(doctype, name, 'after_delete').catch(() => {});
    }
    return { success: true, affected: result.count, failed: names.length - result.count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, affected: 0, failed: names.length, errors: [msg] };
  }
}

export async function bulkUpdateDoctypeRecords(
  doctype: string,
  names: string[],
  fieldUpdates: Record<string, unknown>,
): Promise<BulkResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, affected: 0, failed: names.length, errors: [`Unknown DocType: ${doctype}`] };

    // Remove protected fields that should never be bulk-updated
    const protectedFields = new Set(['name', 'creation', 'modified', 'modified_by', 'owner', 'docstatus']);
    const cleanUpdates: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fieldUpdates)) {
      if (!protectedFields.has(k)) cleanUpdates[k] = v;
    }
    if (Object.keys(cleanUpdates).length === 0) {
      return { success: false, affected: 0, failed: names.length, errors: ['No valid fields to update'] };
    }

    const result = await delegate.updateMany({
      where: { name: { in: names } },
      data: { ...cleanUpdates, modified: new Date() },
    });
    for (const name of names) {
      dispatchWebhookEvent(doctype, name, 'after_update').catch(() => {});
    }
    return { success: true, affected: result.count, failed: names.length - result.count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, affected: 0, failed: names.length, errors: [msg] };
  }
}

export async function bulkSubmitDoctypeRecords(
  doctype: string,
  names: string[],
): Promise<BulkResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, affected: 0, failed: names.length, errors: [`Unknown DocType: ${doctype}`] };

    // Only submit records that are Draft (docstatus=0)
    const result = await delegate.updateMany({
      where: { name: { in: names }, docstatus: 0 },
      data: { docstatus: 1, modified: new Date() },
    });
    for (const name of names) {
      dispatchWebhookEvent(doctype, name, 'on_submit').catch(() => {});
    }
    return { success: true, affected: result.count, failed: names.length - result.count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, affected: 0, failed: names.length, errors: [msg] };
  }
}

export async function bulkCancelDoctypeRecords(
  doctype: string,
  names: string[],
): Promise<BulkResult> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, affected: 0, failed: names.length, errors: [`Unknown DocType: ${doctype}`] };

    // Only cancel records that are Submitted (docstatus=1)
    const result = await delegate.updateMany({
      where: { name: { in: names }, docstatus: 1 },
      data: { docstatus: 2, modified: new Date() },
    });
    for (const name of names) {
      dispatchWebhookEvent(doctype, name, 'on_cancel').catch(() => {});
    }
    return { success: true, affected: result.count, failed: names.length - result.count };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, affected: 0, failed: names.length, errors: [msg] };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
