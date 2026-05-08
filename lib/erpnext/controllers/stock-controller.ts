/**
 * Ported from erpnext/controllers/stock_controller.py
 * Stock validation, Bin updates, and FIFO/LIFO valuation skeleton.
 */

import { frappeGetDoc, frappeSetValue, frappeInsertDoc } from "@/lib/frappe-client";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StockItemRow {
  item_code: string;
  item_name?: string;
  qty: number;
  stock_qty?: number;
  rate?: number;
  valuation_rate?: number;
  incoming_rate?: number;
  allow_zero_valuation_rate?: boolean;
  warehouse?: string;
  s_warehouse?: string;
  t_warehouse?: string;
  target_warehouse?: string;
  from_warehouse?: string;
  uom?: string;
  stock_uom?: string;
  conversion_factor?: number;
  serial_no?: string;
  batch_no?: string;
  serial_and_batch_bundle?: string;
  rejected_warehouse?: string;
  rejected_qty?: number;
  is_fixed_asset?: boolean;
  cost_center?: string;
  idx: number;
}

export interface StockEntryDoc {
  doctype: string;
  name?: string;
  company: string;
  posting_date?: string;
  posting_time?: string;
  purpose?:
    | "Material Issue"
    | "Material Receipt"
    | "Material Transfer"
    | "Manufacture"
    | "Repack"
    | "Subcontract"
    | "Material Consumption for Manufacture";
  is_return?: boolean;
  update_stock?: boolean;
  docstatus?: number;
  items: StockItemRow[];
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface BinResult {
  success: boolean;
  item_code?: string;
  warehouse?: string;
  actual_qty?: number;
  projected_qty?: number;
  reserved_qty?: number;
  indented_qty?: number;
  ordered_qty?: number;
  planned_qty?: number;
  valuation_rate?: number;
  stock_value?: number;
  error?: string;
}

export interface ValuationEntry {
  item_code: string;
  warehouse: string;
  qty: number;
  rate: number;
  posting_date: string;
  voucher_type: string;
  voucher_no: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

/* ------------------------------------------------------------------ */
/*  validateStockEntry                                                 */
/* ------------------------------------------------------------------ */

export async function validateStockEntry(doc: StockEntryDoc): Promise<ValidationResult> {
  const warnings: string[] = [];

  try {
    // 1. Items must exist
    const itemCodes = Array.from(new Set(doc.items.map((d) => d.item_code)));
    for (const code of itemCodes) {
      const exists = await frappeGetDoc<{ name: string }>("Item", code);
      if (!exists) {
        return { success: false, error: `Item ${code} does not exist in the Item master.` };
      }
    }

    // 2. Validate warehouse fields present where required
    for (const row of doc.items) {
      if (doc.purpose === "Material Issue" || doc.purpose === "Material Transfer") {
        if (!row.s_warehouse) {
          return { success: false, error: `Row ${row.idx}: Source Warehouse (s_warehouse) is required for ${doc.purpose}` };
        }
      }
      if (doc.purpose === "Material Receipt" || doc.purpose === "Material Transfer") {
        if (!row.t_warehouse) {
          return { success: false, error: `Row ${row.idx}: Target Warehouse (t_warehouse) is required for ${doc.purpose}` };
        }
      }
      if (doc.purpose === "Material Transfer" && row.s_warehouse === row.t_warehouse) {
        return { success: false, error: `Row ${row.idx}: Source and Target Warehouse cannot be same` };
      }
    }

    // 3. Validate conversion factor
    for (const row of doc.items) {
      if (row.uom && row.stock_uom && row.uom === row.stock_uom && row.conversion_factor && row.conversion_factor !== 1.0) {
        warnings.push(
          `Row ${row.idx}: Conversion factor reset to 1.0 because UOM ${row.uom} is same as Stock UOM ${row.stock_uom}`
        );
        row.conversion_factor = 1.0;
      }
      if (!row.conversion_factor) row.conversion_factor = 1.0;
      row.stock_qty = flt(row.qty * row.conversion_factor, 2);
    }

    // 4. Zero rate warning for stock items
    for (const row of doc.items) {
      const isStockItem = await isStockItemMaster(row.item_code);
      if (
        isStockItem &&
        (row.valuation_rate === 0 || row.incoming_rate === 0) &&
        !row.allow_zero_valuation_rate
      ) {
        warnings.push(
          `Row ${row.idx}: Item ${row.item_code} has zero rate but Allow Zero Valuation Rate is not enabled`
        );
      }
    }

    // 5. Validate serialized / batch items
    for (const row of doc.items) {
      if (row.serial_no && row.batch_no) {
        const valid = await validateSerialBelongsToBatch(row.serial_no, row.batch_no);
        if (!valid) {
          return {
            success: false,
            error: `Row ${row.idx}: Serial No does not belong to Batch ${row.batch_no}`,
          };
        }
      }

      if (row.batch_no && doc.posting_date && (doc.docstatus ?? 0) < 2) {
        const expired = await isBatchExpired(row.batch_no, doc.posting_date);
        if (expired) {
          return { success: false, error: `Row ${row.idx}: Batch ${row.batch_no} has already expired.` };
        }
      }
    }

    // 6. Negative stock check
    for (const row of doc.items) {
      const wh = row.s_warehouse ?? row.warehouse;
      if (!wh || doc.purpose === "Material Receipt") continue;

      const bin = await getBinQty(row.item_code, wh);
      if (!bin.success) continue;

      if (flt(bin.actual_qty ?? 0) < flt(row.stock_qty ?? row.qty)) {
        return {
          success: false,
          error: `Row ${row.idx}: Insufficient stock for ${row.item_code} in ${wh}. Available: ${bin.actual_qty}, Required: ${row.stock_qty ?? row.qty}`,
        };
      }
    }

    return { success: true, warnings };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  updateBinQty                                                       */
/* ------------------------------------------------------------------ */

export async function updateBinQty(
  itemCode: string,
  warehouse: string,
  qty: number
): Promise<BinResult> {
  try {
    // Try Frappe first
    const binName = `${itemCode}-${warehouse}`;
    let bin = await frappeGetDoc<{
      name: string;
      actual_qty: number;
      projected_qty: number;
      reserved_qty: number;
      indented_qty: number;
      ordered_qty: number;
      planned_qty: number;
      valuation_rate: number;
      stock_value: number;
    }>("Bin", binName);

    if (bin) {
      const newActual = flt((bin.actual_qty ?? 0) + qty, 2);
      const newProjected = flt((bin.projected_qty ?? 0) + qty, 2);
      const newStockValue = flt(newActual * (bin.valuation_rate ?? 0), 2);

      await frappeSetValue("Bin", binName, {
        actual_qty: newActual,
        projected_qty: newProjected,
        stock_value: newStockValue,
      });

      // Mirror in Prisma cache
      await upsertBinCache(itemCode, warehouse, {
        actual_qty: newActual,
        projected_qty: newProjected,
        valuation_rate: bin.valuation_rate,
        stock_value: newStockValue,
      });

      return {
        success: true,
        item_code: itemCode,
        warehouse,
        actual_qty: newActual,
        projected_qty: newProjected,
        reserved_qty: bin.reserved_qty,
        indented_qty: bin.indented_qty,
        ordered_qty: bin.ordered_qty,
        planned_qty: bin.planned_qty,
        valuation_rate: bin.valuation_rate,
        stock_value: newStockValue,
      };
    }

    // No bin exists — create via Prisma cache (Frappe insert if needed)
    const newBin = await frappeInsertDoc("Bin", {
      item_code: itemCode,
      warehouse,
      actual_qty: qty,
      projected_qty: qty,
      stock_value: 0,
    });

    await upsertBinCache(itemCode, warehouse, {
      actual_qty: qty,
      projected_qty: qty,
      valuation_rate: 0,
      stock_value: 0,
    });

    return {
      success: true,
      item_code: itemCode,
      warehouse,
      actual_qty: qty,
      projected_qty: qty,
      valuation_rate: 0,
      stock_value: 0,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  FIFO / LIFO valuation skeleton                                     */
/* ------------------------------------------------------------------ */

export async function getValuationRateFIFO(
  itemCode: string,
  warehouse: string,
  qty: number
): Promise<{ rate: number; entries: ValuationEntry[] }> {
  try {
    // Fetch Stock Ledger Entries ordered by posting date (FIFO)
    const sleList = await prisma.stockLedgerEntry.findMany({
      where: { item_code: itemCode, warehouse, actual_qty: { gt: 0 } },
      orderBy: { posting_date: "asc" },
      take: 50,
    });

    let remainingQty = qty;
    let totalValue = 0;
    const usedEntries: ValuationEntry[] = [];

    for (const sle of sleList) {
      if (remainingQty <= 0) break;
      const takeQty = Math.min(remainingQty, sle.actual_qty);
      totalValue += takeQty * sle.valuation_rate;
      remainingQty -= takeQty;
      usedEntries.push({
        item_code: itemCode,
        warehouse,
        qty: takeQty,
        rate: sle.valuation_rate,
        posting_date: sle.posting_date.toISOString(),
        voucher_type: sle.voucher_type,
        voucher_no: sle.voucher_no,
      });
    }

    const avgRate = qty > 0 ? flt(totalValue / qty, 2) : 0;
    return { rate: avgRate, entries: usedEntries };
  } catch {
    // Fallback to Frappe direct
    return { rate: 0, entries: [] };
  }
}

export async function getValuationRateLIFO(
  itemCode: string,
  warehouse: string,
  qty: number
): Promise<{ rate: number; entries: ValuationEntry[] }> {
  try {
    const sleList = await prisma.stockLedgerEntry.findMany({
      where: { item_code: itemCode, warehouse, actual_qty: { gt: 0 } },
      orderBy: { posting_date: "desc" },
      take: 50,
    });

    let remainingQty = qty;
    let totalValue = 0;
    const usedEntries: ValuationEntry[] = [];

    for (const sle of sleList) {
      if (remainingQty <= 0) break;
      const takeQty = Math.min(remainingQty, sle.actual_qty);
      totalValue += takeQty * sle.valuation_rate;
      remainingQty -= takeQty;
      usedEntries.push({
        item_code: itemCode,
        warehouse,
        qty: takeQty,
        rate: sle.valuation_rate,
        posting_date: sle.posting_date.toISOString(),
        voucher_type: sle.voucher_type,
        voucher_no: sle.voucher_no,
      });
    }

    const avgRate = qty > 0 ? flt(totalValue / qty, 2) : 0;
    return { rate: avgRate, entries: usedEntries };
  } catch {
    return { rate: 0, entries: [] };
  }
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

async function isStockItemMaster(itemCode: string): Promise<boolean> {
  try {
    const item = await frappeGetDoc<{ is_stock_item: boolean }>("Item", itemCode);
    return item?.is_stock_item ?? false;
  } catch {
    return false;
  }
}

async function validateSerialBelongsToBatch(serialNoStr: string, batchNo: string): Promise<boolean> {
  const serialNos = serialNoStr.split("\n").map((s) => s.trim()).filter(Boolean);
  for (const sn of serialNos) {
    try {
      const serialDoc = await frappeGetDoc<{ batch_no?: string }>("Serial No", sn);
      if (serialDoc?.batch_no && serialDoc.batch_no !== batchNo) {
        return false;
      }
    } catch {
      return false;
    }
  }
  return true;
}

async function isBatchExpired(batchNo: string, postingDate: string): Promise<boolean> {
  try {
    const batch = await frappeGetDoc<{ expiry_date?: string }>("Batch", batchNo);
    if (!batch?.expiry_date) return false;
    return getdate(batch.expiry_date) < getdate(postingDate);
  } catch {
    return false;
  }
}

async function upsertBinCache(
  itemCode: string,
  warehouse: string,
  data: {
    actual_qty: number;
    projected_qty: number;
    valuation_rate: number;
    stock_value: number;
  }
): Promise<void> {
  try {
    await prisma.bin.upsert({
      where: { item_code_warehouse: { item_code: itemCode, warehouse } },
      update: {
        actual_qty: data.actual_qty,
        projected_qty: data.projected_qty,
        valuation_rate: data.valuation_rate,
        stock_value: data.stock_value,
        modified: new Date(),
      },
      create: {
        item_code: itemCode,
        warehouse,
        actual_qty: data.actual_qty,
        projected_qty: data.projected_qty,
        valuation_rate: data.valuation_rate,
        stock_value: data.stock_value,
        reserved_qty: 0,
        ordered_qty: 0,
        indented_qty: 0,
        planned_qty: 0,
      },
    });
  } catch {
    // Prisma model may not exist yet
  }
}

export async function getBinQty(itemCode: string, warehouse: string): Promise<BinResult> {
  try {
    // Prisma cache first
    const cached = await prisma.bin.findUnique({
      where: { item_code_warehouse: { item_code: itemCode, warehouse } },
    });
    if (cached) {
      return {
        success: true,
        item_code: cached.item_code,
        warehouse: cached.warehouse,
        actual_qty: flt(cached.actual_qty),
        projected_qty: flt(cached.projected_qty),
        reserved_qty: flt(cached.reserved_qty),
        indented_qty: flt(cached.indented_qty),
        ordered_qty: flt(cached.ordered_qty),
        planned_qty: flt(cached.planned_qty),
        valuation_rate: flt(cached.valuation_rate),
        stock_value: flt(cached.stock_value),
      };
    }
  } catch {
    // fallback to Frappe
  }

  try {
    const binName = `${itemCode}-${warehouse}`;
    const bin = await frappeGetDoc<{
      actual_qty: number;
      projected_qty: number;
      reserved_qty: number;
      indented_qty: number;
      ordered_qty: number;
      planned_qty: number;
      valuation_rate: number;
      stock_value: number;
    }>("Bin", binName);

    if (!bin) return { success: false, error: `Bin not found for ${itemCode} / ${warehouse}` };

    return {
      success: true,
      item_code: itemCode,
      warehouse,
      actual_qty: flt(bin.actual_qty),
      projected_qty: flt(bin.projected_qty),
      reserved_qty: flt(bin.reserved_qty),
      indented_qty: flt(bin.indented_qty),
      ordered_qty: flt(bin.ordered_qty),
      planned_qty: flt(bin.planned_qty),
      valuation_rate: flt(bin.valuation_rate),
      stock_value: flt(bin.stock_value),
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}
