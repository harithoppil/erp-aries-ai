'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ManufacturingDashboardData = {
  openWorkOrders: number;
  wipWorkOrders: number;
  manufacturedItemsValue: number;
};

export type ProductionTrendPoint = {
  month: string;
  producedQty: number;
  orderCount: number;
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

export async function getManufacturingDashboardData(): Promise<ManufacturingDashboardData> {
  await requirePermission('Work Order', 'read');

  const [openWorkOrders, wipWorkOrders, completedOrders] = await Promise.all([
    prisma.workOrder.count({
      where: {
        status: { in: ['Not Started', 'In Process'] },
        docstatus: 1,
      },
    }),
    prisma.workOrder.count({
      where: {
        status: 'In Process',
        docstatus: 1,
      },
    }),
    prisma.workOrder.findMany({
      where: {
        status: 'Completed',
        docstatus: 1,
      },
      select: { total_operating_cost: true },
    }),
  ]);

  const manufacturedItemsValue = completedOrders.reduce(
    (sum, o) => sum + Number(o.total_operating_cost || 0),
    0,
  );

  return {
    openWorkOrders,
    wipWorkOrders,
    manufacturedItemsValue,
  };
}

// ── Production Trends (last 12 months) ────────────────────────────────────

export async function getProductionTrends(): Promise<ProductionTrendPoint[]> {
  await requirePermission('Work Order', 'read');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const orders = await prisma.workOrder.findMany({
    where: {
      docstatus: 1,
      creation: { gte: twelveMonthsAgo },
    },
    select: {
      creation: true,
      produced_qty: true,
    },
    orderBy: { creation: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { producedQty: number; orderCount: number }>();

  // Initialize last 12 months with zeros
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { producedQty: 0, orderCount: 0 });
  }

  for (const order of orders) {
    const date = order.creation ? new Date(order.creation) : null;
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.orderCount += 1;
      existing.producedQty += Number(order.produced_qty || 0);
    }
  }

  return Array.from(monthMap.entries()).map(([key, data]) => {
    const [year, month] = key.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return {
      month: label,
      producedQty: data.producedQty,
      orderCount: data.orderCount,
    };
  });
}
