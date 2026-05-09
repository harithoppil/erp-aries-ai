'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { $Enums } from '@/prisma/client';
import { randomUUID } from 'crypto';
import type { items, warehouses, bins } from '@/prisma/client';

// ── Internal helpers ────────────────────────────────────────────────────────

function toItemGroup(value: string): $Enums.itemgroup {
  const map: Record<string, $Enums.itemgroup> = {
    CONSUMABLE: 'CONSUMABLE',
    EQUIPMENT: 'EQUIPMENT',
    SERVICE: 'SERVICE',
    RAW_MATERIAL: 'RAW_MATERIAL',
    SPARE_PART: 'SPARE_PART',
    Products: 'CONSUMABLE',
    Consumable: 'CONSUMABLE',
    Equipment: 'EQUIPMENT',
    Service: 'SERVICE',
    'Raw Material': 'RAW_MATERIAL',
    'Spare Part': 'SPARE_PART',
  };
  return map[value] || 'CONSUMABLE';
}

function toValuationMethod(value: string): $Enums.stockvaluationmethod {
  if (value === 'Moving Average' || value === 'MOVING_AVERAGE') return 'MOVING_AVERAGE';
  return 'FIFO';
}

async function resolveItemId(codeOrId: string): Promise<string | null> {
  if (!codeOrId) return null;
  const byId = await prisma.items.findUnique({ where: { id: codeOrId }, select: { id: true } });
  if (byId) return byId.id;
  const byCode = await prisma.items.findUnique({ where: { item_code: codeOrId }, select: { id: true } });
  if (byCode) return byCode.id;
  return null;
}

async function resolveWarehouseId(codeOrId: string): Promise<string | null> {
  if (!codeOrId) return null;
  const byId = await prisma.warehouses.findUnique({ where: { id: codeOrId }, select: { id: true } });
  if (byId) return byId.id;
  const byCode = await prisma.warehouses.findUnique({ where: { warehouse_code: codeOrId }, select: { id: true } });
  if (byCode) return byCode.id;
  return null;
}

// ── Exported client-safe types ───────────────────────────────────────────────

export interface ClientSafeItem {
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
}

export interface ClientSafeWarehouse {
  id: string;
  warehouse_name: string;
  warehouse_code: string;
  parent_warehouse: string | null;
  is_group: boolean;
  children?: ClientSafeWarehouse[];
}

export interface ClientSafeStockEntry {
  id: string;
  entry_type: string;
  item_id: string;
  quantity: number;
  source_warehouse: string | null;
  target_warehouse: string | null;
  reference: string | null;
  posting_date: Date;
  created_at: Date;
}

export interface ClientSafeBin {
  id: string;
  item_id: string;
  warehouse_id: string;
  quantity: number;
  valuation_rate: number;
  stock_value: number;
}

// ── Input interfaces ─────────────────────────────────────────────────────────

export interface CreateItemInput {
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
}

export interface UpdateItemInput {
  item_name?: string;
  item_group?: string;
  description?: string;
  unit?: string;
  standard_rate?: number;
  min_order_qty?: number;
  safety_stock?: number;
}

export interface StockEntryItemInput {
  item_code: string;
  qty: number;
  s_warehouse?: string;
  t_warehouse?: string;
  batch_no?: string;
  serial_no?: string;
}

export interface CreateStockEntryInput {
  item_id: string;
  source_warehouse?: string;
  target_warehouse?: string;
  quantity: number;
  entry_type: string;
  reference?: string;
}

export interface StockTransferInput {
  entry_type: string;
  from_warehouse?: string;
  to_warehouse?: string;
  items: StockEntryItemInput[];
  reference?: string;
  posting_date?: string;
}

// ── Standard result types ────────────────────────────────────────────────────

type ItemListResult =
  | { success: true; items: ClientSafeItem[] }
  | { success: false; error: string };

type WarehouseListResult =
  | { success: true; warehouses: ClientSafeWarehouse[] }
  | { success: false; error: string };

type StockEntryListResult =
  | { success: true; entries: ClientSafeStockEntry[] }
  | { success: false; error: string };

type BinListResult =
  | { success: true; bins: ClientSafeBin[] }
  | { success: false; error: string };

type StockBalanceResult =
  | { success: true; actual_qty: number; projected_qty: number }
  | { success: false; error: string };

type ValuationRateResult =
  | { success: true; valuation_rate: number }
  | { success: false; error: string };

type BinUpdateResult =
  | { success: true; bin: ClientSafeBin }
  | { success: false; error: string };

