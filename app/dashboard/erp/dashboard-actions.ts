'use server';

import { prisma } from '@/lib/prisma';
import { toAccessor, getDelegate } from '@/lib/erpnext/prisma-delegate';
import {
  resolveChartData,
  resolveNumberCard,
  listDashboardCharts as listCharts,
  listNumberCards as listCards,
  seedDefaultDashboard as seedDefaults,
  type DashboardChartConfig,
  type NumberCardConfig,
  type ChartDataPoint,
} from '@/lib/erpnext/chart-engine';

export { listCharts as listDashboardCharts, listCards as listNumberCards, seedDefaults as seedDefaultDashboard };
export type { DashboardChartConfig, NumberCardConfig, ChartDataPoint };

// ── Types ────────────────────────────────────────────────────────────────────

export interface NumberCardData {
  label: string;
  value: number;
  doctype: string;
}

export interface ChartData {
  label: string;
  type: string;
  data: ChartDataPoint[];
  doctype: string;
}

export interface DashboardResult {
  success: boolean;
  cards: NumberCardData[];
  charts: ChartData[];
  error?: string;
}

// ── Hardcoded fallback data (used when no DB configs exist) ──────────────────

const CARD_QUERIES: Array<{ label: string; doctype: string; filters?: Record<string, unknown> }> = [
  { label: 'Customers', doctype: 'Customer' },
  { label: 'Items', doctype: 'Item' },
  { label: 'Suppliers', doctype: 'Supplier' },
  { label: 'Sales Orders', doctype: 'SalesOrder' },
  { label: 'Invoices', doctype: 'SalesInvoice' },
  { label: 'Employees', doctype: 'Employee' },
];

const CHART_QUERIES: Array<{ label: string; doctype: string; groupField: string; type: string }> = [
  { label: 'Invoices by Status', doctype: 'SalesInvoice', groupField: 'status', type: 'bar' },
  { label: 'Items by Group', doctype: 'Item', groupField: 'itemGroup', type: 'bar' },
  { label: 'Customers by Territory', doctype: 'Customer', groupField: 'territory', type: 'bar' },
];

// ── Fetch Dashboard Data ─────────────────────────────────────────────────────

export async function fetchDashboardData(): Promise<DashboardResult> {
  try {
    // Number cards
    const cardResults = await Promise.all(
      CARD_QUERIES.map(async (q) => {
        const delegate = getDelegate(prisma, q.doctype);
        if (!delegate) return { label: q.label, value: 0, doctype: q.doctype };
        try {
          const count = await delegate.count({ where: q.filters ?? {} }) as number;
          return { label: q.label, value: count, doctype: q.doctype };
        } catch {
          return { label: q.label, value: 0, doctype: q.doctype };
        }
      }),
    );

    // Charts
    const chartResults = await Promise.all(
      CHART_QUERIES.map(async (q) => {
        const delegate = getDelegate(prisma, q.doctype);
        if (!delegate) return { label: q.label, type: q.type, data: [] as ChartDataPoint[], doctype: q.doctype };
        try {
          const accessor = toAccessor(q.doctype);
          const rows = await prisma.$queryRawUnsafe<Array<{ label: string | null; value: number }>>(
            `SELECT "${q.groupField}" as label, COUNT(*) as value FROM "${accessor}" GROUP BY "${q.groupField}" ORDER BY value DESC LIMIT 10`
          );
          return {
            label: q.label,
            type: q.type,
            data: rows.map((r) => ({ label: String(r.label ?? 'N/A'), value: Number(r.value) })),
            doctype: q.doctype,
          };
        } catch {
          return { label: q.label, type: q.type, data: [] as ChartDataPoint[], doctype: q.doctype };
        }
      }),
    );

    return { success: true, cards: cardResults, charts: chartResults };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: true, cards: [], charts: [], error: msg };
  }
}