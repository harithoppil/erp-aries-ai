'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ManufacturingDashboardData {
  openWorkOrders: number;
  wipWorkOrders: number;
  manufacturedItemsValue: number;
}

export interface ProductionTrendPoint {
  month: string;
  producedQty: number;
  orderCount: number;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getManufacturingDashboardData(): Promise<ManufacturingDashboardData> {
  try {
    const [openWorkOrders, wipWorkOrders, valueResult] = await Promise.all([
      prisma.workOrder.count({ where: { status: { in: ['Not Started', 'Draft'] } } }).catch(() => 0),
      prisma.workOrder.count({ where: { status: 'In Process' } }).catch(() => 0),
      prisma.workOrder.aggregate({
        _sum: { total_operating_cost: true },
        where: { status: 'Completed' },
      }).catch(() => ({ _sum: { total_operating_cost: null } })),
    ]);

    return {
      openWorkOrders,
      wipWorkOrders,
      manufacturedItemsValue: Number(valueResult._sum.total_operating_cost) || 0,
    };
  } catch {
    return { openWorkOrders: 0, wipWorkOrders: 0, manufacturedItemsValue: 0 };
  }
}

// ── Trends ──────────────────────────────────────────────────────────────────

export async function getProductionTrends(): Promise<ProductionTrendPoint[]> {
  // Stub trend data — replace with real time-series query
  return [];
}
