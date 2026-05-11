'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Dashboard aggregated data ────────────────────────────────────────────────

export interface StockDashboardData {
  totalStockValue: number;
  warehouseCount: number;
  itemCount: number;
  stockByItemGroup: { item_group: string; stock_value: number }[];
}

export async function getStockDashboardData(): Promise<
  { success: true; data: StockDashboardData } | { success: false; error: string }
> {
  try {
    await requirePermission('Stock Entry', 'read');

    const [warehouseCount, itemCount, bins] = await Promise.all([
      prisma.warehouse.count({ where: { disabled: false } }),
      prisma.item.count({ where: { disabled: false } }),
      prisma.bin.findMany({
        select: {
          stock_value: true,
          item_code: true,
        },
      }),
    ]);

    const totalStockValue = bins.reduce(
      (sum, b) => sum + Number(b.stock_value || 0),
      0,
    );

    // Aggregate stock value by item group via item lookup
    const itemCodes = [...new Set(bins.map((b) => b.item_code))];
    const items = await prisma.item.findMany({
      where: { item_code: { in: itemCodes } },
      select: { item_code: true, item_group: true },
    });

    const itemCodeToGroup = new Map(items.map((i) => [i.item_code, i.item_group]));
    const groupTotals = new Map<string, number>();

    for (const bin of bins) {
      const group = itemCodeToGroup.get(bin.item_code) || 'Other';
      const current = groupTotals.get(group) || 0;
      groupTotals.set(group, current + Number(bin.stock_value || 0));
    }

    const stockByItemGroup = Array.from(groupTotals.entries())
      .map(([item_group, stock_value]) => ({ item_group, stock_value }))
      .sort((a, b) => b.stock_value - a.stock_value)
      .slice(0, 8);

    return {
      success: true,
      data: {
        totalStockValue,
        warehouseCount,
        itemCount,
        stockByItemGroup,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] getStockDashboardData failed:', msg);
    return { success: false, error: msg || 'Failed to fetch dashboard data' };
  }
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
  created_at: Date | null;
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
  posting_date: Date | null;
  created_at: Date | null;
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

// ── Internal helpers ─────────────────────────────────────────────────────────

async function resolveItemName(codeOrId: string): Promise<string | null> {
  if (!codeOrId) return null;
  const byName = await prisma.item.findUnique({ where: { name: codeOrId }, select: { name: true } });
  if (byName) return byName.name;
  const byCode = await prisma.item.findFirst({ where: { item_code: codeOrId }, select: { name: true } });
  if (byCode) return byCode.name;
  return null;
}

async function resolveWarehouseName(codeOrId: string): Promise<string | null> {
  if (!codeOrId) return null;
  const byName = await prisma.warehouse.findUnique({ where: { name: codeOrId }, select: { name: true } });
  if (byName) return byName.name;
  return null;
}

// ── Validation: Item ─────────────────────────────────────────────────────────

export type ValidateItemResult =
  | { success: true }
  | { success: false; error: string };

export async function validateItem(
  data: CreateItemInput,
): Promise<ValidateItemResult> {
  await requirePermission('Stock Entry', 'read');
  if (!data.item_code || data.item_code.trim().length === 0) {
    return { success: false, error: 'Item Code is mandatory' };
  }

  try {
    const count = await prisma.item.count({
      where: { item_code: data.item_code.trim() },
    });
    if (count > 0) {
      return { success: false, error: `Item Code ${data.item_code} already exists` };
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] validateItem count failed:', msg);
  }

  if (!data.unit || data.unit.trim().length === 0) {
    return { success: false, error: 'Unit of Measure (UOM) is mandatory' };
  }

  const method = (data.valuation_method || 'FIFO').trim();
  if (!VALID_VALUATION_METHODS.includes(method)) {
    return {
      success: false,
      error: `Valuation method must be one of: ${VALID_VALUATION_METHODS.join(', ')}`,
    };
  }

  if (data.has_serial && data.has_batch) {
    return { success: false, error: 'Item cannot have both Serial No and Batch No enabled' };
  }

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
  data: StockTransferInput,
): Promise<ValidateStockEntryResult> {
  await requirePermission('Stock Entry', 'read');
  if (!VALID_STOCK_ENTRY_PURPOSES.includes(data.entry_type as (typeof VALID_STOCK_ENTRY_PURPOSES)[number])) {
    return {
      success: false,
      error: `Invalid Stock Entry purpose: ${data.entry_type}. Must be one of: ${VALID_STOCK_ENTRY_PURPOSES.join(', ')}`,
    };
  }

  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'At least one item is required for a Stock Entry' };
  }

  for (let idx = 0; idx < data.items.length; idx++) {
    const row = data.items[idx];
    const rowNum = idx + 1;

    if (!row.qty || row.qty <= 0) {
      return {
        success: false,
        error: `Row ${rowNum}: Quantity must be a positive number for item ${row.item_code}`,
      };
    }

    if (SOURCE_MANDATORY_PURPOSES.includes(data.entry_type)) {
      const source = row.s_warehouse || data.from_warehouse;
      if (!source) {
        return {
          success: false,
          error: `Row ${rowNum}: Source warehouse is mandatory for ${data.entry_type}`,
        };
      }
    }

    if (TARGET_MANDATORY_PURPOSES.includes(data.entry_type)) {
      const target = row.t_warehouse || data.to_warehouse;
      if (!target) {
        return {
          success: false,
          error: `Row ${rowNum}: Target warehouse is mandatory for ${data.entry_type}`,
        };
      }
    }

    const sWh = row.s_warehouse || data.from_warehouse;
    const tWh = row.t_warehouse || data.to_warehouse;
    if (sWh && tWh && sWh === tWh && data.entry_type !== 'Material Transfer' && data.entry_type !== 'Material Transfer for Manufacture') {
      return {
        success: false,
        error: `Row ${rowNum}: Source and target warehouse cannot be the same for ${data.entry_type}`,
      };
    }

    if (!sWh && !tWh) {
      return { success: false, error: `Row ${rowNum}: At least one warehouse is mandatory` };
    }

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
  warehouse: string,
): Promise<StockBalanceResult> {
  await requirePermission('Stock Entry', 'read');
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    const bin = await prisma.bin.findFirst({
      where: { item_code: itemCode, warehouse },
    });

    if (!bin) {
      return { success: true, actual_qty: 0, projected_qty: 0 };
    }

    return {
      success: true,
      actual_qty: bin.actual_qty || 0,
      projected_qty: bin.projected_qty || 0,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] getStockBalance failed:', msg);
    return { success: false, error: msg || 'Failed to fetch stock balance' };
  }
}