type NegativeStockResult =
  | { success: true; allowed: true }
  | { success: true; allowed: false; error: string }
  | { success: false; error: string };

type WarehouseTreeResult =
  | { success: true; tree: ClientSafeWarehouse[] }
  | { success: false; error: string };

// ── Constants ported from ERPNext ────────────────────────────────────────────

const VALID_STOCK_ENTRY_PURPOSES = [
  'Material Issue',
  'Material Receipt',
  'Material Transfer',
  'Material Transfer for Manufacture',
  'Material Consumption for Manufacture',
  'Manufacture',
  'Repack',
  'Send to Subcontractor',
  'Disassemble',
  'Receive from Customer',
  'Return Raw Material to Customer',
  'Subcontracting Delivery',
  'Subcontracting Return',
] as const;

const SOURCE_MANDATORY_PURPOSES = [
  'Material Issue',
  'Material Transfer',
  'Send to Subcontractor',
  'Material Transfer for Manufacture',
  'Material Consumption for Manufacture',
  'Return Raw Material to Customer',
  'Subcontracting Delivery',
];

const TARGET_MANDATORY_PURPOSES = [
  'Material Receipt',
  'Material Transfer',
  'Send to Subcontractor',
  'Material Transfer for Manufacture',
  'Receive from Customer',
  'Subcontracting Return',
];

const VALID_VALUATION_METHODS = ['FIFO', 'Moving Average', 'LIFO'];

// ── Helpers ──────────────────────────────────────────────────────────────────

function toClientItem(i: items & { bins?: bins[] }): ClientSafeItem {
  const totalQty = i.bins?.reduce((sum, b) => sum + (b.quantity || 0), 0) || 0;
  return {
    id: i.id,
    item_code: i.item_code || i.id,
    item_name: i.item_name || i.item_code,
    item_group: i.item_group || 'Products',
    description: i.description || null,
    unit: i.unit || 'Nos',
    has_batch: i.has_batch,
    has_serial: i.has_serial,
    valuation_method: i.valuation_method === 'MOVING_AVERAGE' ? 'Moving Average' : i.valuation_method,
    standard_rate: i.standard_rate ?? null,
    min_order_qty: i.min_order_qty ?? null,
    safety_stock: i.safety_stock ?? null,
    stock_qty: totalQty,
    reorder_level: i.safety_stock ?? null,
    quantity: totalQty,
    unit_cost: i.standard_rate ?? null,
    created_at: i.created_at,
  };
}

function toClientWarehouse(w: warehouses): ClientSafeWarehouse {
  return {
    id: w.id,
    warehouse_name: w.warehouse_name || w.warehouse_code,
    warehouse_code: w.warehouse_code,
    parent_warehouse: w.parent_warehouse || null,
    is_group: w.is_group,
  };
}

function toClientBin(b: bins): ClientSafeBin {
  return {
    id: b.id,
    item_id: b.item_id,
    warehouse_id: b.warehouse_id,
    quantity: b.quantity || 0,
    valuation_rate: b.valuation_rate || 0,
    stock_value: b.stock_value || 0,
  };
}

// ── Validation: Item ─────────────────────────────────────────────────────────

export type ValidateItemResult =
  | { success: true }
  | { success: false; error: string };

export async function validateItem(
  data: CreateItemInput
): Promise<ValidateItemResult> {
  // 1. item_code uniqueness
  if (!data.item_code || data.item_code.trim().length === 0) {
    return { success: false, error: 'Item Code is mandatory' };
  }

  try {
    const count = await prisma.items.count({
      where: { item_code: data.item_code.trim() },
    });
    if (count > 0) {
      return { success: false, error: `Item Code ${data.item_code} already exists` };
    }
  } catch (error:any) {
    console.error('[stock] validateItem count failed:', error?.message);
    // If count fails, we continue; insert will catch duplicates anyway
  }

  // 2. UOM validation
  if (!data.unit || data.unit.trim().length === 0) {
    return { success: false, error: 'Unit of Measure (UOM) is mandatory' };
  }

  // 3. valuation_method validation
  const method = (data.valuation_method || 'FIFO').trim();
  if (!VALID_VALUATION_METHODS.includes(method)) {
    return {
      success: false,
      error: `Valuation method must be one of: ${VALID_VALUATION_METHODS.join(', ')}`,
    };
  }

  // 4. Serial / batch consistency
  if (data.has_serial && data.has_batch) {
    return { success: false, error: 'Item cannot have both Serial No and Batch No enabled' };
  }

  // 5. standard_rate non-negative
  if (data.standard_rate !== undefined && data.standard_rate < 0) {
    return { success: false, error: 'Standard Rate cannot be negative' };
  }

  return { success: true };
}

