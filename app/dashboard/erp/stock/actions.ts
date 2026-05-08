'use server';

import { revalidatePath } from 'next/cache';
import {
  frappeGetList,
  frappeGetDoc,
  frappeInsertDoc,
  frappeUpdateDoc,
  frappeDeleteDoc,
  frappeSetValue,
  frappeGetCount,
} from '@/lib/frappe-client';

// ── Frappe raw response types (internal) ────────────────────────────────────

interface FrappeItem {
  name: string;
  item_code: string;
  item_name: string;
  item_group: string;
  description: string | null;
  stock_uom: string;
  has_batch_no: 0 | 1;
  has_serial_no: 0 | 1;
  valuation_method: string;
  standard_rate: number | null;
  min_order_qty: number | null;
  safety_stock: number | null;
  creation: string;
}

interface FrappeWarehouse {
  name: string;
  warehouse_name: string;
  parent_warehouse: string | null;
  is_group: 0 | 1;
  lft: number;
  rgt: number;
}

interface FrappeStockEntry {
  name: string;
  stock_entry_type: string;
  creation: string;
  posting_date: string | null;
  from_warehouse: string | null;
  to_warehouse: string | null;
}

interface FrappeBin {
  name: string;
  item_code: string;
  warehouse: string;
  actual_qty: number;
  valuation_rate: number;
  stock_value: number;
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

function toClientItem(i: FrappeItem): ClientSafeItem {
  return {
    id: i.name,
    item_code: i.item_code || i.name,
    item_name: i.item_name || i.item_code,
    item_group: i.item_group || 'Products',
    description: i.description || null,
    unit: i.stock_uom || 'Nos',
    has_batch: !!i.has_batch_no,
    has_serial: !!i.has_serial_no,
    valuation_method: i.valuation_method || 'FIFO',
    standard_rate: i.standard_rate ?? null,
    min_order_qty: i.min_order_qty ?? null,
    safety_stock: i.safety_stock ?? null,
    stock_qty: 0,
    reorder_level: i.safety_stock ?? null,
    quantity: 0,
    unit_cost: i.standard_rate ?? null,
    created_at: i.creation ? new Date(i.creation) : new Date(),
  };
}

function toClientWarehouse(w: FrappeWarehouse): ClientSafeWarehouse {
  return {
    id: w.name,
    warehouse_name: w.warehouse_name || w.name,
    warehouse_code: w.name,
    parent_warehouse: w.parent_warehouse || null,
    is_group: !!w.is_group,
  };
}

function toClientBin(b: FrappeBin): ClientSafeBin {
  return {
    id: b.name,
    item_id: b.item_code,
    warehouse_id: b.warehouse,
    quantity: b.actual_qty || 0,
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
    const count = await frappeGetCount('Item', {
      item_code: data.item_code.trim(),
    });
    if (count > 0) {
      return { success: false, error: `Item Code ${data.item_code} already exists` };
    }
  } catch (error: any) {
    console.error('[stock] validateItem count failed:', error?.message);
    // If count fails, we continue; Frappe insert will catch duplicates anyway
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
    const bins = await frappeGetList<FrappeBin>('Bin', {
      fields: ['name', 'item_code', 'warehouse', 'actual_qty', 'valuation_rate', 'stock_value'],
      filters: { item_code: itemCode, warehouse: warehouse },
      limit_page_length: 1,
    });

    if (!bins || bins.length === 0) {
      return { success: true, actual_qty: 0, projected_qty: 0 };
    }

    const bin = bins[0];
    return {
      success: true,
      actual_qty: bin.actual_qty || 0,
      projected_qty: bin.actual_qty || 0, // Simplified; full projected qty requires ordered/reserved quantities
    };
  } catch (error: any) {
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
    const bins = await frappeGetList<FrappeBin>('Bin', {
      fields: ['valuation_rate'],
      filters: { item_code: itemCode, warehouse: warehouse },
      limit_page_length: 1,
    });

    if (!bins || bins.length === 0) {
      return { success: true, valuation_rate: 0 };
    }

    return { success: true, valuation_rate: bins[0].valuation_rate || 0 };
  } catch (error: any) {
    console.error('[stock] getItemValuationRate failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch valuation rate' };
  }
}

// ── Update Bin ───────────────────────────────────────────────────────────────

export async function updateBin(
  itemCode: string,
  warehouse: string,
  qtyDelta: number
): Promise<BinUpdateResult> {
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    // Find existing bin
    const bins = await frappeGetList<FrappeBin>('Bin', {
      fields: ['name', 'item_code', 'warehouse', 'actual_qty', 'valuation_rate', 'stock_value'],
      filters: { item_code: itemCode, warehouse: warehouse },
      limit_page_length: 1,
    });

    if (bins && bins.length > 0) {
      const bin = bins[0];
      const newQty = (bin.actual_qty || 0) + qtyDelta;
      const valuationRate = bin.valuation_rate || 0;
      const newStockValue = newQty * valuationRate;

      await frappeUpdateDoc('Bin', bin.name, {
        actual_qty: newQty,
        stock_value: newStockValue,
      });

      return {
        success: true,
        bin: {
          id: bin.name,
          item_id: bin.item_code,
          warehouse_id: bin.warehouse,
          quantity: newQty,
          valuation_rate: valuationRate,
          stock_value: newStockValue,
        },
      };
    }

    // Create new bin if none exists (mirrors ERPNext get_bin behaviour)
    const newBin = await frappeInsertDoc<FrappeBin>('Bin', {
      item_code: itemCode,
      warehouse: warehouse,
      actual_qty: qtyDelta,
      valuation_rate: 0,
      stock_value: 0,
    });

    return {
      success: true,
      bin: {
        id: newBin.name,
        item_id: itemCode,
        warehouse_id: warehouse,
        quantity: qtyDelta,
        valuation_rate: 0,
        stock_value: 0,
      },
    };
  } catch (error: any) {
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
  } catch (error: any) {
    console.error('[stock] checkNegativeStock failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to check negative stock' };
  }
}

