'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type SellingDashboardData = {
  orderCount: number;
  totalAmount: number;
  avgOrderValue: number;
};

export type SalesTrendPoint = {
  date: string;
  count: number;
  total: number;
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

export async function getSellingDashboardData(): Promise<SellingDashboardData> {
  await requirePermission('Sales Order', 'read');
  const [orderCount, orders] = await Promise.all([
    prisma.salesOrder.count({ where: { docstatus: 1 } }),
    prisma.salesOrder.findMany({
      where: { docstatus: 1 },
      select: { grand_total: true },
    }),
  ]);
  const totalAmount = orders.reduce(
    (sum, o) => sum + Number(o.grand_total || 0),
    0,
  );
  return {
    orderCount,
    totalAmount,
    avgOrderValue: orderCount > 0 ? totalAmount / orderCount : 0,
  };
}

// ── Sales Order Trends (last 12 months) ───────────────────────────────────

export async function getSalesOrderTrends(): Promise<SalesTrendPoint[]> {
  await requirePermission('Sales Order', 'read');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const orders = await prisma.salesOrder.findMany({
    where: {
      docstatus: 1,
      transaction_date: { gte: twelveMonthsAgo },
    },
    select: {
      transaction_date: true,
      grand_total: true,
    },
    orderBy: { transaction_date: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { count: number; total: number }>();

  // Initialize last 12 months with zeros
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { count: 0, total: 0 });
  }

  for (const order of orders) {
    const date = order.transaction_date
      ? new Date(order.transaction_date)
      : null;
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += Number(order.grand_total || 0);
    }
  }

  return Array.from(monthMap.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    total: data.total,
  }));
}
