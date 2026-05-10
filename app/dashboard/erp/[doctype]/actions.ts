'use server';

import { prisma } from '@/lib/prisma';
import { toAccessor, getDelegate } from '@/lib/erpnext/prisma-delegate';

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

export interface FetchParams {
  page?: number;
  pageSize?: number;
  search?: string;
  orderby?: string;
  order?: 'asc' | 'desc';
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
      where['name'] = { contains: params.search.trim(), mode: 'insensitive' };
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[doctype-list] fetchDoctypeList(${doctype}) failed:`, msg);
    return { success: false, error: msg || `Failed to fetch ${doctype}` };
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
    return { success: true, message: `${doctype} "${name}" deleted` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[doctype-list] deleteDoctypeRecord(${doctype}/${name}) failed:`, msg);
    return { success: false, error: msg || `Failed to delete ${doctype}` };
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
