'use server';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@/prisma/client';
import { toAccessor, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

export interface GlobalSearchResult {
  doctype: string;
  doctypeLabel: string;
  name: string;
  label: string;
}

export interface GlobalSearchResponse {
  success: true;
  results: GlobalSearchResult[];
}
export interface GlobalSearchError {
  success: false;
  error: string;
}
export type GlobalSearchResultType = GlobalSearchResponse | GlobalSearchError;

// DocTypes that are useful to search across (high-value business objects)
const SEARCHABLE_DOCTYPES = [
  'customer', 'supplier', 'item', 'sales-invoice', 'purchase-invoice',
  'sales-order', 'purchase-order', 'quotation', 'delivery-note', 'purchase-receipt',
  'journal-entry', 'payment-entry', 'account', 'warehouse', 'employee',
  'project', 'task', 'lead', 'opportunity', 'company',
  'item-group', 'customer-group', 'supplier-group', 'brand',
  'cost-center', 'currency', 'mode-of-payment',
];

// Label fields for each doctype
const LABEL_FIELDS: Record<string, string> = {
  customer: 'customer_name',
  supplier: 'supplier_name',
  item: 'item_name',
  account: 'account_name',
  warehouse: 'warehouse_name',
  cost_center: 'cost_center_name',
  company: 'company_name',
  employee: 'employee_name',
  project: 'project_name',
  task: 'subject',
  lead: 'lead_name',
  opportunity: 'customer_name',
  item_group: 'item_group_name',
  customer_group: 'customer_group_name',
  supplier_group: 'supplier_group_name',
  brand: 'brand',
  currency: 'currency_name',
  mode_of_payment: 'mode_of_payment',
};

export async function globalSearch(query: string, limit = 30): Promise<GlobalSearchResultType> {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return { success: true, results: [] };
    }

    const results: GlobalSearchResult[] = [];
    const perType = Math.max(3, Math.ceil(limit / SEARCHABLE_DOCTYPES.length));

    // Get all DMMF models for accessor resolution
    const dmmfModels = Prisma.dmmf.datamodel.models as unknown as { name: string; dbName?: string }[];
    const modelMap = new Map<string, string>();
    for (const m of dmmfModels) {
      const accessor = m.name.charAt(0).toLowerCase() + m.name.slice(1);
      modelMap.set(m.name.toLowerCase(), accessor);
    }

    // Search each doctype in parallel
    const searchPromises = SEARCHABLE_DOCTYPES.map(async (doctype) => {
      const accessor = toAccessor(doctype);
      const delegate = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>)[accessor];
      if (!delegate) return [];

      const labelField = LABEL_FIELDS[doctype];
      const searchTerm = trimmed.replace(/[%_]/g, '');

      const where = labelField
        ? {
            OR: [
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { [labelField]: { contains: searchTerm, mode: 'insensitive' } },
            ],
          }
        : { name: { contains: searchTerm, mode: 'insensitive' } };

      const select = labelField
        ? { name: true, [labelField]: true }
        : { name: true };

      try {
        const rows = await delegate.findMany({
          where,
          select,
          take: perType,
          orderBy: { modified: 'desc' },
        }) as Record<string, unknown>[];

        return rows.map((row) => ({
          doctype,
          doctypeLabel: toDisplayLabel(doctype),
          name: String(row.name),
          label: labelField ? String(row[labelField] ?? '') : '',
        }));
      } catch {
        return [];
      }
    });

    const allResults = await Promise.all(searchPromises);
    for (const group of allResults) {
      results.push(...group);
    }

    // Sort: exact name matches first, then label matches, then by doctype relevance
    results.sort((a, b) => {
      const aExact = a.name.toLowerCase() === trimmed.toLowerCase() ? 0 : 1;
      const bExact = b.name.toLowerCase() === trimmed.toLowerCase() ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aStarts = a.name.toLowerCase().startsWith(trimmed.toLowerCase()) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(trimmed.toLowerCase()) ? 0 : 1;
      return aStarts - bStarts;
    });

    return { success: true, results: results.slice(0, limit) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[globalSearch]', msg);
    return { success: false, error: 'Search failed' };
  }
}
