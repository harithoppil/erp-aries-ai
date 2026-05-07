'use server';

import { prisma } from '@/lib/prisma';
import { itemgroup, stockvaluationmethod, stockentrytype } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeItem = {
  id: string;
  item_code: string;
  item_name: string;
  item_group: string;
  description: string | null;
  unit: string;
  has_batch: boolean;
  has_serial: boolean;
  valuation_method: string;
  standard_rate: number | null;
  min_order_qty: number | null;
  safety_stock: number | null;
  stock_qty: number;
  reorder_level: number | null;
  quantity: number;
  unit_cost: number | null;
  created_at: Date;
};

export type ClientSafeWarehouse = {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
};

export type ClientSafeStockEntry = {
  id: string;
  entry_type: string;
  item_id: string;
  quantity: number;
  source_warehouse: string | null;
  target_warehouse: string | null;
  reference: string | null;
  posting_date: Date;
  created_at: Date;
};

export async function listItems(): Promise<
  { success: true; items: ClientSafeItem[] } | { success: false; error: string }
> {
  try {
    const items = await prisma.items.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, items: items.map((i) => ({
      ...i,
      item_group: String(i.item_group),
      valuation_method: String(i.valuation_method),
      stock_qty: 0,
      reorder_level: i.safety_stock,
      quantity: 0,
      unit_cost: i.standard_rate,
    })) };
  } catch (error) {
    console.error('Error fetching items:', error);
    return { success: false, error: 'Failed to fetch items' };
  }
}

export async function listWarehouses(): Promise<
  { success: true; warehouses: ClientSafeWarehouse[] } | { success: false; error: string }
> {
  try {
    const warehouses = await prisma.warehouses.findMany();
    return {
      success: true as const,
      warehouses: warehouses.map((w) => ({
        id: w.id,
        warehouse_name: w.warehouse_name,
        warehouse_code: w.warehouse_code,
      })),
    };
  } catch (error) {
    return { success: false as const, error: 'Failed to fetch warehouses' };
  }
}

export async function listStockEntries(): Promise<
  { success: true; entries: ClientSafeStockEntry[] } | { success: false; error: string }
> {
  try {
    const entries = await prisma.stock_entries.findMany({ orderBy: { created_at: 'desc' } });
    return {
      success: true as const,
      entries: entries.map((e) => ({
        id: e.id,
        entry_type: String(e.entry_type),
        item_id: e.item_id,
        quantity: e.quantity,
        source_warehouse: e.source_warehouse,
        target_warehouse: e.target_warehouse,
        reference: e.reference,
        posting_date: e.posting_date,
        created_at: e.created_at,
      })),
    };
  } catch (error) {
    console.error('Error fetching stock entries:', error);
    return { success: false as const, error: 'Failed to fetch stock entries' };
  }
}

export async function createItem(data: {
  item_code: string;
  item_name: string;
  item_group: string;
  description?: string;
  unit: string;
  has_batch?: boolean;
  has_serial?: boolean;
  valuation_method?: string;
  standard_rate?: number;
  min_order_qty?: number;
  safety_stock?: number;
}) {
  try {
    const item = await prisma.items.create({
      data: {
        id: randomUUID(),
        item_code: data.item_code,
        item_name: data.item_name,
        item_group: data.item_group as itemgroup,
        description: data.description || null,
        unit: data.unit,
        has_batch: data.has_batch || false,
        has_serial: data.has_serial || false,
        valuation_method: (data.valuation_method || 'FIFO') as stockvaluationmethod,
        standard_rate: data.standard_rate || null,
        min_order_qty: data.min_order_qty || null,
        safety_stock: data.safety_stock || null,
      }
    });
    revalidatePath('/erp/stock');
    return { success: true as const, item: { ...item, item_group: String(item.item_group), valuation_method: String(item.valuation_method) } as ClientSafeItem };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'Item code already exists' };
    return { success: false as const, error: 'Failed to create item' };
  }
}

export async function createStockEntry(data: {
  item_id: string;
  source_warehouse?: string;
  target_warehouse?: string;
  quantity: number;
  entry_type: string;
  reference?: string;
}) {
  try {
    const entry = await prisma.stock_entries.create({
      data: {
        id: randomUUID(),
        item_id: data.item_id,
        source_warehouse: data.source_warehouse || null,
        target_warehouse: data.target_warehouse || null,
        quantity: data.quantity,
        entry_type: data.entry_type.toUpperCase() as stockentrytype,
        reference: data.reference || null,
      }
    });
    revalidatePath('/erp/stock');
    return { success: true as const, entry };
  } catch (error) {
    return { success: false as const, error: 'Failed to create stock entry' };
  }
}
