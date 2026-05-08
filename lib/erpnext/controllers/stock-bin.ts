/**
 * Ported from erpnext/stock/doctype/bin/bin.py
 * Pure business logic for Bin (stock balance per item/warehouse) calculations.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BinDoc {
  name?: string;
  item_code: string;
  warehouse: string;
  actual_qty?: number;
  reserved_qty?: number;
  ordered_qty?: number;
  indented_qty?: number;
  planned_qty?: number;
  projected_qty?: number;
  reserved_qty_for_production?: number;
  reserved_qty_for_sub_contract?: number;
  reserved_qty_for_production_plan?: number;
  reserved_stock?: number;
  valuation_rate?: number;
  stock_value?: number;
  stock_uom?: string;
  company?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface BinQtyDelta {
  actual_qty?: number;
  reserved_qty?: number;
  ordered_qty?: number;
  indented_qty?: number;
  planned_qty?: number;
  reserved_qty_for_production?: number;
  reserved_qty_for_sub_contract?: number;
  reserved_qty_for_production_plan?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

/* ------------------------------------------------------------------ */
/*  Projected Qty                                                      */
/* ------------------------------------------------------------------ */

export function calculateProjectedQty(bin: Partial<BinDoc>): number {
  return (
    flt(bin.actual_qty) +
    flt(bin.ordered_qty) +
    flt(bin.indented_qty) +
    flt(bin.planned_qty) -
    flt(bin.reserved_qty) -
    flt(bin.reserved_qty_for_production) -
    flt(bin.reserved_qty_for_sub_contract) -
    flt(bin.reserved_qty_for_production_plan)
  );
}

/* ------------------------------------------------------------------ */
/*  Bin Update                                                         */
/* ------------------------------------------------------------------ */