// ── Item Valuation Rate ──────────────────────────────────────────────────────

export async function getItemValuationRate(
  itemCode: string,
  warehouse: string,
): Promise<ValuationRateResult> {
  await requirePermission('Stock Entry', 'read');
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    const bin = await prisma.bin.findFirst({
      where: { item_code: itemCode, warehouse },
    });

    if (!bin) {
      return { success: true, valuation_rate: 0 };
    }

    return { success: true, valuation_rate: bin.valuation_rate || 0 };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] getItemValuationRate failed:', msg);
    return { success: false, error: msg || 'Failed to fetch valuation rate' };
  }
}

// ── Update Bin ───────────────────────────────────────────────────────────────

export async function updateBin(
  itemCode: string,
  warehouse: string,
  qtyDelta: number,
): Promise<BinUpdateResult> {
  await requirePermission('Stock Entry', 'update');
  if (!itemCode || !warehouse) {
    return { success: false, error: 'Item Code and Warehouse are required' };
  }

  try {
    const existing = await prisma.bin.findFirst({
      where: { item_code: itemCode, warehouse },
    });

    if (existing) {
      const newQty = (existing.actual_qty || 0) + qtyDelta;
      const valuationRate = existing.valuation_rate || 0;
      const newStockValue = newQty * valuationRate;

      const updated = await prisma.bin.update({
        where: { name: existing.name },
        data: {
          actual_qty: newQty,
          stock_value: newStockValue,
        },
      });

      return {
        success: true,
        bin: {
          id: updated.name,
          item_id: updated.item_code,
          warehouse_id: updated.warehouse,
          quantity: updated.actual_qty || 0,
          valuation_rate: updated.valuation_rate || 0,
          stock_value: updated.stock_value || 0,
        },
      };
    }

    const binName = `BIN-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const newBin = await prisma.bin.create({
      data: {
        name: binName,
        item_code: itemCode,
        warehouse,
        actual_qty: qtyDelta,
        valuation_rate: 0,
        stock_value: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    return {
      success: true,
      bin: {
        id: newBin.name,
        item_id: newBin.item_code,
        warehouse_id: newBin.warehouse,
        quantity: newBin.actual_qty || 0,
        valuation_rate: newBin.valuation_rate || 0,
        stock_value: newBin.stock_value || 0,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] updateBin failed:', msg);
    return { success: false, error: msg || 'Failed to update bin' };
  }
}

// ── Negative Stock Check ─────────────────────────────────────────────────────

export async function checkNegativeStock(
  itemCode: string,
  warehouse: string,
  requestedQty: number,
): Promise<NegativeStockResult> {
  await requirePermission('Stock Entry', 'read');
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] checkNegativeStock failed:', msg);
    return { success: false, error: msg || 'Failed to check negative stock' };
  }
}

// ── Make Stock Transfer ──────────────────────────────────────────────────────

export async function makeStockTransfer(
  data: StockTransferInput,
): Promise<{ success: true; entry: ClientSafeStockEntry } | { success: false; error: string }> {
  await requirePermission('Stock Entry', 'create');
  const validation = await validateStockEntry(data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  const fromWarehouseName = data.from_warehouse ? await resolveWarehouseName(data.from_warehouse) : null;
  const toWarehouseName = data.to_warehouse ? await resolveWarehouseName(data.to_warehouse) : null;

  const resolvedItems = await Promise.all(
    data.items.map(async (row) => ({
      ...row,
      itemName: await resolveItemName(row.item_code),
      sWarehouseName: row.s_warehouse ? await resolveWarehouseName(row.s_warehouse) : null,
      tWarehouseName: row.t_warehouse ? await resolveWarehouseName(row.t_warehouse) : null,
    })),
  );

  for (const row of resolvedItems) {
    if (row.sWarehouseName || fromWarehouseName) {
      const sourceWh = row.sWarehouseName || fromWarehouseName || '';
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
    const entryName = `STE-${Date.now()}`;
    const entry = await prisma.stockEntry.create({
      data: {
        name: entryName,
        stock_entry_type: data.entry_type,
        purpose: data.entry_type,
        posting_date: new Date(),
        from_warehouse: fromWarehouseName,
        to_warehouse: toWarehouseName,
        company: 'Aries',
        naming_series: 'STE-',
        remarks: data.reference || null,
        fg_completed_qty: 0,
        total_incoming_value: 0,
        total_outgoing_value: 0,
        value_difference: 0,
        total_additional_costs: 0,
        per_transferred: 0,
        total_amount: 0,
        process_loss_qty: 0,
        process_loss_percentage: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    for (const row of resolvedItems) {
      await prisma.stockEntryDetail.create({
        data: {
          name: `SED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          parent: entryName,
          parentfield: 'items',
          parenttype: 'Stock Entry',
          item_code: row.item_code,
          item_name: row.item_code,
          qty: row.qty,
          uom: 'Nos',
          conversion_factor: 1,
          stock_uom: 'Nos',
          s_warehouse: row.sWarehouseName || fromWarehouseName || null,
          t_warehouse: row.tWarehouseName || toWarehouseName || null,
          basic_rate: 0,
          basic_amount: 0,
          additional_cost: 0,
          amount: 0,
          valuation_rate: 0,
          transfer_qty: row.qty,
          sample_quantity: 0,
          actual_qty: 0,
          transferred_qty: 0,
          landed_cost_voucher_amount: 0,
          customer_provided_item_cost: 0,
          creation: new Date(),
          modified: new Date(),
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    }

    return {
      success: true,
      entry: {
        id: entry.name,
        entry_type: entry.stock_entry_type || data.entry_type,
        item_id: resolvedItems[0]?.item_code || '',
        quantity: resolvedItems.reduce((s, r) => s + r.qty, 0),
        source_warehouse: entry.from_warehouse,
        target_warehouse: entry.to_warehouse,
        reference: entry.remarks,
        posting_date: entry.posting_date,
        created_at: entry.creation,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] makeStockTransfer failed:', msg);
    return { success: false, error: msg || 'Failed to create stock transfer' };
  }
}