// ── Validation: Stock Entry ──────────────────────────────────────────────────

export type ValidateStockEntryResult =
  | { success: true }
  | { success: false; error: string };

export async function validateStockEntry(
  data: StockTransferInput
): Promise<ValidateStockEntryResult> {
  // 1. Purpose validation
  if (!VALID_STOCK_ENTRY_PURPOSES.includes(data.entry_type as (typeof VALID_STOCK_ENTRY_PURPOSES)[number])) {
    return {
      success: false,
      error: `Invalid Stock Entry purpose: ${data.entry_type}. Must be one of: ${VALID_STOCK_ENTRY_PURPOSES.join(', ')}`,
    };
  }

  // 2. Items must be present
  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'At least one item is required for a Stock Entry' };
  }

  for (let idx = 0; idx < data.items.length; idx++) {
    const row = data.items[idx];
    const rowNum = idx + 1;

    // 3. Quantity must be positive
    if (!row.qty || row.qty <= 0) {
      return {
        success: false,
        error: `Row ${rowNum}: Quantity must be a positive number for item ${row.item_code}`,
      };
    }

    // 4. Source warehouse mandatory for issue/transfer/manufacture
    if (SOURCE_MANDATORY_PURPOSES.includes(data.entry_type)) {
      const source = row.s_warehouse || data.from_warehouse;
      if (!source) {
        return {
          success: false,
          error: `Row ${rowNum}: Source warehouse is mandatory for ${data.entry_type}`,
        };
      }
    }

    // 5. Target warehouse mandatory for receipt/transfer/manufacture
    if (TARGET_MANDATORY_PURPOSES.includes(data.entry_type)) {
      const target = row.t_warehouse || data.to_warehouse;
      if (!target) {
        return {
          success: false,
          error: `Row ${rowNum}: Target warehouse is mandatory for ${data.entry_type}`,
        };
      }
    }

    // 6. Source and target cannot be same (except for certain transfer types)
    const sWh = row.s_warehouse || data.from_warehouse;
    const tWh = row.t_warehouse || data.to_warehouse;
    if (sWh && tWh && sWh === tWh && data.entry_type !== 'Material Transfer' && data.entry_type !== 'Material Transfer for Manufacture') {
      return {
        success: false,
        error: `Row ${rowNum}: Source and target warehouse cannot be the same for ${data.entry_type}`,
      };
    }

    // 7. At least one warehouse must be set
    if (!sWh && !tWh) {
      return { success: false, error: `Row ${rowNum}: At least one warehouse is mandatory` };
    }

    // 8. Serial / batch validation
    if (row.serial_no && row.batch_no) {
      return {
        success: false,
        error: `Row ${rowNum}: Item ${row.item_code} cannot have both Serial No and Batch No`,
      };
    }
  }

  return { success: true };
}

// ── Stock Balance (Bin) ──────────────────────────────────────────────────────

export async function getStockBalance(
  itemCode: string,
  warehouse: string
): Promise<StockBalanceResult> {
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    const itemId = await resolveItemId(itemCode);
    const warehouseId = await resolveWarehouseId(warehouse);

    if (!itemId || !warehouseId) {
      return { success: true, actual_qty: 0, projected_qty: 0 };
    }

    const bin = await prisma.bins.findFirst({
      where: { item_id: itemId, warehouse_id: warehouseId },
    });

    if (!bin) {
      return { success: true, actual_qty: 0, projected_qty: 0 };
    }

    return {
      success: true,
      actual_qty: bin.quantity || 0,
      projected_qty: bin.quantity || 0, // Simplified; full projected qty requires ordered/reserved quantities
    };
  } catch (error:any) {
    console.error('[stock] getStockBalance failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock balance' };
  }
}

// ── Item Valuation Rate ──────────────────────────────────────────────────────

export async function getItemValuationRate(
  itemCode: string,
  warehouse: string
): Promise<ValuationRateResult> {
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    const itemId = await resolveItemId(itemCode);
    const warehouseId = await resolveWarehouseId(warehouse);

    if (!itemId || !warehouseId) {
      return { success: true, valuation_rate: 0 };
    }

    const bin = await prisma.bins.findFirst({
      where: { item_id: itemId, warehouse_id: warehouseId },
    });

    if (!bin) {
      return { success: true, valuation_rate: 0 };
    }

    return { success: true, valuation_rate: bin.valuation_rate || 0 };
  } catch (error:any) {
    console.error('[stock] getItemValuationRate failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch valuation rate' };
  }
}

