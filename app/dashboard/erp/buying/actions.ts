'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BuyingDashboardData {
  orderCount: number;
  totalAmount: number;
  avgOrderValue: number;
  chartData: Array<{
    month: string;
    totalAmount: number;
    orderCount: number;
  }>;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getBuyingDashboardData(): Promise<BuyingDashboardData> {
  await requirePermission('Purchase Order', 'read');

  const [orderCount, orders, monthlyOrders] = await Promise.all([
    prisma.purchaseOrder.count({ where: { docstatus: 1 } }),
    prisma.purchaseOrder.findMany({
      where: { docstatus: 1 },
      select: { grand_total: true },
    }),
    prisma.purchaseOrder.findMany({
      where: {
        docstatus: 1,
        transaction_date: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1),
        },
      },
      select: {
        transaction_date: true,
        grand_total: true,
      },
      orderBy: { transaction_date: 'asc' },
    }),
  ]);

  const totalAmount = orders.reduce((sum, o) => sum + Number(o.grand_total || 0), 0);

  // Group by month for chart
  const monthMap = new Map<string, { totalAmount: number; orderCount: number }>();

  for (const order of monthlyOrders) {
    const date = order.transaction_date;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key) || { totalAmount: 0, orderCount: 0 };
    existing.totalAmount += Number(order.grand_total || 0);
    existing.orderCount += 1;
    monthMap.set(key, existing);
  }

  // Build last 12 months of data, filling gaps with zeros
  const chartData: BuyingDashboardData['chartData'] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const data = monthMap.get(key);
    chartData.push({
      month: label,
      totalAmount: data?.totalAmount ?? 0,
      orderCount: data?.orderCount ?? 0,
    });
  }

  return {
    orderCount,
    totalAmount,
    avgOrderValue: orderCount > 0 ? totalAmount / orderCount : 0,
    chartData,
  };
}
