'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toAccessor, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';
import { Prisma } from '@/prisma/client';

export interface ReportColumn {
  fieldname: string;
  label: string;
  fieldtype: string;
  selected: boolean;
}

export interface ReportFilter {
  fieldname: string;
  operator: string;
  value: string;
}

export interface ReportConfig {
  doctype: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  groupBy: string | null;
  aggregation: 'count' | 'sum' | 'avg' | null;
}

export interface ReportData {
  columns: { fieldname: string; label: string; fieldtype: string }[];
  rows: Record<string, unknown>[];
  totals: Record<string, number | null>;
  chartData: { label: string; value: number }[] | null;
}

export interface ReportResult {
  success: true;
  data: ReportData;
}
export interface ReportError {
  success: false;
  error: string;
}
export type RunReportResult = ReportResult | ReportError;

const NUMERIC_TYPES = new Set(['Int', 'Float', 'Currency', 'Percent']);

export async function runReport(
  config: ReportConfig,
): Promise<RunReportResult> {
  try {
    const delegate = getDelegate(prisma, config.doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${config.doctype}` };
    }

    const selectedColumns = config.columns.filter((c) => c.selected);
    if (selectedColumns.length === 0) {
      return { success: false, error: 'Select at least one column' };
    }

    // Build where clause from filters
    const whereClauses: Record<string, unknown> = { docstatus: { not: 2 } };

    for (const f of config.filters) {
      if (!f.fieldname || !f.value) continue;
      switch (f.operator) {
        case 'equals':
          whereClauses[f.fieldname] = f.value;
          break;
        case 'not_equals':
          whereClauses[f.fieldname] = { not: f.value };
          break;
        case 'contains':
          whereClauses[f.fieldname] = { contains: f.value, mode: 'insensitive' };
          break;
        case 'starts_with':
          whereClauses[f.fieldname] = { startsWith: f.value, mode: 'insensitive' };
          break;
        case 'ends_with':
          whereClauses[f.fieldname] = { endsWith: f.value, mode: 'insensitive' };
          break;
        case 'gt':
          whereClauses[f.fieldname] = { gt: f.value };
          break;
        case 'gte':
          whereClauses[f.fieldname] = { gte: f.value };
          break;
        case 'lt':
          whereClauses[f.fieldname] = { lt: f.value };
          break;
        case 'lte':
          whereClauses[f.fieldname] = { lte: f.value };
          break;
        case 'is_empty':
          whereClauses[f.fieldname] = { in: [null, ''] };
          break;
        case 'is_not_empty':
          whereClauses[f.fieldname] = { not: { in: [null, ''] } };
          break;
      }
    }

    // If groupBy is set, fetch all records then aggregate in JS
    if (config.groupBy && config.aggregation) {
      const aggField = config.aggregation === 'count' ? null : selectedColumns.find((c) => NUMERIC_TYPES.has(c.fieldtype))?.fieldname;

      const selectFields: Record<string, boolean> = { [config.groupBy]: true };
      if (aggField) selectFields[aggField] = true;

      const records = await delegate.findMany({
        where: whereClauses,
        select: selectFields,
        take: 5000,
      }) as Record<string, unknown>[];

      // Group records by the groupBy field value
      const groups = new Map<string, number[]>();
      for (const r of records) {
        const key = String(r[config.groupBy] ?? '(empty)');
        if (!groups.has(key)) groups.set(key, []);
        if (aggField) {
          const v = Number(r[aggField]);
          if (!isNaN(v)) groups.get(key)!.push(v);
        } else {
          groups.get(key)!.push(1);
        }
      }

      const rows: Record<string, unknown>[] = [];
      for (const [label, values] of groups) {
        let aggValue: number;
        if (config.aggregation === 'count') {
          aggValue = values.length;
        } else if (config.aggregation === 'sum') {
          aggValue = values.reduce((s, v) => s + v, 0);
        } else {
          aggValue = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0;
        }
        rows.push({
          [config.groupBy]: label,
          _value: Math.round(aggValue * 100) / 100,
        });
      }

      // Sort
      rows.sort((a, b) => {
        const av = Number(a._value) ?? 0;
        const bv = Number(b._value) ?? 0;
        return config.sortOrder === 'asc' ? av - bv : bv - av;
      });

      const groupField = config.groupBy as string;
      const chartData = rows.map((r) => ({
        label: String(r[groupField] ?? ''),
        value: Number(r._value ?? 0),
      }));

      return {
        success: true,
        data: {
          columns: [
            { fieldname: config.groupBy, label: toDisplayLabel(config.groupBy), fieldtype: 'Data' },
            { fieldname: '_value', label: config.aggregation === 'count' ? 'Count' : `${config.aggregation}(${aggField})`, fieldtype: 'Int' },
          ],
          rows,
          totals: { _value: rows.reduce((s, r) => s + Number(r._value ?? 0), 0) },
          chartData,
        },
      };
    }

    // Regular (non-grouped) query
    const select: Record<string, boolean> = {};
    for (const col of selectedColumns) {
      select[col.fieldname] = true;
    }
    // Always include name
    select.name = true;

    const records = await delegate.findMany({
      where: whereClauses,
      select,
      orderBy: { [config.sortField]: config.sortOrder },
      take: 500,
    }) as Record<string, unknown>[];

    // Compute totals for numeric columns
    const totals: Record<string, number | null> = {};
    for (const col of selectedColumns) {
      if (NUMERIC_TYPES.has(col.fieldtype)) {
        let sum = 0;
        let hasValues = false;
        for (const r of records) {
          const v = Number(r[col.fieldname]);
          if (!isNaN(v)) { sum += v; hasValues = true; }
        }
        totals[col.fieldname] = hasValues ? sum : null;
      }
    }

    return {
      success: true,
      data: {
        columns: selectedColumns.map((c) => ({
          fieldname: c.fieldname,
          label: c.label,
          fieldtype: c.fieldtype,
        })),
        rows: records,
        totals,
        chartData: null,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[runReport]', msg);
    return { success: false, error: 'Failed to run report' };
  }
}
