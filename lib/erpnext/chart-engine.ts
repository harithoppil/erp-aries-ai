'use server';

import { prisma } from '@/lib/prisma';
import { toAccessor, getDelegate } from '@/lib/erpnext/prisma-delegate';

// ── SQL Safety ───────────────────────────────────────────────────────────────

/** Validate a SQL identifier (table/column name) — only allow alphanumeric + underscore */
function isValidSqlIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

/** Escape a SQL string value for use in raw queries */
function escapeSqlValue(value: string): string {
  return value.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface ChartResult {
  success: boolean;
  data?: ChartDataPoint[];
  error?: string;
}

export interface NumberCardResult {
  success: boolean;
  value?: number;
  previousValue?: number;
  trend?: number;
  error?: string;
}

export interface DashboardChartConfig {
  name: string;
  chartName: string;
  chartType: 'Bar' | 'Line' | 'Pie' | 'Donut';
  doctype: string;
  groupField: string;
  valueField?: string;
  aggregation: 'count' | 'sum' | 'avg';
  filtersJson?: string;
  limit: number;
  colorScheme?: string;
  workspace?: string;
}

export interface NumberCardConfig {
  name: string;
  cardName: string;
  doctype: string;
  aggregation: 'count' | 'sum' | 'avg';
  valueField?: string;
  filtersJson?: string;
  workspace?: string;
}

// ── Chart Data Resolution ────────────────────────────────────────────────────

export async function resolveChartData(config: DashboardChartConfig): Promise<ChartResult> {
  try {
    const delegate = getDelegate(prisma, config.doctype);
    if (!delegate) return { success: false, error: `Unknown DocType: ${config.doctype}` };

    const groupBy = config.groupField;
    const accessor = toAccessor(config.doctype);

    if (!isValidSqlIdentifier(groupBy) || !isValidSqlIdentifier(accessor)) {
      return { success: false, error: 'Invalid field or table name' };
    }
    if (config.valueField && !isValidSqlIdentifier(config.valueField)) {
      return { success: false, error: 'Invalid value field name' };
    }

    const where: Record<string, unknown> = {};
    if (config.filtersJson) {
      try {
        const parsed = JSON.parse(config.filtersJson);
        Object.assign(where, parsed);
      } catch { /* ignore invalid JSON */ }
    }

    const aggExpr = config.aggregation === 'sum'
      ? `COALESCE(SUM(CAST("${config.valueField}" AS NUMERIC)), 0)`
      : config.aggregation === 'avg'
        ? `COALESCE(AVG(CAST("${config.valueField}" AS NUMERIC)), 0)`
        : 'COUNT(*)';

    const whereClause = Object.keys(where).length > 0
      ? 'WHERE ' + Object.entries(where).map(([k, v]) => `"${k}" = '${escapeSqlValue(String(v))}'`).join(' AND ')
      : '';

    const query = `
      SELECT "${groupBy}" as label, ${aggExpr} as value
      FROM "${accessor}"
      ${whereClause}
      GROUP BY "${groupBy}"
      ORDER BY value DESC
      LIMIT ${config.limit}
    `;

    const rows = await prisma.$queryRawUnsafe<Array<{ label: string | null; value: number }>>(query);
    const data: ChartDataPoint[] = rows.map((r) => ({
      label: String(r.label ?? 'N/A'),
      value: Number(r.value),
    }));

    return { success: true, data };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Number Card Resolution ───────────────────────────────────────────────────

export async function resolveNumberCard(config: NumberCardConfig): Promise<NumberCardResult> {
  try {
    const delegate = getDelegate(prisma, config.doctype);
    if (!delegate) return { success: false, error: `Unknown DocType: ${config.doctype}` };

    const where: Record<string, unknown> = {};
    if (config.filtersJson) {
      try {
        const parsed = JSON.parse(config.filtersJson);
        Object.assign(where, parsed);
      } catch { /* ignore invalid JSON */ }
    }

    let value: number;
    if (config.aggregation === 'count') {
      value = await delegate.count({ where }) as number;
    } else {
      const accessor = toAccessor(config.doctype);
      if (!isValidSqlIdentifier(accessor) || (config.valueField && !isValidSqlIdentifier(config.valueField))) {
        return { success: false, error: 'Invalid field or table name' };
      }
      const aggExpr = config.aggregation === 'sum'
        ? `COALESCE(SUM(CAST("${config.valueField}" AS NUMERIC)), 0)`
        : `COALESCE(AVG(CAST("${config.valueField}" AS NUMERIC)), 0)`;

      const whereClause = Object.keys(where).length > 0
        ? 'WHERE ' + Object.entries(where).map(([k, v]) => `"${k}" = '${String(v).replace(/'/g, "''")}'`).join(' AND ')
        : '';

      const rows = await prisma.$queryRawUnsafe<Array<{ value: number }>>(
        `SELECT ${aggExpr} as value FROM "${accessor}" ${whereClause}`
      );
      value = Number(rows[0]?.value ?? 0);
    }

    // Calculate trend: current month vs previous month
    let previousValue: number | undefined;
    let trend: number | undefined;
    try {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

      if (config.aggregation === 'count') {
        const trendWhere = { ...where, creation: { gte: lastMonthStart, lt: thisMonthStart } };
        const currentWhere = { ...where, creation: { gte: thisMonthStart } };

        const [prev, curr] = await Promise.all([
          delegate.count({ where: trendWhere }) as Promise<number>,
          delegate.count({ where: currentWhere }) as Promise<number>,
        ]);
        previousValue = prev;
        if (prev > 0) trend = ((curr - prev) / prev) * 100;
      } else {
        const accessor = toAccessor(config.doctype);
        const aggExpr = config.aggregation === 'sum'
          ? `COALESCE(SUM(CAST("${config.valueField}" AS NUMERIC)), 0)`
          : `COALESCE(AVG(CAST("${config.valueField}" AS NUMERIC)), 0)`;

        const [prevRows, currRows] = await Promise.all([
          prisma.$queryRawUnsafe<Array<{ value: number }>>(
            `SELECT ${aggExpr} as value FROM "${accessor}" WHERE "creation" >= '${lastMonthStart.toISOString()}' AND "creation" < '${thisMonthStart.toISOString()}'`
          ),
          prisma.$queryRawUnsafe<Array<{ value: number }>>(
            `SELECT ${aggExpr} as value FROM "${accessor}" WHERE "creation" >= '${thisMonthStart.toISOString()}'`
          ),
        ]);
        previousValue = Number(prevRows[0]?.value ?? 0);
        const currentVal = Number(currRows[0]?.value ?? 0);
        if (previousValue > 0) trend = ((currentVal - previousValue) / previousValue) * 100;
      }
    } catch { /* trend calculation is best-effort */ }

    return { success: true, value, previousValue, trend };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Dashboard Chart CRUD ─────────────────────────────────────────────────────

export async function listDashboardCharts(workspace?: string): Promise<DashboardChartConfig[]> {
  const where: Record<string, unknown> = { enabled: true };
  if (workspace) where.workspace = workspace;

  const charts = await prisma.dashboardChart.findMany({ where, orderBy: { chart_name: 'asc' } });
  return charts.map((c) => ({
    name: c.name,
    chartName: c.chart_name,
    chartType: (c.chart_type as DashboardChartConfig['chartType']) ?? 'Bar',
    doctype: c.doctype,
    groupField: c.group_field,
    valueField: c.value_field ?? undefined,
    aggregation: (c.aggregation as DashboardChartConfig['aggregation']) ?? 'count',
    filtersJson: c.filters_json ?? undefined,
    limit: c.limit,
    colorScheme: c.color_scheme ?? undefined,
    workspace: c.workspace ?? undefined,
  }));
}

export async function createDashboardChart(input: DashboardChartConfig): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    const chart = await prisma.dashboardChart.create({
      data: {
        name: input.name,
        chart_name: input.chartName,
        chart_type: input.chartType,
        doctype: input.doctype,
        group_field: input.groupField,
        value_field: input.valueField ?? null,
        aggregation: input.aggregation,
        filters_json: input.filtersJson ?? null,
        limit: input.limit,
        color_scheme: input.colorScheme ?? null,
        workspace: input.workspace ?? null,
      },
    });
    return { success: true, name: chart.name };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Number Card CRUD ─────────────────────────────────────────────────────────

export async function listNumberCards(workspace?: string): Promise<NumberCardConfig[]> {
  const where: Record<string, unknown> = { enabled: true };
  if (workspace) where.workspace = workspace;

  const cards = await prisma.numberCard.findMany({ where, orderBy: { card_name: 'asc' } });
  return cards.map((c) => ({
    name: c.name,
    cardName: c.card_name,
    doctype: c.doctype,
    aggregation: (c.aggregation as NumberCardConfig['aggregation']) ?? 'count',
    valueField: c.value_field ?? undefined,
    filtersJson: c.filters_json ?? undefined,
    workspace: c.workspace ?? undefined,
  }));
}

export async function createNumberCard(input: NumberCardConfig): Promise<{ success: boolean; name?: string; error?: string }> {
  try {
    const card = await prisma.numberCard.create({
      data: {
        name: input.name,
        card_name: input.cardName,
        doctype: input.doctype,
        aggregation: input.aggregation,
        value_field: input.valueField ?? null,
        filters_json: input.filtersJson ?? null,
        workspace: input.workspace ?? null,
      },
    });
    return { success: true, name: card.name };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

// ── Seed Default Dashboard ───────────────────────────────────────────────────

export async function seedDefaultDashboard(): Promise<{ charts: number; cards: number }> {
  const existingCharts = await prisma.dashboardChart.count();
  const existingCards = await prisma.numberCard.count();
  if (existingCharts > 0 || existingCards > 0) return { charts: 0, cards: 0 };

  const charts = await Promise.all([
    prisma.dashboardChart.create({ data: { name: 'invoices-by-status', chart_name: 'Invoices by Status', chart_type: 'Bar', doctype: 'SalesInvoice', group_field: 'status', aggregation: 'count', limit: 10, workspace: 'Accounts', is_standard: true } }),
    prisma.dashboardChart.create({ data: { name: 'orders-by-status', chart_name: 'Orders by Status', chart_type: 'Bar', doctype: 'SalesOrder', group_field: 'status', aggregation: 'count', limit: 10, workspace: 'Accounts', is_standard: true } }),
    prisma.dashboardChart.create({ data: { name: 'items-by-group', chart_name: 'Items by Group', chart_type: 'Pie', doctype: 'Item', group_field: 'item_group', aggregation: 'count', limit: 10, workspace: 'Stock', is_standard: true } }),
    prisma.dashboardChart.create({ data: { name: 'customers-by-territory', chart_name: 'Customers by Territory', chart_type: 'Donut', doctype: 'Customer', group_field: 'territory', aggregation: 'count', limit: 10, workspace: 'CRM', is_standard: true } }),
  ]);

  const cards = await Promise.all([
    prisma.numberCard.create({ data: { name: 'total-customers', card_name: 'Total Customers', doctype: 'Customer', aggregation: 'count', workspace: 'CRM', is_standard: true } }),
    prisma.numberCard.create({ data: { name: 'total-items', card_name: 'Total Items', doctype: 'Item', aggregation: 'count', workspace: 'Stock', is_standard: true } }),
    prisma.numberCard.create({ data: { name: 'open-invoices', card_name: 'Open Invoices', doctype: 'SalesInvoice', aggregation: 'count', filters_json: '{"status":"Unpaid"}', workspace: 'Accounts', is_standard: true } }),
    prisma.numberCard.create({ data: { name: 'open-orders', card_name: 'Open Orders', doctype: 'SalesOrder', aggregation: 'count', filters_json: '{"status":"Draft"}', workspace: 'Accounts', is_standard: true } }),
    prisma.numberCard.create({ data: { name: 'total-suppliers', card_name: 'Total Suppliers', doctype: 'Supplier', aggregation: 'count', workspace: 'Buying', is_standard: true } }),
    prisma.numberCard.create({ data: { name: 'total-revenue', card_name: 'Total Revenue', doctype: 'SalesInvoice', aggregation: 'sum', value_field: 'grand_total', workspace: 'Accounts', is_standard: true } }),
  ]);

  return { charts: charts.length, cards: cards.length };
}