export function updateBinQty(bin: BinDoc, delta: BinQtyDelta): BinDoc {
  const updated: BinDoc = {
    ...bin,
    actual_qty: flt(bin.actual_qty) + flt(delta.actual_qty),
    reserved_qty: flt(bin.reserved_qty) + flt(delta.reserved_qty),
    ordered_qty: flt(bin.ordered_qty) + flt(delta.ordered_qty),
    indented_qty: flt(bin.indented_qty) + flt(delta.indented_qty),
    planned_qty: flt(bin.planned_qty) + flt(delta.planned_qty),
    reserved_qty_for_production:
      flt(bin.reserved_qty_for_production) + flt(delta.reserved_qty_for_production),
    reserved_qty_for_sub_contract:
      flt(bin.reserved_qty_for_sub_contract) + flt(delta.reserved_qty_for_sub_contract),
    reserved_qty_for_production_plan:
      flt(bin.reserved_qty_for_production_plan) + flt(delta.reserved_qty_for_production_plan),
  };

  updated.projected_qty = calculateProjectedQty(updated);

  if (updated.valuation_rate !== undefined && updated.actual_qty !== undefined) {
    updated.stock_value = flt(updated.actual_qty * updated.valuation_rate);
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Bin Validation                                                     */
/* ------------------------------------------------------------------ */

export function validateBinQty(
  bin: BinDoc,
  requiredQty: number,
  allowNegativeStock = false
): ValidationResult {
  if (allowNegativeStock) {
    return { success: true };
  }

  const actualQty = flt(bin.actual_qty);
  if (actualQty < flt(requiredQty)) {
    return {
      success: false,
      error: `Insufficient stock for ${bin.item_code} in ${bin.warehouse}. Available: ${actualQty}, Required: ${requiredQty}`,
    };
  }

  return { success: true };
}

export function validateBinProjectedQty(
  bin: BinDoc,
  requiredQty: number
): ValidationResult {
  const projectedQty = flt(bin.projected_qty);
  if (projectedQty < flt(requiredQty)) {
    return {
      success: false,
      error: `Projected stock insufficient for ${bin.item_code} in ${bin.warehouse}. Projected: ${projectedQty}, Required: ${requiredQty}`,
    };
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Recalculate Bin                                                    */
/* ------------------------------------------------------------------ */

export function recalculateBin(
  bin: BinDoc,
  args: {
    actual_qty?: number;
    planned_qty?: number;
    indented_qty?: number;
    ordered_qty?: number;
    reserved_qty?: number;
    reserved_qty_for_production?: number;
    reserved_qty_for_sub_contract?: number;
    reserved_qty_for_production_plan?: number;
    valuation_rate?: number;
  }
): BinDoc {
  const updated: BinDoc = {
    ...bin,
    actual_qty: args.actual_qty !== undefined ? flt(args.actual_qty) : flt(bin.actual_qty),
    planned_qty: args.planned_qty !== undefined ? flt(args.planned_qty) : flt(bin.planned_qty),
    indented_qty: args.indented_qty !== undefined ? flt(args.indented_qty) : flt(bin.indented_qty),
    ordered_qty: args.ordered_qty !== undefined ? flt(args.ordered_qty) : flt(bin.ordered_qty),
    reserved_qty: args.reserved_qty !== undefined ? flt(args.reserved_qty) : flt(bin.reserved_qty),
    reserved_qty_for_production:
      args.reserved_qty_for_production !== undefined
        ? flt(args.reserved_qty_for_production)
        : flt(bin.reserved_qty_for_production),
    reserved_qty_for_sub_contract:
      args.reserved_qty_for_sub_contract !== undefined
        ? flt(args.reserved_qty_for_sub_contract)
        : flt(bin.reserved_qty_for_sub_contract),
    reserved_qty_for_production_plan:
      args.reserved_qty_for_production_plan !== undefined
        ? flt(args.reserved_qty_for_production_plan)
        : flt(bin.reserved_qty_for_production_plan),
  };

  if (args.valuation_rate !== undefined) {
    updated.valuation_rate = flt(args.valuation_rate);
  }

  updated.projected_qty = calculateProjectedQty(updated);

  if (updated.valuation_rate !== undefined && updated.actual_qty !== undefined) {
    updated.stock_value = flt(updated.actual_qty * updated.valuation_rate);
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Reserved Qty for Sub-Contracting                                   */
/* ------------------------------------------------------------------ */

export function calculateReservedQtyForSubContract(
  requiredQty: number,
  materialsTransferred: number
): number {
  if (requiredQty > materialsTransferred) {
    return flt(requiredQty - materialsTransferred);
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Bin Detail Helpers                                                 */
/* ------------------------------------------------------------------ */

export function getBinDetails(bin: Partial<BinDoc>): {
  actual_qty: number;
  ordered_qty: number;
  reserved_qty: number;
  indented_qty: number;
  planned_qty: number;
  reserved_qty_for_production: number;
  reserved_qty_for_sub_contract: number;
  reserved_qty_for_production_plan: number;
} {
  return {
    actual_qty: flt(bin.actual_qty),
    ordered_qty: flt(bin.ordered_qty),
    reserved_qty: flt(bin.reserved_qty),
    indented_qty: flt(bin.indented_qty),
    planned_qty: flt(bin.planned_qty),
    reserved_qty_for_production: flt(bin.reserved_qty_for_production),
    reserved_qty_for_sub_contract: flt(bin.reserved_qty_for_sub_contract),
    reserved_qty_for_production_plan: flt(bin.reserved_qty_for_production_plan),
  };
}

export function createBin(
  itemCode: string,
  warehouse: string,
  stockUom?: string,
  company?: string
): BinDoc {
  return {
    item_code: itemCode,
    warehouse,
    actual_qty: 0,
    reserved_qty: 0,
    ordered_qty: 0,
    indented_qty: 0,
    planned_qty: 0,
    projected_qty: 0,
    reserved_qty_for_production: 0,
    reserved_qty_for_sub_contract: 0,
    reserved_qty_for_production_plan: 0,
    reserved_stock: 0,
    valuation_rate: 0,
    stock_value: 0,
    stock_uom: stockUom,
    company,
  };
}