// ── Update Bin ─────────────────────────────────────────────────────────────────

export async function updateBin(
  itemCode: string,
  warehouse: string,
  qtyDelta: number
): Promise<BinUpdateResult> {
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    const itemId = await resolveItemId(itemCode);
    const warehouseId = await resolveWarehouseId(warehouse);

    if (!itemId || !warehouseId) {
      return { success: false, error: 'Item or warehouse not found' };
    }

    const existing = await prisma.bins.findFirst({
      where: { item_id: itemId, warehouse_id: warehouseId },
    });

    if (existing) {
      const newQty = existing.quantity + qtyDelta;
      const valuationRate = existing.valuation_rate || 0;
      const newStockValue = newQty * valuationRate;

      const updated = await prisma.bins.update({
        where: { id: existing.id },
        data: {
          quantity: newQty,
          stock_value: newStockValue,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        bin: {
          id: updated.id,
          item_id: updated.item_id,
          warehouse_id: updated.warehouse_id,
          quantity: updated.quantity,
          valuation_rate: updated.valuation_rate,
          stock_value: updated.stock_value,
        },
      };
    }

    // Create new bin if none exists (mirrors ERPNext get_bin behaviour)
    const newBin = await prisma.bins.create({
      data: {
        id: randomUUID(),
        item_id: itemId,
        warehouse_id: warehouseId,
        quantity: qtyDelta,
        valuation_rate: 0,
        stock_value: 0,
        updated_at: new Date(),
      },
    });

    return {
      success: true,
      bin: {
        id: newBin.id,
        item_id: newBin.item_id,
        warehouse_id: newBin.warehouse_id,
        quantity: newBin.quantity,
        valuation_rate: newBin.valuation_rate,
        stock_value: newBin.stock_value,
      },
    };
  } catch (error:any) {
    console.error('[stock] updateBin failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update bin' };
  }
}

// ── Negative Stock Check ─────────────────────────────────────────────────────

export async function checkNegativeStock(
  itemCode: string,
  warehouse: string,
  requestedQty: number
): Promise<NegativeStockResult> {
  if (!itemCode || !warehouse || requestedQty === undefined) {
    return { success: false, error: 'Item Code, Warehouse and Requested Qty are required' };
  }

  try {
    const balanceResult = await getStockBalance(itemCode, warehouse);
    if (!balanceResult.success) {
      return { success: false, error: (balanceResult as { success: false; error: string }).error };
    }

    const remaining = balanceResult.actual_qty - requestedQty;
    if (remaining < 0) {
      return {
        success: true,
        allowed: false,
        error: `Insufficient stock for ${itemCode} in ${warehouse}. Available: ${balanceResult.actual_qty}, Requested: ${requestedQty}`,
      };
    }

    return { success: true, allowed: true };
  } catch (error:any) {
    console.error('[stock] checkNegativeStock failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to check negative stock' };
  }
}

// ── Make Stock Transfer (high-level Stock Entry with validation) ─────────────

export async function makeStockTransfer(
  data: StockTransferInput
): Promise<{ success: true; entry: ClientSafeStockEntry } | { success: false; error: string }> {
  // 1. Validate business rules first
  const validation = await validateStockEntry(data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  // Resolve warehouses
  const fromWarehouseId = data.from_warehouse ? await resolveWarehouseId(data.from_warehouse) : null;
  const toWarehouseId = data.to_warehouse ? await resolveWarehouseId(data.to_warehouse) : null;

  // Resolve items
  const resolvedItems = await Promise.all(
    data.items.map(async (row) => ({
      ...row,
      item_id: await resolveItemId(row.item_code),
      s_warehouse_id: row.s_warehouse ? await resolveWarehouseId(row.s_warehouse) : null,
      t_warehouse_id: row.t_warehouse ? await resolveWarehouseId(row.t_warehouse) : null,
    }))
  );

  // 2. Negative stock check for outgoing items
  for (const row of resolvedItems) {
    if (row.s_warehouse_id || fromWarehouseId) {
      const sourceWh = row.s_warehouse_id || fromWarehouseId || '';
      const negCheck = await checkNegativeStock(row.item_code, sourceWh, row.qty);
      if (!negCheck.success) {
        return { success: false, error: negCheck.error };
      }
      if (!negCheck.allowed) {
        return { success: false, error: negCheck.error };
      }
    }
  }

  try {
    const entry = await prisma.stock_entries.create({
      data: {
        id: randomUUID(),
        entry_number: `STE-${Date.now()}`,
        entry_type: data.entry_type,
        posting_date: data.posting_date ? new Date(data.posting_date) : new Date(),
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id: toWarehouseId,
        status: 'SUBMITTED',
        currency: 'USD',
        notes: data.reference || null,
        stock_entry_items: {
          create: resolvedItems.map((row) => ({
            id: randomUUID(),
            item_id: row.item_id!,
            item_code: row.item_code,
            qty: row.qty,
            serial_no: row.serial_no || null,
            batch_no: row.batch_no || null,
          })),
        },
      },
      include: { stock_entry_items: true },
    });

    revalidatePath('/erp/stock');
    const firstItem = entry.stock_entry_items[0];
    return {
      success: true,
      entry: {
        id: entry.id,
        entry_type: entry.entry_type,
        item_id: firstItem?.item_id || '',
        quantity: firstItem?.qty || 0,
        source_warehouse: entry.from_warehouse_id,
        target_warehouse: entry.to_warehouse_id,
        reference: entry.notes,
        posting_date: entry.posting_date,
        created_at: entry.created_at,
      },
    };
  } catch (error:any) {
    console.error('[stock] makeStockTransfer failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create stock transfer' };
  }
}

// ── Warehouse Tree ───────────────────────────────────────────────────────────

export async function getWarehouseTree(): Promise<WarehouseTreeResult> {
  try {
    const warehouses = await prisma.warehouses.findMany({
      orderBy: { created_at: 'asc' },
      take: 1000,
    });

    const map = new Map<string, ClientSafeWarehouse>();
    const roots: ClientSafeWarehouse[] = [];

    for (const w of warehouses) {
      const node = toClientWarehouse(w);
      node.children = [];
      map.set(node.id, node);
      map.set(w.warehouse_code, node);
    }

    for (const w of warehouses) {
      const node = map.get(w.id)!;
      if (w.parent_warehouse && map.has(w.parent_warehouse)) {
        const parent = map.get(w.parent_warehouse)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return { success: true, tree: roots };
  } catch (error:any) {
    console.error('[stock] getWarehouseTree failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch warehouse tree' };
  }
}

// ── Items (existing CRUD) ────────────────────────────────────────────────────

export async function listItems(): Promise<ItemListResult> {
  try {
    const items = await prisma.items.findMany({
      include: { bins: true },
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    return {
      success: true,
      items: items.map(toClientItem),
    };
  } catch (error:any) {
    console.error('Error fetching items:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch items' };
  }
}

export async function createItem(
  data: CreateItemInput
): Promise<{ success: true; item: ClientSafeItem } | { success: false; error: string }> {
  // Run ported validation first
  const validation = await validateItem(data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const item = await prisma.items.create({
      data: {
        id: randomUUID(),
        item_code: data.item_code,
        item_name: data.item_name,
        item_group: toItemGroup(data.item_group),
        description: data.description || null,
        unit: data.unit || 'Nos',
        has_batch: data.has_batch || false,
        has_serial: data.has_serial || false,
        valuation_method: toValuationMethod(data.valuation_method || 'FIFO'),
        standard_rate: data.standard_rate ?? null,
        min_order_qty: data.min_order_qty ?? null,
        safety_stock: data.safety_stock ?? null,
      },
    });

    revalidatePath('/erp/stock');
    return {
      success: true,
      item: {
        id: item.id,
        item_code: item.item_code,
        item_name: item.item_name,
        item_group: item.item_group,
        description: item.description,
        unit: item.unit,
        has_batch: item.has_batch,
        has_serial: item.has_serial,
        valuation_method: item.valuation_method === 'MOVING_AVERAGE' ? 'Moving Average' : item.valuation_method,
        standard_rate: item.standard_rate,
        min_order_qty: item.min_order_qty,
        safety_stock: item.safety_stock,
        stock_qty: 0,
        reorder_level: item.safety_stock,
        quantity: 0,
        unit_cost: item.standard_rate,
        created_at: item.created_at,
      },
    };
  } catch (error:any) {
    if (error?.message?.includes('Duplicate')) {
      return { success: false, error: 'Item code already exists' };
    }
    return { success: false, error: error?.message || 'Failed to create item' };
  }
}

export async function updateItem(
  id: string,
  data: UpdateItemInput
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.items.update({
      where: { id },
      data: {
        ...(data.item_name !== undefined && { item_name: data.item_name }),
        ...(data.item_group !== undefined && { item_group: toItemGroup(data.item_group) }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.standard_rate !== undefined && { standard_rate: data.standard_rate }),
        ...(data.min_order_qty !== undefined && { min_order_qty: data.min_order_qty }),
        ...(data.safety_stock !== undefined && { safety_stock: data.safety_stock }),
      },
    });
    revalidatePath('/erp/stock');
    return { success: true };
  } catch (error:any) {
    console.error('[stock] updateItem failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update item' };
  }
}

export async function deleteItem(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await prisma.items.delete({ where: { id } });
    revalidatePath('/erp/stock');
    return { success: true };
  } catch (error:any) {
    console.error('[stock] deleteItem failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete item' };
  }
}

// ── Warehouses (existing CRUD) ───────────────────────────────────────────────

export async function listWarehouses(): Promise<WarehouseListResult> {
  try {
    const warehouses = await prisma.warehouses.findMany({
      take: 500,
    });

    return {
      success: true,
      warehouses: warehouses.map((w) => ({
        id: w.id,
        warehouse_name: w.warehouse_name || w.warehouse_code,
        warehouse_code: w.warehouse_code,
        parent_warehouse: w.parent_warehouse || null,
        is_group: w.is_group,
      })),
    };
  } catch (error:any) {
    return { success: false, error: error?.message || 'Failed to fetch warehouses' };
  }
}

// ── Stock Entries (existing CRUD) ────────────────────────────────────────────

export async function listStockEntries(): Promise<StockEntryListResult> {
  try {
    const entries = await prisma.stock_entries.findMany({
      include: { stock_entry_items: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      entries: entries.map((e) => {
        const firstItem = e.stock_entry_items[0];
        return {
          id: e.id,
          entry_type: e.entry_type || 'Material Issue',
          item_id: firstItem?.item_id || '',
          quantity: firstItem?.qty || 0,
          source_warehouse: e.from_warehouse_id || null,
          target_warehouse: e.to_warehouse_id || null,
          reference: e.notes || null,
          posting_date: e.posting_date,
          created_at: e.created_at,
        };
      }),
    };
  } catch (error:any) {
    console.error('Error fetching stock entries:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock entries' };
  }
}

export async function createStockEntry(
  data: CreateStockEntryInput
): Promise<{ success: true; entry: ClientSafeStockEntry } | { success: false; error: string }> {
  try {
    const itemId = await resolveItemId(data.item_id);
    if (!itemId) {
      return { success: false, error: `Item ${data.item_id} not found` };
    }

    const sourceWhId = data.source_warehouse ? await resolveWarehouseId(data.source_warehouse) : null;
    const targetWhId = data.target_warehouse ? await resolveWarehouseId(data.target_warehouse) : null;

    const entry = await prisma.stock_entries.create({
      data: {
        id: randomUUID(),
        entry_type: data.entry_type,
        posting_date: new Date(),
        from_warehouse_id: sourceWhId,
        to_warehouse_id: targetWhId,
        status: 'SUBMITTED',
        currency: 'USD',
        notes: data.reference || null,
        stock_entry_items: {
          create: {
            id: randomUUID(),
            item_id: itemId,
            item_code: data.item_id,
            qty: data.quantity,
          },
        },
      },
      include: { stock_entry_items: true },
    });

    revalidatePath('/erp/stock');
    const firstItem = entry.stock_entry_items[0];
    return {
      success: true,
      entry: {
        id: entry.id,
        entry_type: entry.entry_type,
        item_id: firstItem?.item_id || '',
        quantity: firstItem?.qty || 0,
        source_warehouse: entry.from_warehouse_id,
        target_warehouse: entry.to_warehouse_id,
        reference: entry.notes,
        posting_date: entry.posting_date,
        created_at: entry.created_at,
      },
    };
  } catch (error:any) {
    console.error('[stock] createStockEntry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create stock entry' };
  }
}

// ── Bins / Stock Levels (existing CRUD) ──────────────────────────────────────

export async function listBins(): Promise<BinListResult> {
  try {
    const bins = await prisma.bins.findMany({
      orderBy: { updated_at: 'asc' },
      take: 1000,
    });

    return {
      success: true,
      bins: bins.map(toClientBin),
    };
  } catch (error:any) {
    console.error('Error fetching bins:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock levels' };
  }
}