// ── Make Stock Transfer (high-level Stock Entry with validation) ─────────────

export async function makeStockTransfer(
  data: StockTransferInput
): Promise<{ success: true; entry: FrappeStockEntry } | { success: false; error: string }> {
  // 1. Validate business rules first
  const validation = await validateStockEntry(data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  // 2. Negative stock check for outgoing items
  for (const row of data.items) {
    if (row.s_warehouse || data.from_warehouse) {
      const sourceWh = row.s_warehouse || data.from_warehouse || '';
      const negCheck = await checkNegativeStock(row.item_code, sourceWh, row.qty);
      if (!negCheck.success) {
        return { success: false, error: negCheck.error };
      }
      if (!negCheck.allowed) {
        return { success: false, error: negCheck.error };
      }
    }
  }

  // 3. Build ERPNext-compatible items array
  const items = data.items.map((row) => ({
    item_code: row.item_code,
    qty: row.qty,
    s_warehouse: row.s_warehouse || data.from_warehouse || undefined,
    t_warehouse: row.t_warehouse || data.to_warehouse || undefined,
    batch_no: row.batch_no || undefined,
    serial_no: row.serial_no || undefined,
  }));

  try {
    const entry = await frappeInsertDoc<FrappeStockEntry>('Stock Entry', {
      stock_entry_type: data.entry_type,
      from_warehouse: data.from_warehouse || undefined,
      to_warehouse: data.to_warehouse || undefined,
      items,
      posting_date: data.posting_date || new Date().toISOString().split('T')[0],
      remarks: data.reference || undefined,
    });

    revalidatePath('/erp/stock');
    return { success: true, entry };
  } catch (error: any) {
    console.error('[stock] makeStockTransfer failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create stock transfer' };
  }
}

// ── Warehouse Tree ───────────────────────────────────────────────────────────

export async function getWarehouseTree(): Promise<WarehouseTreeResult> {
  try {
    const warehouses = await frappeGetList<FrappeWarehouse>('Warehouse', {
      fields: ['name', 'warehouse_name', 'parent_warehouse', 'is_group', 'lft', 'rgt'],
      filters: { disabled: 0 },
      order_by: 'lft asc',
      limit_page_length: 1000,
    });

    const map = new Map<string, ClientSafeWarehouse>();
    const roots: ClientSafeWarehouse[] = [];

    for (const w of warehouses) {
      const node = toClientWarehouse(w);
      node.children = [];
      map.set(node.id, node);
    }

    for (const w of warehouses) {
      const node = map.get(w.name)!;
      if (w.parent_warehouse && map.has(w.parent_warehouse)) {
        const parent = map.get(w.parent_warehouse)!;
        parent.children = parent.children || [];
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return { success: true, tree: roots };
  } catch (error: any) {
    console.error('[stock] getWarehouseTree failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch warehouse tree' };
  }
}

// ── Items (existing CRUD) ────────────────────────────────────────────────────

export async function listItems(): Promise<ItemListResult> {
  try {
    const items = await frappeGetList<FrappeItem>('Item', {
      fields: [
        'name',
        'item_code',
        'item_name',
        'item_group',
        'description',
        'stock_uom',
        'has_batch_no',
        'has_serial_no',
        'valuation_method',
        'standard_rate',
        'min_order_qty',
        'safety_stock',
        'creation',
      ],
      order_by: 'creation desc',
      limit_page_length: 500,
    });

    return {
      success: true,
      items: items.map(toClientItem),
    };
  } catch (error: any) {
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
    const item = await frappeInsertDoc<FrappeItem>('Item', {
      item_code: data.item_code,
      item_name: data.item_name,
      item_group: data.item_group,
      description: data.description || '',
      stock_uom: data.unit || 'Nos',
      has_batch_no: data.has_batch || false,
      has_serial_no: data.has_serial || false,
      valuation_method: data.valuation_method || 'FIFO',
      standard_rate: data.standard_rate || 0,
      min_order_qty: data.min_order_qty || 0,
      safety_stock: data.safety_stock || 0,
    });

    revalidatePath('/erp/stock');
    return {
      success: true,
      item: {
        id: item.name,
        item_code: item.item_code,
        item_name: item.item_name,
        item_group: item.item_group,
        description: item.description,
        unit: item.stock_uom,
        has_batch: !!item.has_batch_no,
        has_serial: !!item.has_serial_no,
        valuation_method: item.valuation_method,
        standard_rate: item.standard_rate,
        min_order_qty: item.min_order_qty,
        safety_stock: item.safety_stock,
        stock_qty: 0,
        reorder_level: item.safety_stock,
        quantity: 0,
        unit_cost: item.standard_rate,
        created_at: new Date(),
      },
    };
  } catch (error: any) {
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
    const updateData: Record<string, unknown> = {};
    if (data.item_name !== undefined) updateData.item_name = data.item_name;
    if (data.item_group !== undefined) updateData.item_group = data.item_group;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.unit !== undefined) updateData.stock_uom = data.unit;
    if (data.standard_rate !== undefined) updateData.standard_rate = data.standard_rate;
    if (data.min_order_qty !== undefined) updateData.min_order_qty = data.min_order_qty;
    if (data.safety_stock !== undefined) updateData.safety_stock = data.safety_stock;

    await frappeUpdateDoc('Item', id, updateData);
    revalidatePath('/erp/stock');
    return { success: true };
  } catch (error: any) {
    console.error('[stock] updateItem failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update item' };
  }
}

export async function deleteItem(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await frappeDeleteDoc('Item', id);
    revalidatePath('/erp/stock');
    return { success: true };
  } catch (error: any) {
    console.error('[stock] deleteItem failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete item' };
  }
}

// ── Warehouses (existing CRUD) ───────────────────────────────────────────────

export async function listWarehouses(): Promise<WarehouseListResult> {
  try {
    const warehouses = await frappeGetList<FrappeWarehouse>('Warehouse', {
      fields: ['name', 'warehouse_name'],
      limit_page_length: 500,
    });

    return {
      success: true,
      warehouses: warehouses.map((w) => ({
        id: w.name,
        warehouse_name: w.warehouse_name || w.name,
        warehouse_code: w.name,
        parent_warehouse: null,
        is_group: false,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to fetch warehouses' };
  }
}

// ── Stock Entries (existing CRUD) ────────────────────────────────────────────

export async function listStockEntries(): Promise<StockEntryListResult> {
  try {
    const entries = await frappeGetList<FrappeStockEntry>('Stock Entry', {
      fields: ['name', 'stock_entry_type', 'creation', 'posting_date', 'from_warehouse', 'to_warehouse'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      entries: entries.map((e) => ({
        id: e.name,
        entry_type: e.stock_entry_type || 'Material Issue',
        item_id: '',
        quantity: 0,
        source_warehouse: e.from_warehouse || null,
        target_warehouse: e.to_warehouse || null,
        reference: null,
        posting_date: e.posting_date ? new Date(e.posting_date) : new Date(),
        created_at: e.creation ? new Date(e.creation) : new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching stock entries:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock entries' };
  }
}

export async function createStockEntry(
  data: CreateStockEntryInput
): Promise<{ success: true; entry: FrappeStockEntry } | { success: false; error: string }> {
  try {
    const entry = await frappeInsertDoc<FrappeStockEntry>('Stock Entry', {
      stock_entry_type: data.entry_type,
      items: [
        {
          item_code: data.item_id,
          s_warehouse: data.source_warehouse,
          t_warehouse: data.target_warehouse,
          qty: data.quantity,
        },
      ],
    });

    revalidatePath('/erp/stock');
    return { success: true, entry };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create stock entry' };
  }
}

// ── Bins / Stock Levels (existing CRUD) ──────────────────────────────────────

export async function listBins(): Promise<BinListResult> {
  try {
    const bins = await frappeGetList<FrappeBin>('Bin', {
      fields: ['name', 'item_code', 'warehouse', 'actual_qty', 'valuation_rate', 'stock_value'],
      order_by: 'item_code asc',
      limit_page_length: 1000,
    });

    return {
      success: true,
      bins: bins.map(toClientBin),
    };
  } catch (error: any) {
    console.error('Error fetching bins:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch stock levels' };
  }
}
