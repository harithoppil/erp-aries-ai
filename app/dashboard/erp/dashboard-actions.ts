'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toAccessor, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface NumberCardData {
  label: string;
  value: number;
  doctype: string;
  doctypeLabel: string;
}

export interface DashboardData {
  success: true;
  charts: {
    label: string;
    type: string;
    data: ChartDataPoint[];
    doctype: string;
  }[];
  cards: NumberCardData[];
}
export interface DashboardError {
  success: false;
  error: string;
}
export type DashboardResult = DashboardData | DashboardError;

// ── Hardcoded dashboard config (metadata-driven in the future) ──────────────
// In Frappe, this comes from Dashboard Chart and Number Card tables.
// For now we define key business metrics directly.

const DASHBOARD_CARDS: { doctype: string; label: string }[] = [
  { doctype: 'sales-invoice', label: 'Sales Invoices' },
  { doctype: 'purchase-invoice', label: 'Purchase Invoices' },
  { doctype: 'sales-order', label: 'Sales Orders' },
  { doctype: 'purchase-order', label: 'Purchase Orders' },
  { doctype: 'customer', label: 'Customers' },
  { doctype: 'supplier', label: 'Suppliers' },
  { doctype: 'item', label: 'Items' },
  { doctype: 'employee', label: 'Employees' },
  { doctype: 'payment-entry', label: 'Payments' },
  { doctype: 'journal-entry', label: 'Journal Entries' },
  { doctype: 'project', label: 'Projects' },
  { doctype: 'task', label: 'Tasks' },
];

const DASHBOARD_CHARTS: {
  doctype: string; label: string; type: 'count_by_field';
  groupField: string; limit?: number;
}[] = [
  { doctype: 'sales-invoice', label: 'Invoices by Status', type: 'count_by_field', groupField: 'docstatus', limit: 5 },
  { doctype: 'sales-order', label: 'Orders by Status', type: 'count_by_field', groupField: 'docstatus', limit: 5 },
  { doctype: 'item', label: 'Items by Group', type: 'count_by_field', groupField: 'item_group', limit: 8 },
  { doctype: 'customer', label: 'Customers by Group', type: 'count_by_field', groupField: 'customer_group', limit: 8 },
  { doctype: 'employee', label: 'Employees by Department', type: 'count_by_field', groupField: 'department', limit: 8 },
];

// ── Fetch Dashboard Data ─────────────────────────────────────────────────────

export async function fetchDashboardData(): Promise<DashboardResult> {
  try {
    // Fetch number cards in parallel
    const cardPromises = DASHBOARD_CARDS.map(async ({ doctype, label }) => {
      const delegate = getDelegate(prisma, doctype);
      if (!delegate) return null;
      try {
        const count = await delegate.count({ where: { docstatus: { not: 2 } } });
        return {
          label,
          value: count,
          doctype,
          doctypeLabel: toDisplayLabel(doctype),
        };
      } catch {
        return null;
      }
    });

    // Fetch chart data in parallel
    const chartPromises = DASHBOARD_CHARTS.map(async ({ doctype, label, type, groupField, limit }) => {
      const delegate = getDelegate(prisma, doctype);
      if (!delegate) return null;
      try {
        const rows = await delegate.findMany({
          select: { [groupField]: true },
          where: { docstatus: { not: 2 } },
        }) as Record<string, unknown>[];

        // Group and count
        const counts = new Map<string, number>();
        for (const row of rows) {
          const key = String(row[groupField] ?? 'Unset');
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }

        // Sort by count descending
        const data = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit ?? 10)
          .map(([label, value]) => ({
            label: label === '0' ? 'Draft' : label === '1' ? 'Submitted' : label === '2' ? 'Cancelled' : label,
            value,
          }));

        return { label, type, data, doctype };
      } catch {
        return null;
      }
    });

    const [cards, charts] = await Promise.all([
      Promise.all(cardPromises),
      Promise.all(chartPromises),
    ]);

    return {
      success: true,
      cards: cards.filter((c): c is NumberCardData => c !== null),
      charts: charts.filter((c): c is NonNullable<typeof c> => c !== null),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchDashboardData]', msg);
    return { success: false, error: 'Failed to load dashboard' };
  }
}
