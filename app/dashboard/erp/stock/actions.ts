'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StockItemGroup {
  item_group: string;
  stock_value: number;
}

export interface StockDashboardData {
  totalStockValue: number;
  warehouseCount: number;
  itemCount: number;
  stockByItemGroup: StockItemGroup[];
}

export interface StockItemInfo {
  item_code: string;
  item_name: string | null;
  item_group: string;
  standard_rate: number;
  safety_stock: number | null;
}

export interface StockListResult {
  success: boolean;
  items: StockItemInfo[];
  error?: string;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getStockDashboardData(): Promise<{ success: boolean; data: StockDashboardData }> {
  try {
    const [itemCount, warehouseCount] = await Promise.all([
      prisma.item.count({ where: { is_stock_item: true, disabled: false } }).catch(() => 0),
      prisma.warehouse.count({ where: { disabled: false } }).catch(() => 0),
    ]);

    return {
      success: true,
      data: {
        totalStockValue: 0,
        warehouseCount,
        itemCount,
        stockByItemGroup: [],
      },
    };
  } catch {
    return {
      success: false,
      data: { totalStockValue: 0, warehouseCount: 0, itemCount: 0, stockByItemGroup: [] },
    };
  }
}

// ── List Items (for MCP gateway) ───────────────────────────────────────────

export async function listItems(): Promise<StockListResult> {
  try {
    const items = await prisma.item.findMany({
      where: { disabled: false },
      select: {
        item_code: true,
        item_name: true,
        item_group: true,
        standard_rate: true,
        safety_stock: true,
      },
    });

    return {
      success: true,
      items: items.map((i) => ({
        item_code: i.item_code,
        item_name: i.item_name,
        item_group: i.item_group,
        standard_rate: Number(i.standard_rate) || 0,
        safety_stock: i.safety_stock,
      })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, items: [], error: msg };
  }
}