// ── Warehouse Tree ───────────────────────────────────────────────────────────

export async function getWarehouseTree(): Promise<WarehouseTreeResult> {
  try {
    await requirePermission('Stock Entry', 'read');
    const warehouses = await prisma.warehouse.findMany({
      orderBy: { creation: 'asc' },
      take: 1000,
    });

    const map = new Map<string, ClientSafeWarehouse>();
    const roots: ClientSafeWarehouse[] = [];

    for (const w of warehouses) {
      const node: ClientSafeWarehouse = {
        id: w.name,
        warehouse_name: w.warehouse_name || w.name,
        warehouse_code: w.name,
        parent_warehouse: w.parent_warehouse || null,
        is_group: w.is_group || false,
        children: [],
      };
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] getWarehouseTree failed:', msg);
    return { success: false, error: msg || 'Failed to fetch warehouse tree' };
  }
}

// ── Items CRUD ───────────────────────────────────────────────────────────────

export async function listItems(): Promise<ItemListResult> {
  try {
    await requirePermission('Stock Entry', 'read');
    const items = await prisma.item.findMany({
      orderBy: { creation: 'desc' },
      take: 500,
    });

    return {
      success: true,
      items: items.map((i) => ({
        id: i.name,
        item_code: i.item_code || i.name,
        item_name: i.item_name || i.item_code,
        item_group: i.item_group || 'Products',
        description: i.description || null,
        unit: i.stock_uom || 'Nos',
        has_batch: i.has_batch_no || false,
        has_serial: i.has_serial_no || false,
        valuation_method: i.valuation_method || 'FIFO',
        standard_rate: i.standard_rate ? Number(i.standard_rate) : null,
        min_order_qty: i.min_order_qty ?? null,
        safety_stock: i.safety_stock ?? null,
        stock_qty: 0,
        reorder_level: i.safety_stock ?? null,
        quantity: 0,
        unit_cost: i.standard_rate ? Number(i.standard_rate) : null,
        created_at: i.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching items:', msg);
    return { success: false, error: msg || 'Failed to fetch items' };
  }
}

export async function createItem(
  data: CreateItemInput,
): Promise<{ success: true; item: ClientSafeItem } | { success: false; error: string }> {
  await requirePermission('Stock Entry', 'create');
  const validation = await validateItem(data);
  if (!validation.success) {
    return { success: false, error: validation.error };
  }

  try {
    const name = `ITEM-${Date.now()}`;
    const item = await prisma.item.create({
      data: {
        name,
        item_code: data.item_code,
        item_name: data.item_name,
        item_group: data.item_group || 'All Item Groups',
        description: data.description || null,
        stock_uom: data.unit || 'Nos',
        has_batch_no: data.has_batch || false,
        has_serial_no: data.has_serial || false,
        valuation_method: data.valuation_method || 'FIFO',
        standard_rate: data.standard_rate ?? 0,
        min_order_qty: data.min_order_qty ?? 0,
        safety_stock: data.safety_stock ?? 0,
        opening_stock: 0,
        valuation_rate: 0,
        shelf_life_in_days: 0,
        weight_per_unit: 0,
        sample_quantity: 0,
        lead_time_days: 0,
        last_purchase_rate: 0,
        max_discount: 0,
        no_of_months: 0,
        no_of_months_exp: 0,
        total_projected_qty: 0,
        over_delivery_receipt_allowance: 0,
        over_billing_allowance: 0,
        production_capacity: 0,
        is_stock_item: true,
        is_sales_item: true,
        is_purchase_item: true,
        naming_series: 'ITEM-',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    return {
      success: true,
      item: {
        id: item.name,
        item_code: item.item_code,
        item_name: item.item_name || item.item_code,
        item_group: item.item_group,
        description: item.description,
        unit: item.stock_uom || 'Nos',
        has_batch: item.has_batch_no || false,
        has_serial: item.has_serial_no || false,
        valuation_method: item.valuation_method || 'FIFO',
        standard_rate: item.standard_rate ? Number(item.standard_rate) : null,
        min_order_qty: item.min_order_qty,
        safety_stock: item.safety_stock,
        stock_qty: 0,
        reorder_level: item.safety_stock,
        quantity: 0,
        unit_cost: item.standard_rate ? Number(item.standard_rate) : null,
        created_at: item.creation,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Unique') || msg.includes('Duplicate')) {
      return { success: false, error: 'Item code already exists' };
    }
    return { success: false, error: msg || 'Failed to create item' };
  }
}

export async function updateItem(
  id: string,
  data: UpdateItemInput,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission('Stock Entry', 'update');
    const updateData: Record<string, unknown> = {
      modified: new Date(),
      modified_by: 'Administrator',
    };
    if (data.item_name !== undefined) updateData.item_name = data.item_name;
    if (data.item_group !== undefined) updateData.item_group = data.item_group;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.unit !== undefined) updateData.stock_uom = data.unit;
    if (data.standard_rate !== undefined) updateData.standard_rate = data.standard_rate;
    if (data.min_order_qty !== undefined) updateData.min_order_qty = data.min_order_qty;
    if (data.safety_stock !== undefined) updateData.safety_stock = data.safety_stock;

    await prisma.item.update({
      where: { name: id },
      data: updateData,
    });
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] updateItem failed:', msg);
    return { success: false, error: msg || 'Failed to update item' };
  }
}

export async function deleteItem(
  id: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission('Stock Entry', 'delete');
    await prisma.item.delete({ where: { name: id } });
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] deleteItem failed:', msg);
    return { success: false, error: msg || 'Failed to delete item' };
  }
}

// ── Warehouses CRUD ──────────────────────────────────────────────────────────

export async function listWarehouses(): Promise<WarehouseListResult> {
  try {
    await requirePermission('Stock Entry', 'read');
    const warehouses = await prisma.warehouse.findMany({
      take: 500,
    });

    return {
      success: true,
      warehouses: warehouses.map((w) => ({
        id: w.name,
        warehouse_name: w.warehouse_name || w.name,
        warehouse_code: w.name,
        parent_warehouse: w.parent_warehouse || null,
        is_group: w.is_group || false,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, error: msg || 'Failed to fetch warehouses' };
  }
}

// ── Stock Entries CRUD ───────────────────────────────────────────────────────

export async function listStockEntries(): Promise<StockEntryListResult> {
  try {
    await requirePermission('Stock Entry', 'read');
    const entries = await prisma.stockEntry.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    const entriesWithItems = await Promise.all(
      entries.map(async (e) => {
        const items = await prisma.stockEntryDetail.findMany({
          where: { parent: e.name, parenttype: 'Stock Entry' },
          take: 1,
        });
        return { entry: e, firstItem: items[0] || null };
      }),
    );

    return {
      success: true,
      entries: entriesWithItems.map(({ entry, firstItem }) => ({
        id: entry.name,
        entry_type: entry.stock_entry_type || entry.purpose || 'Material Issue',
        item_id: firstItem?.item_code || '',
        quantity: firstItem?.qty || 0,
        source_warehouse: entry.from_warehouse,
        target_warehouse: entry.to_warehouse,
        reference: entry.remarks || null,
        posting_date: entry.posting_date,
        created_at: entry.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching stock entries:', msg);
    return { success: false, error: msg || 'Failed to fetch stock entries' };
  }
}

export async function createStockEntry(
  data: CreateStockEntryInput,
): Promise<{ success: true; entry: ClientSafeStockEntry } | { success: false; error: string }> {
  try {
    await requirePermission('Stock Entry', 'create');
    const sourceWhName = data.source_warehouse ? await resolveWarehouseName(data.source_warehouse) : null;
    const targetWhName = data.target_warehouse ? await resolveWarehouseName(data.target_warehouse) : null;

    const entryName = `STE-${Date.now()}`;
    const entry = await prisma.stockEntry.create({
      data: {
        name: entryName,
        stock_entry_type: data.entry_type,
        purpose: data.entry_type,
        posting_date: new Date(),
        from_warehouse: sourceWhName,
        to_warehouse: targetWhName,
        company: 'Aries',
        naming_series: 'STE-',
        remarks: data.reference || null,
        fg_completed_qty: 0,
        total_incoming_value: 0,
        total_outgoing_value: 0,
        value_difference: 0,
        total_additional_costs: 0,
        per_transferred: 0,
        total_amount: 0,
        process_loss_qty: 0,
        process_loss_percentage: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    await prisma.stockEntryDetail.create({
      data: {
        name: `SED-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        parent: entryName,
        parentfield: 'items',
        parenttype: 'Stock Entry',
        item_code: data.item_id,
        item_name: data.item_id,
        qty: data.quantity,
        uom: 'Nos',
        conversion_factor: 1,
        basic_rate: 0,
        basic_amount: 0,
        additional_cost: 0,
        amount: 0,
        valuation_rate: 0,
        stock_uom: 'Nos',
        transfer_qty: data.quantity,
        sample_quantity: 0,
        actual_qty: 0,
        transferred_qty: 0,
        landed_cost_voucher_amount: 0,
        customer_provided_item_cost: 0,
        s_warehouse: sourceWhName,
        t_warehouse: targetWhName,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    return {
      success: true,
      entry: {
        id: entry.name,
        entry_type: entry.stock_entry_type || data.entry_type,
        item_id: data.item_id,
        quantity: data.quantity,
        source_warehouse: entry.from_warehouse,
        target_warehouse: entry.to_warehouse,
        reference: entry.remarks,
        posting_date: entry.posting_date,
        created_at: entry.creation,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[stock] createStockEntry failed:', msg);
    return { success: false, error: msg || 'Failed to create stock entry' };
  }
}

// ── Bins / Stock Levels CRUD ─────────────────────────────────────────────────

export async function listBins(): Promise<BinListResult> {
  try {
    await requirePermission('Stock Entry', 'read');
    const bins = await prisma.bin.findMany({
      orderBy: { creation: 'asc' },
      take: 1000,
    });

    return {
      success: true,
      bins: bins.map((b) => ({
        id: b.name,
        item_id: b.item_code,
        warehouse_id: b.warehouse,
        quantity: b.actual_qty || 0,
        valuation_rate: b.valuation_rate || 0,
        stock_value: b.stock_value || 0,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching bins:', msg);
    return { success: false, error: msg || 'Failed to fetch stock levels' };
  }
}
