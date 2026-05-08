/**
 * Ported from erpnext/manufacturing/doctype/bom/bom.py
 * Pure business logic for Bill of Materials (BOM).
 */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: number | string | boolean | undefined): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  const v = typeof value === "string" ? parseInt(value, 10) : value ?? 0;
  return Number.isNaN(v) ? 0 : v;
}

function cstr(value: unknown): string {
  return value == null ? "" : String(value);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BOMItem {
  idx: number;
  item_code: string;
  item_name?: string;
  bom_no?: string;
  operation?: string;
  operation_row_id?: number;
  qty: number;
  stock_qty?: number;
  uom?: string;
  stock_uom?: string;
  conversion_factor?: number;
  rate?: number;
  base_rate?: number;
  amount?: number;
  base_amount?: number;
  source_warehouse?: string;
  description?: string;
  image?: string;
  include_item_in_manufacturing?: number;
  sourced_by_supplier?: number;
  do_not_explode?: number;
  is_phantom_item?: number;
  is_sub_assembly_item?: number;
  has_variants?: number;
  original_item?: string;
  qty_consumed_per_unit?: number;
}

export interface BOMOperation {
  idx: number;
  operation: string;
  description?: string;
  workstation?: string;
  workstation_type?: string;
  time_in_mins: number;
  hour_rate?: number;
  base_hour_rate?: number;
  operating_cost?: number;
  base_operating_cost?: number;
  batch_size?: number;
  cost_per_unit?: number;
  base_cost_per_unit?: number;
  sequence_id?: number;
  fixed_time?: number;
  set_cost_based_on_bom_qty?: number;
  finished_good?: string;
  finished_good_qty?: number;
  bom_no?: string;
  is_subcontracted?: number;
  is_final_finished_good?: number;
  skip_material_transfer?: number;
  backflush_from_wip_warehouse?: number;
  source_warehouse?: string;
  wip_warehouse?: string;
  fg_warehouse?: string;
  quality_inspection_required?: number;
}

export interface BOMSecondaryItem {
  idx: number;
  item_code: string;
  item_name?: string;
  type?: string;
  qty: number;
  stock_qty?: number;
  uom?: string;
  stock_uom?: string;
  conversion_factor?: number;
  cost_allocation_per?: number;
  process_loss_per?: number;
  process_loss_qty?: number;
  cost?: number;
  base_cost?: number;
  rate?: number;
  description?: string;
  image?: string;
  is_legacy?: number;
}

export interface BOMExplosionItem {
  item_code: string;
  item_name?: string;
  operation?: string;
  source_warehouse?: string;
  description?: string;
  image?: string;
  stock_uom?: string;
  stock_qty: number;
  rate?: number;
  amount?: number;
  qty_consumed_per_unit?: number;
  include_item_in_manufacturing?: number;
  sourced_by_supplier?: number;
  is_sub_assembly_item?: number;
}

export interface BOMDoc {
  name?: string;
  item: string;
  item_name?: string;
  description?: string;
  uom?: string;
  stock_uom?: string;
  quantity: number;
  company: string;
  currency: string;
  conversion_rate?: number;
  price_list_currency?: string;
  plc_conversion_rate?: number;
  rm_cost_as_per?: "Valuation Rate" | "Last Purchase Rate" | "Price List";
  buying_price_list?: string;
  with_operations?: number;
  track_semi_finished_goods?: number;
  transfer_material_against?: "" | "Work Order" | "Job Card";
  routing?: string;
  operations: BOMOperation[];
  items: BOMItem[];
  secondary_items: BOMSecondaryItem[];
  exploded_items?: BOMExplosionItem[];
  operating_cost?: number;
  base_operating_cost?: number;
  raw_material_cost?: number;
  base_raw_material_cost?: number;
  secondary_items_cost?: number;
  base_secondary_items_cost?: number;
  total_cost?: number;
  base_total_cost?: number;
  cost_allocation_per?: number;
  cost_allocation?: number;
  process_loss_percentage?: number;
  process_loss_qty?: number;
  is_active?: number;
  is_default?: number;
  is_phantom_bom?: number;
  docstatus?: number;
  set_rate_of_sub_assembly_item_based_on_bom?: number;
  fg_based_operating_cost?: number;
  operating_cost_per_bom_quantity?: number;
  allow_alternative_item?: number;
  inspection_required?: number;
  quality_inspection_template?: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface ItemMaster {
  item_code: string;
  item_name?: string;
  description?: string;
  stock_uom?: string;
  image?: string;
  default_bom?: string;
  include_item_in_manufacturing?: number;
  is_stock_item?: number;
  is_customer_provided_item?: number;
  is_fixed_asset?: number;
  has_variants?: number;
  is_phantom_item?: number;
  valuation_rate?: number;
  last_purchase_rate?: number;
  must_be_whole_number?: number;
}

export interface BOMLookup {
  name: string;
  item: string;
  currency: string;
  is_active: number;
  docstatus: number;
  quantity: number;
  base_total_cost: number;
  is_phantom_bom?: number;
  with_operations?: number;
  track_semi_finished_goods?: number;
  operations?: BOMOperation[];
  items?: BOMItem[];
  secondary_items?: BOMSecondaryItem[];
  exploded_items?: BOMExplosionItem[];
}

export interface UOMLookup {
  uom: string;
  must_be_whole_number?: number;
}

/* ------------------------------------------------------------------ */
/*  Naming                                                             */
/* ------------------------------------------------------------------ */

export function getNextVersionIndex(existingBoms: string[]): number {
  const delimiters = ["/", "-"];
  const pattern = new RegExp(delimiters.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));
  const bomParts = existingBoms.map((bomName) => bomName.split(pattern));
  const validBomParts = bomParts.filter((x) => x.length > 1 && x[x.length - 1]);

  if (validBomParts.length) {
    const indexes = validBomParts.map((part) => cint(part[part.length - 1]));
    return Math.max(...indexes) + 1;
  }
  return 1;
}

export function generateBOMName(
  item: string,
  existingBoms: string[],
  prefix = "BOM"
): string {
  const index = getNextVersionIndex(existingBoms);
  const suffix = String(index).padStart(3, "0");
  let bomName = `${prefix}-${item}-${suffix}`;

  if (bomName.length > 140) {
    const truncatedLength = 140 - (prefix.length + suffix.length + 2);
    let truncatedItem = item.slice(0, truncatedLength);
    const lastSpace = truncatedItem.lastIndexOf(" ");
    if (lastSpace > 0) truncatedItem = truncatedItem.slice(0, lastSpace);
    bomName = `${prefix}-${truncatedItem}-${suffix}`;
  }
  return bomName;
}

/* ------------------------------------------------------------------ */
/*  validateBOM                                                        */
/* ------------------------------------------------------------------ */

export function validateBOM(
  doc: BOMDoc,
  itemMaster: ItemMaster,
  uomMaster?: UOMLookup,
  existingBOMNames?: string[],
  childBOMLookup?: Map<string, BOMLookup>
): ValidationResult {
  const warnings: string[] = [];

  // Company required
  if (!doc.company) {
    return { success: false, error: "Please select a Company first." };
  }

  // Validate main item
  const mainItemErr = validateMainItem(doc, itemMaster);
  if (mainItemErr) return { success: false, error: mainItemErr };

  // Clear operations if not with_operations
  if (!doc.with_operations) {
    doc.operations = [];
    if (doc.track_semi_finished_goods) doc.track_semi_finished_goods = 0;
  }

  // Clear inspection if not required
  if (!doc.inspection_required) {
    doc.quality_inspection_template = undefined;
  }

  // Validate currency
  const currencyErr = validateBOMCurrency(doc);
  if (currencyErr) return { success: false, error: currencyErr };

  // Set conversion rate
  setConversionRate(doc);
  setPLCConversionRate(doc);

  // Validate UOM integer
  const uomIntErr = validateUOMIsInteger(doc, uomMaster);
  if (uomIntErr) return { success: false, error: uomIntErr };

  // Update stock qty for items
  updateStockQty(doc);

  // Validate materials
  const materialsErr = validateMaterials(doc);
  if (materialsErr) return { success: false, error: materialsErr };

  // Validate operations
  const opsErr = validateOperations(doc);
  if (opsErr) return { success: false, error: opsErr };

  // Calculate cost
  calculateCost(doc, childBOMLookup);

  // Update exploded items (pure computation)
  const exploded = getExplodedItems(doc, childBOMLookup);
  doc.exploded_items = Object.values(exploded);

  // Process loss
  setProcessLossQty(doc);

  // Validate UOMs
  const uomErr = validateUOMs(doc, uomMaster);
  if (uomErr) return { success: false, error: uomErr };

  // Validate secondary items
  const secErr = validateSecondaryItems(doc);
  if (secErr) return { success: false, error: secErr };

  // Cost allocation
  setFGCostAllocation(doc);
  const allocErr = validateTotalCostAllocation(doc);
  if (allocErr) return { success: false, error: allocErr };

  // Validate semi-finished goods
  const sfErr = validateSemiFinishedGoods(doc);
  if (sfErr) return { success: false, error: sfErr };

  // Validate transfer against
  const transferErr = validateTransferAgainst(doc);
  if (transferErr) return { success: false, error: transferErr };

  // Check recursion if child BOMs provided
  if (childBOMLookup && doc.name) {
    const recursionErr = checkRecursion(doc, childBOMLookup);
    if (recursionErr) return { success: false, error: recursionErr };
  }

  return { success: true, warnings };
}

/* ------------------------------------------------------------------ */
/*  validateMainItem                                                   */
/* ------------------------------------------------------------------ */

export function validateMainItem(doc: BOMDoc, itemMaster: ItemMaster): string | undefined {
  if (!itemMaster.item_code) {
    return `Item: ${doc.item} does not exist in the system`;
  }
  doc.description = itemMaster.description || doc.description;
  doc.uom = itemMaster.stock_uom || doc.uom;
  doc.item_name = itemMaster.item_name || doc.item_name;
  if (!doc.quantity || flt(doc.quantity) <= 0) {
    return "Quantity should be greater than 0";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateMaterials                                                  */
/* ------------------------------------------------------------------ */

export function validateMaterials(doc: BOMDoc): string | undefined {
  if (!doc.items || doc.items.length === 0) {
    return "Raw Materials cannot be blank.";
  }

  const items: string[] = [];
  for (const m of doc.items) {
    if (flt(m.qty) <= 0) {
      return `Quantity required for Item ${m.item_code} in row ${m.idx}`;
    }
    items.push(m.item_code);
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateOperations                                                 */
/* ------------------------------------------------------------------ */

export function validateOperations(doc: BOMDoc): string | undefined {
  if (doc.with_operations && doc.docstatus === 1 && (!doc.operations || doc.operations.length === 0)) {
    return "Operations cannot be left blank";
  }

  if (doc.with_operations) {
    for (const d of doc.operations) {
      if (!d.batch_size || d.batch_size <= 0) {
        d.batch_size = 1;
      }
      if (!d.workstation && !d.workstation_type) {
        return `Row ${d.idx}: Workstation or Workstation Type is mandatory for an operation ${d.operation}`;
      }
      if (!d.time_in_mins || d.time_in_mins <= 0) {
        return `Row ${d.idx}: Operation time should be greater than 0 for operation ${d.operation}`;
      }
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  calculateCost                                                      */
/* ------------------------------------------------------------------ */

export function calculateCost(
  doc: BOMDoc,
  childBOMLookup?: Map<string, BOMLookup>
): void {
  calculateOpCost(doc);
  calculateRMCost(doc, childBOMLookup);
  calculateSecondaryItemsCosts(doc);

  const oldCost = flt(doc.total_cost);
  doc.total_cost = flt(
    flt(doc.operating_cost) + flt(doc.raw_material_cost) - flt(doc.secondary_items_cost),
    2
  );
  doc.base_total_cost = flt(
    flt(doc.base_operating_cost) + flt(doc.base_raw_material_cost) - flt(doc.base_secondary_items_cost),
    2
  );

  // cost_updated flag semantics for callers
  if (doc.total_cost !== oldCost) {
    // caller can inspect doc.total_cost vs previous value
  }
}

/* ------------------------------------------------------------------ */
/*  calculateOpCost                                                    */
/* ------------------------------------------------------------------ */

export function calculateOpCost(doc: BOMDoc): void {
  doc.operating_cost = 0;
  doc.base_operating_cost = 0;

  if (doc.with_operations && doc.operations) {
    for (const d of doc.operations) {
      if (d.workstation || d.workstation_type) {
        updateRateAndTime(doc, d);
      }

      let operatingCost = flt(d.operating_cost);
      let baseOperatingCost = flt(d.base_operating_cost);

      if (d.set_cost_based_on_bom_qty) {
        operatingCost = flt(d.cost_per_unit || 0) * flt(doc.quantity);
        baseOperatingCost = flt(d.base_cost_per_unit || 0) * flt(doc.quantity);
      }

      doc.operating_cost = flt(flt(doc.operating_cost) + flt(operatingCost), 2);
      doc.base_operating_cost = flt(flt(doc.base_operating_cost) + flt(baseOperatingCost), 2);
    }
  } else if (doc.fg_based_operating_cost) {
    const totalOperatingCost = flt(doc.quantity) * flt(doc.operating_cost_per_bom_quantity || 0);
    doc.operating_cost = totalOperatingCost;
    doc.base_operating_cost = flt(totalOperatingCost * flt(doc.conversion_rate || 1), 2);
  }
}

/* ------------------------------------------------------------------ */
/*  updateRateAndTime                                                  */
/* ------------------------------------------------------------------ */

export function updateRateAndTime(doc: BOMDoc, row: BOMOperation, hourRate?: number): void {
  if (hourRate !== undefined && (!row.hour_rate || hourRate > 0)) {
    row.hour_rate = flt(
      doc.conversion_rate && hourRate ? hourRate / flt(doc.conversion_rate) : hourRate,
      2
    );
  }

  if (row.hour_rate) {
    row.base_hour_rate = flt(row.hour_rate) * flt(doc.conversion_rate || 1);
    if (row.time_in_mins) {
      row.operating_cost = flt(row.hour_rate) * flt(row.time_in_mins) / 60.0;
      row.base_operating_cost = flt(row.operating_cost) * flt(doc.conversion_rate || 1);
    }
    row.cost_per_unit = flt(row.operating_cost || 0) / (row.batch_size || 1.0);
    row.base_cost_per_unit = flt(row.base_operating_cost || 0) / (row.batch_size || 1.0);
  }
}

/* ------------------------------------------------------------------ */
/*  calculateRMCost                                                    */
/* ------------------------------------------------------------------ */

export function calculateRMCost(
  doc: BOMDoc,
  childBOMLookup?: Map<string, BOMLookup>
): void {
  let totalRmCost = 0;
  let baseTotalRmCost = 0;

  for (const d of doc.items) {
    const rate = getRMRate(doc, d, childBOMLookup);
    d.rate = rate;
    d.base_rate = flt(rate) * flt(doc.conversion_rate || 1);
    d.amount = flt(flt(d.rate) * flt(d.qty), 2);
    d.base_amount = flt(d.amount) * flt(doc.conversion_rate || 1);
    d.qty_consumed_per_unit = flt(d.stock_qty || d.qty) / flt(doc.quantity);

    totalRmCost += d.amount;
    baseTotalRmCost += d.base_amount;
  }

  doc.raw_material_cost = flt(totalRmCost, 2);
  doc.base_raw_material_cost = flt(baseTotalRmCost, 2);
}

/* ------------------------------------------------------------------ */
/*  getRMRate                                                          */
/* ------------------------------------------------------------------ */

export function getRMRate(
  doc: BOMDoc,
  item: BOMItem,
  childBOMLookup?: Map<string, BOMLookup>,
  itemMasterLookup?: Map<string, ItemMaster>
): number {
  if (!doc.rm_cost_as_per) doc.rm_cost_as_per = "Valuation Rate";

  // Customer provided and supplier sourced parts have zero rate
  const itemMaster = itemMasterLookup?.get(item.item_code);
  if (itemMaster?.is_customer_provided_item || item.sourced_by_supplier) {
    return 0;
  }

  if (item.bom_no && (doc.set_rate_of_sub_assembly_item_based_on_bom || item.is_phantom_item)) {
    const childBOM = childBOMLookup?.get(item.bom_no);
    if (childBOM) {
      const unitCost = flt(childBOM.base_total_cost) / flt(childBOM.quantity || 1);
      return flt(unitCost) * flt(item.conversion_factor || 1);
    }
  }

  // Fallback: use item's valuation rate or last purchase rate
  let rate = 0;
  if (itemMaster) {
    if (doc.rm_cost_as_per === "Valuation Rate") {
      rate = flt(itemMaster.valuation_rate);
    } else if (doc.rm_cost_as_per === "Last Purchase Rate") {
      rate = flt(itemMaster.last_purchase_rate);
    }
  }

  return flt(rate) * flt(doc.plc_conversion_rate || 1) / flt(doc.conversion_rate || 1);
}

/* ------------------------------------------------------------------ */
/*  calculateSecondaryItemsCosts                                       */
/* ------------------------------------------------------------------ */

export function calculateSecondaryItemsCosts(doc: BOMDoc): void {
  let totalSmCost = 0;
  let baseTotalSmCost = 0;
  const precision = 2;

  for (const d of doc.secondary_items) {
    if (!d.is_legacy) {
      d.cost = flt(flt(doc.raw_material_cost || 0) * (flt(d.cost_allocation_per || 0) / 100), precision);
      d.base_cost = flt(d.cost * flt(doc.conversion_rate || 1), precision);

      totalSmCost += d.cost;
      baseTotalSmCost += d.base_cost;
    }
  }

  doc.secondary_items_cost = flt(totalSmCost, precision);
  doc.base_secondary_items_cost = flt(baseTotalSmCost, precision);
}

/* ------------------------------------------------------------------ */
/*  setProcessLossQty                                                  */
/* ------------------------------------------------------------------ */

export function setProcessLossQty(doc: BOMDoc): void {
  if (doc.process_loss_percentage) {
    doc.process_loss_qty = flt(doc.quantity) * flt(doc.process_loss_percentage) / 100;
  }

  for (const item of doc.secondary_items) {
    item.process_loss_qty = flt(
      flt(item.stock_qty || item.qty) * (flt(item.process_loss_per || 0) / 100),
      2
    );
  }
}

/* ------------------------------------------------------------------ */
/*  validateUOMs / validateUOM                                         */
/* ------------------------------------------------------------------ */

export function validateUOMs(doc: BOMDoc, uomMaster?: UOMLookup): string | undefined {
  const uom = doc.uom || doc.stock_uom;
  if (uomMaster && uomMaster.uom === uom) {
    const err = validateUOM(
      doc.item,
      uom,
      doc.process_loss_percentage,
      doc.process_loss_qty,
      uomMaster.must_be_whole_number
    );
    if (err) return err;
  }

  for (const item of doc.secondary_items) {
    const stockUOM = item.stock_uom;
    // callers should pass per-item UOM lookup if needed
    const err = validateUOM(
      item.item_code,
      stockUOM,
      item.process_loss_per,
      item.process_loss_qty,
      undefined
    );
    if (err) return err;
  }
  return undefined;
}

export function validateUOM(
  itemCode: string,
  uom: string | undefined,
  processLossPer: number | undefined,
  processLossQty: number | undefined,
  mustBeWholeNumber?: number
): string | undefined {
  if (processLossPer && processLossPer > 100) {
    return "Process Loss Percentage cannot be greater than 100";
  }

  if (processLossQty && mustBeWholeNumber && processLossQty % 1 !== 0) {
    return `Item: ${itemCode} with Stock UOM: ${uom} can't have fractional process loss qty as UOM ${uom} is a whole Number.`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateUOMIsInteger                                               */
/* ------------------------------------------------------------------ */

export function validateUOMIsInteger(
  doc: BOMDoc,
  uomMaster?: UOMLookup
): string | undefined {
  if (uomMaster && uomMaster.must_be_whole_number && doc.items) {
    for (const item of doc.items) {
      if (item.uom === uomMaster.uom && item.qty && item.qty % 1 !== 0) {
        return `Row ${item.idx}: Quantity (${item.qty}) cannot be a fraction for UOM ${item.uom}`;
      }
      if (item.stock_uom === uomMaster.uom && item.stock_qty && item.stock_qty % 1 !== 0) {
        return `Row ${item.idx}: Stock Quantity (${item.stock_qty}) cannot be a fraction for Stock UOM ${item.stock_uom}`;
      }
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateSecondaryItems                                             */
/* ------------------------------------------------------------------ */

export function validateSecondaryItems(doc: BOMDoc): string | undefined {
  for (const item of doc.secondary_items) {
    if (!item.qty || flt(item.qty) <= 0) {
      return `Row #${item.idx}: Quantity should be greater than 0 for ${item.type || ""} Item ${item.item_code}`;
    }
    if (flt(item.process_loss_per) >= 100) {
      return `Row #${item.idx}: Process Loss Percentage should be less than 100% for ${item.type || ""} Item ${item.item_code}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateSemiFinishedGoods                                          */
/* ------------------------------------------------------------------ */

export function validateSemiFinishedGoods(doc: BOMDoc): string | undefined {
  if (!doc.track_semi_finished_goods || !doc.operations || doc.operations.length === 0) {
    return undefined;
  }

  const fgItems: string[] = [];
  for (const row of doc.operations) {
    if (row.is_final_finished_good) {
      fgItems.push(row.finished_good || "");
    }
  }

  if (fgItems.length === 0) {
    return "Since you have enabled 'Track Semi Finished Goods', at least one operation must have 'Is Final Finished Good' checked.";
  }
  if (fgItems.length > 1) {
    return "Only one operation can have 'Is Final Finished Good' checked when 'Track Semi Finished Goods' is enabled.";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateTotalCostAllocation                                        */
/* ------------------------------------------------------------------ */

export function validateTotalCostAllocation(doc: BOMDoc): string | undefined {
  let totalCostAllocationPer = flt(doc.cost_allocation_per || 100);
  for (const item of doc.secondary_items) {
    totalCostAllocationPer += flt(item.cost_allocation_per || 0);
  }

  if (totalCostAllocationPer !== 100) {
    return "Cost allocation between finished goods and secondary items should equal 100%";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  setFGCostAllocation                                                */
/* ------------------------------------------------------------------ */

export function setFGCostAllocation(doc: BOMDoc): void {
  let totalSecondaryItemsPer = 0;
  for (const item of doc.secondary_items) {
    totalSecondaryItemsPer += flt(item.cost_allocation_per || 0);
  }

  if ((doc.cost_allocation_per || 100) === 100 && totalSecondaryItemsPer) {
    doc.cost_allocation_per = 100 - totalSecondaryItemsPer;
  }

  doc.cost_allocation = flt(doc.raw_material_cost || 0) * (flt(doc.cost_allocation_per || 100) / 100);
}

/* ------------------------------------------------------------------ */
/*  validateTransferAgainst                                            */
/* ------------------------------------------------------------------ */

export function validateTransferAgainst(doc: BOMDoc): string | undefined {
  if (!doc.with_operations) {
    doc.transfer_material_against = "Work Order";
  }
  if (!doc.transfer_material_against && !doc.track_semi_finished_goods) {
    return "Setting Transfer Material Against is required";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateBOMCurrency                                                */
/* ------------------------------------------------------------------ */

export function validateBOMCurrency(doc: BOMDoc): string | undefined {
  if (doc.rm_cost_as_per === "Price List" && doc.buying_price_list) {
    // Pure logic: caller should validate price_list_currency matches doc.currency or company_currency
    // We just ensure the field is present
    if (!doc.price_list_currency) {
      return "Price List Currency is required when Rate of Materials Based On is Price List";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  setConversionRate                                                  */
/* ------------------------------------------------------------------ */

export function setConversionRate(doc: BOMDoc): void {
  if (doc.currency === doc.company) {
    // In pure logic, company currency is passed externally; default to 1 if same
    doc.conversion_rate = 1;
  } else if (!doc.conversion_rate || flt(doc.conversion_rate) <= 0) {
    doc.conversion_rate = 1; // caller should fetch exchange rate externally
  }
}

/* ------------------------------------------------------------------ */
/*  setPLCConversionRate                                               */
/* ------------------------------------------------------------------ */

export function setPLCConversionRate(doc: BOMDoc): void {
  if (doc.rm_cost_as_per === "Valuation Rate" || doc.rm_cost_as_per === "Last Purchase Rate") {
    doc.plc_conversion_rate = 1;
  } else if (!doc.plc_conversion_rate && doc.price_list_currency) {
    doc.plc_conversion_rate = 1; // caller should fetch exchange rate externally
  }
}

/* ------------------------------------------------------------------ */
/*  updateStockQty                                                     */
/* ------------------------------------------------------------------ */

export function updateStockQty(doc: BOMDoc): void {
  for (const m of [...doc.items, ...doc.secondary_items]) {
    if (!m.conversion_factor) m.conversion_factor = 1;
    if (m.uom && (m.qty || m.qty === 0)) {
      m.stock_qty = flt(m.conversion_factor) * flt(m.qty);
    }
    if (!m.uom && m.stock_uom) {
      m.uom = m.stock_uom;
      m.qty = m.stock_qty;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  getExplodedItems                                                   */
/* ------------------------------------------------------------------ */

export function getExplodedItems(
  doc: BOMDoc,
  childBOMLookup?: Map<string, BOMLookup>
): Record<string, BOMExplosionItem> {
  const exploded: Record<string, BOMExplosionItem> = {};

  for (const d of doc.items) {
    if (d.bom_no && childBOMLookup) {
      const childItems = getChildExplodedItems(d.bom_no, flt(d.stock_qty || d.qty), d.operation, childBOMLookup);
      for (const child of childItems) {
        const key = child.operation ? `${child.item_code}-${child.operation}` : child.item_code;
        if (exploded[key]) {
          exploded[key].stock_qty = flt(exploded[key].stock_qty) + flt(child.stock_qty);
        } else {
          exploded[key] = child;
        }
      }
    } else if (d.item_code) {
      const key = d.operation ? `${d.item_code}-${d.operation}` : d.item_code;
      const rate = flt(d.base_rate || d.rate || 0) / (flt(d.conversion_factor || 1) || 1.0);
      if (exploded[key]) {
        exploded[key].stock_qty = flt(exploded[key].stock_qty) + flt(d.stock_qty || d.qty);
      } else {
        exploded[key] = {
          item_code: d.item_code,
          item_name: d.item_name,
          operation: d.operation,
          is_sub_assembly_item: d.is_sub_assembly_item,
          source_warehouse: d.source_warehouse,
          description: d.description,
          image: d.image,
          stock_uom: d.stock_uom,
          stock_qty: flt(d.stock_qty || d.qty),
          rate,
          include_item_in_manufacturing: cint(d.include_item_in_manufacturing),
          sourced_by_supplier: cint(d.sourced_by_supplier),
        };
      }
    }
  }

  // Set amount and qty_consumed_per_unit
  for (const key of Object.keys(exploded)) {
    const row = exploded[key];
    row.amount = flt(flt(row.stock_qty) * flt(row.rate || 0));
    row.qty_consumed_per_unit = flt(row.stock_qty) / flt(doc.quantity || 1);
  }

  return exploded;
}

/* ------------------------------------------------------------------ */
/*  getChildExplodedItems                                              */
/* ------------------------------------------------------------------ */

export function getChildExplodedItems(
  bomNo: string,
  stockQty: number,
  operation: string | undefined,
  childBOMLookup: Map<string, BOMLookup>
): BOMExplosionItem[] {
  const bom = childBOMLookup.get(bomNo);
  if (!bom || !bom.exploded_items) return [];

  const result: BOMExplosionItem[] = [];
  for (const d of bom.exploded_items) {
    const qtyPerUnit = flt(d.stock_qty) / flt(bom.quantity || 1);
    result.push({
      item_code: d.item_code,
      item_name: d.item_name,
      source_warehouse: d.source_warehouse,
      operation: d.operation || operation,
      description: d.description,
      stock_uom: d.stock_uom,
      stock_qty: qtyPerUnit * stockQty,
      rate: flt(d.rate || 0),
      include_item_in_manufacturing: cint(d.include_item_in_manufacturing),
      sourced_by_supplier: cint(d.sourced_by_supplier),
      is_sub_assembly_item: cint(d.is_sub_assembly_item),
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  checkRecursion                                                     */
/* ------------------------------------------------------------------ */

export function checkRecursion(doc: BOMDoc, childBOMLookup: Map<string, BOMLookup>): string | undefined {
  if (!doc.name) return undefined;

  const bomList = traverseTree(doc.name, childBOMLookup);

  for (const bomName of bomList) {
    const bom = childBOMLookup.get(bomName);
    if (!bom) continue;
    for (const item of bom.items || []) {
      if (doc.name === item.bom_no) {
        return `BOM recursion: ${doc.name} cannot be parent or child of ${bomName}`;
      }
      if (doc.item === item.item_code && item.bom_no) {
        return `BOM recursion: ${item.bom_no} cannot be parent or child of ${doc.name}`;
      }
    }
  }

  for (const item of doc.items) {
    if (doc.name === item.bom_no) {
      return `BOM recursion: ${doc.name} cannot be parent or child of itself`;
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  traverseTree                                                       */
/* ------------------------------------------------------------------ */

export function traverseTree(
  rootBOM: string,
  childBOMLookup: Map<string, BOMLookup>
): string[] {
  const bomList: string[] = [];

  function getChildren(bomNo: string): string[] {
    const bom = childBOMLookup.get(bomNo);
    if (!bom || !bom.items) return [];
    return bom.items
      .map((item) => item.bom_no)
      .filter((bomNo): bomNo is string => !!bomNo);
  }

  if (!bomList.includes(rootBOM)) bomList.push(rootBOM);

  let count = 0;
  while (count < bomList.length) {
    for (const childBom of getChildren(bomList[count])) {
      if (!bomList.includes(childBom)) bomList.push(childBom);
    }
    count += 1;
  }

  bomList.reverse();
  return bomList;
}

/* ------------------------------------------------------------------ */
/*  validateBOMNo                                                      */
/* ------------------------------------------------------------------ */

export function validateBOMNo(
  item: string,
  bomNo: string,
  bomLookup: BOMLookup
): string | undefined {
  if (!bomLookup.is_active) {
    return `BOM ${bomNo} must be active`;
  }
  if (bomLookup.docstatus !== 1) {
    return `BOM ${bomNo} must be submitted`;
  }

  if (item) {
    let rmItemExists = false;
    for (const d of bomLookup.items || []) {
      if (d.item_code.toLowerCase() === item.toLowerCase()) rmItemExists = true;
    }
    for (const d of bomLookup.secondary_items || []) {
      if (d.item_code.toLowerCase() === item.toLowerCase()) rmItemExists = true;
    }
    if (bomLookup.item.toLowerCase() === item.toLowerCase()) {
      rmItemExists = true;
    }
    if (!rmItemExists) {
      return `BOM ${bomNo} does not belong to Item ${item}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  getBOMUnitCost                                                     */
/* ------------------------------------------------------------------ */

export function getBOMUnitCost(bomLookup: BOMLookup | undefined): number {
  if (!bomLookup || !bomLookup.is_active) return 0;
  return flt(bomLookup.base_total_cost) / flt(bomLookup.quantity || 1);
}

/* ------------------------------------------------------------------ */
/*  manageDefaultBOM                                                   */
/* ------------------------------------------------------------------ */

export function manageDefaultBOM(
  doc: BOMDoc,
  itemDefaultBOM: string | undefined
): { is_default: number; default_bom: string | undefined } {
  if (doc.is_default && doc.is_active) {
    return { is_default: 1, default_bom: doc.name };
  }
  if (!itemDefaultBOM && doc.is_active) {
    return { is_default: 1, default_bom: doc.name };
  }
  return { is_default: 0, default_bom: itemDefaultBOM === doc.name ? undefined : itemDefaultBOM };
}

/* ------------------------------------------------------------------ */
/*  getBOMDiff                                                         */
/* ------------------------------------------------------------------ */

export interface BOMDiffResult {
  changed: [string, unknown, unknown][];
  row_changed: [string, number, string, [string, unknown, unknown][]][];
  added: [string, Record<string, unknown>][];
  removed: [string, Record<string, unknown>][];
}

export function getBOMDiff(doc1: BOMDoc, doc2: BOMDoc): BOMDiffResult {
  const result: BOMDiffResult = {
    changed: [],
    row_changed: [],
    added: [],
    removed: [],
  };

  if (doc1.name === doc2.name) {
    return result;
  }

  const scalarFields: (keyof BOMDoc)[] = [
    "item",
    "item_name",
    "description",
    "uom",
    "quantity",
    "company",
    "currency",
    "conversion_rate",
    "operating_cost",
    "raw_material_cost",
    "total_cost",
    "process_loss_percentage",
    "process_loss_qty",
    "is_active",
    "is_default",
    "is_phantom_bom",
    "with_operations",
    "track_semi_finished_goods",
  ];

  for (const field of scalarFields) {
    const v1 = doc1[field];
    const v2 = doc2[field];
    if (v1 !== v2) {
      result.changed.push([field, v1, v2]);
    }
  }

  // Table diffs
  const tableIdentifiers: Record<string, string> = {
    operations: "operation",
    items: "item_code",
    secondary_items: "item_code",
    exploded_items: "item_code",
  };

  for (const tableName of Object.keys(tableIdentifiers)) {
    const identifier = tableIdentifiers[tableName];
    const oldRows = (((doc1 as unknown) as Record<string, unknown>)[tableName] as Array<Record<string, unknown>>) || [];
    const newRows = (((doc2 as unknown) as Record<string, unknown>)[tableName] as Array<Record<string, unknown>>) || [];

    const oldMap = new Map(oldRows.map((r) => [cstr(r[identifier]), r]));
    const newMap = new Map(newRows.map((r) => [cstr(r[identifier]), r]));

    for (let i = 0; i < newRows.length; i++) {
      const key = cstr(newRows[i][identifier]);
      if (oldMap.has(key)) {
        const rowDiff = getRowDiff(oldMap.get(key)!, newRows[i]);
        if (rowDiff.length) {
          result.row_changed.push([tableName, i, key, rowDiff]);
        }
      } else {
        result.added.push([tableName, newRows[i]]);
      }
    }

    for (const oldRow of oldRows) {
      const key = cstr(oldRow[identifier]);
      if (!newMap.has(key)) {
        result.removed.push([tableName, oldRow]);
      }
    }
  }

  return result;
}

function getRowDiff(
  oldRow: Record<string, unknown>,
  newRow: Record<string, unknown>
): [string, unknown, unknown][] {
  const diff: [string, unknown, unknown][] = [];
  const keys = Array.from(new Set([...Object.keys(oldRow), ...Object.keys(newRow)]));
  for (const key of keys) {
    if (oldRow[key] !== newRow[key]) {
      diff.push([key, oldRow[key], newRow[key]]);
    }
  }
  return diff;
}

/* ------------------------------------------------------------------ */
/*  setDefaultUOM                                                      */
/* ------------------------------------------------------------------ */

export function setDefaultUOM(doc: BOMDoc, itemStockUOMs: Map<string, string>): void {
  if (!doc.items) return;
  for (const row of doc.items) {
    const masterUOM = itemStockUOMs.get(row.item_code);
    if (masterUOM && row.stock_uom !== masterUOM) {
      row.stock_uom = masterUOM;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  getBOMMaterialDetail                                               */
/* ------------------------------------------------------------------ */

export interface BOMMaterialDetailArgs {
  item_code: string;
  item_name?: string;
  company?: string;
  uom?: string;
  stock_uom?: string;
  conversion_factor?: number;
  qty?: number;
  stock_qty?: number;
  bom_no?: string;
  fetch_rate?: boolean;
  include_item_in_manufacturing?: number;
  sourced_by_supplier?: number;
  do_not_explode?: number;
}

export function getBOMMaterialDetail(
  args: BOMMaterialDetailArgs,
  doc: BOMDoc,
  itemMaster: ItemMaster,
  childBOMLookup?: Map<string, BOMLookup>
): Partial<BOMItem> {
  const bomNo = args.bom_no || itemMaster.default_bom || "";
  const transferForManufacture =
    cint(args.include_item_in_manufacturing) || itemMaster.include_item_in_manufacturing || 0;

  const rate = args.fetch_rate
    ? getRMRateFromArgs(args, doc, itemMaster, childBOMLookup)
    : 0;

  const retItem: Partial<BOMItem> = {
    item_name: args.item_name || itemMaster.item_name || "",
    description: itemMaster.description || "",
    image: itemMaster.image || "",
    stock_uom: itemMaster.stock_uom || "",
    uom: args.uom || itemMaster.stock_uom || "",
    conversion_factor: args.conversion_factor || 1,
    bom_no: bomNo,
    rate,
    qty: args.qty || args.stock_qty || 1,
    stock_qty: args.stock_qty || args.qty || 1,
    base_rate: flt(rate) * flt(doc.conversion_rate || 1),
    include_item_in_manufacturing: cint(transferForManufacture),
    sourced_by_supplier: args.sourced_by_supplier || 0,
  };

  if (args.do_not_explode) {
    retItem.bom_no = "";
  }

  return retItem;
}

function getRMRateFromArgs(
  args: BOMMaterialDetailArgs,
  doc: BOMDoc,
  itemMaster: ItemMaster,
  childBOMLookup?: Map<string, BOMLookup>
): number {
  if (!doc.rm_cost_as_per) doc.rm_cost_as_per = "Valuation Rate";

  if (itemMaster.is_customer_provided_item || args.sourced_by_supplier) {
    return 0;
  }

  if (args.bom_no && (doc.set_rate_of_sub_assembly_item_based_on_bom || itemMaster.is_phantom_item)) {
    const childBOM = childBOMLookup?.get(args.bom_no);
    if (childBOM) {
      const unitCost = flt(childBOM.base_total_cost) / flt(childBOM.quantity || 1);
      return flt(unitCost) * flt(args.conversion_factor || 1);
    }
  }

  let rate = 0;
  if (doc.rm_cost_as_per === "Valuation Rate") {
    rate = flt(itemMaster.valuation_rate);
  } else if (doc.rm_cost_as_per === "Last Purchase Rate") {
    rate = flt(itemMaster.last_purchase_rate);
  }

  return flt(rate) * flt(doc.plc_conversion_rate || 1) / flt(doc.conversion_rate || 1);
}
