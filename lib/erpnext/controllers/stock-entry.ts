/**
 * Ported from erpnext/stock/doctype/stock_entry/stock_entry.py
 * Pure business logic for Stock Entry validations, calculations, and rate/amount logic.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type StockEntryPurpose =
  | "Material Issue"
  | "Material Receipt"
  | "Material Transfer"
  | "Material Transfer for Manufacture"
  | "Material Consumption for Manufacture"
  | "Manufacture"
  | "Repack"
  | "Send to Subcontractor"
  | "Disassemble"
  | "Receive from Customer"
  | "Return Raw Material to Customer"
  | "Subcontracting Delivery"
  | "Subcontracting Return";

export interface StockEntryItem {
  item_code: string;
  item_name?: string;
  description?: string;
  qty: number;
  stock_qty?: number;
  transfer_qty?: number;
  rate?: number;
  basic_rate?: number;
  valuation_rate?: number;
  incoming_rate?: number;
  amount?: number;
  basic_amount?: number;
  additional_cost?: number;
  landed_cost_voucher_amount?: number;
  allow_zero_valuation_rate?: boolean;
  set_basic_rate_manually?: boolean;
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
  cost_center?: string;
  expense_account?: string;
  is_finished_item?: boolean;
  is_legacy_scrap_item?: boolean;
  type?: string;
  bom_no?: string;
  bom_secondary_item?: string;
  project?: string;
  material_request?: string;
  material_request_item?: string;
  against_stock_entry?: string;
  ste_detail?: string;
  subcontracted_item?: string;
  sco_rm_detail?: string;
  scio_detail?: string;
  po_detail?: string;
  quality_inspection?: string;
  job_card_item?: string;
  original_item?: string;
  use_serial_batch_fields?: boolean;
  idx: number;
}

export interface StockEntryDoc {
  name?: string;
  company: string;
  posting_date?: string;
  posting_time?: string;
  purpose: StockEntryPurpose | string;
  from_warehouse?: string;
  to_warehouse?: string;
  work_order?: string;
  bom_no?: string;
  fg_completed_qty?: number;
  process_loss_qty?: number;
  process_loss_percentage?: number;
  from_bom?: boolean;
  use_multi_level_bom?: boolean;
  is_return?: boolean;
  is_opening?: "No" | "Yes";
  add_to_transit?: boolean;
  outgoing_stock_entry?: string;
  source_stock_entry?: string;
  job_card?: string;
  project?: string;
  subcontracting_order?: string;
  subcontracting_inward_order?: string;
  supplier?: string;
  stock_entry_type?: string;
  total_additional_costs?: number;
  total_amount?: number;
  total_incoming_value?: number;
  total_outgoing_value?: number;
  value_difference?: number;
  docstatus?: number;
  items: StockEntryItem[];
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface CalculatedStockEntry {
  items: StockEntryItem[];
  total_additional_costs: number;
  total_amount?: number;
  total_incoming_value: number;
  total_outgoing_value: number;
  value_difference: number;
}

export interface BomItem {
  item_code: string;
  qty: number;
  rate?: number;
  source_warehouse?: string;
  allow_alternative_item?: boolean;
}

export interface WorkOrderDetail {
  qty: number;
  produced_qty: number;
  material_transferred_for_manufacturing?: number;
  skip_transfer?: boolean;
  wip_warehouse?: string;
  fg_warehouse?: string;
  scrap_warehouse?: string;
  production_item?: string;
  from_wip_warehouse?: boolean;
  track_semi_finished_goods?: boolean;
}

export interface MaterialRequestItemDetail {
  item_code: string;
  warehouse?: string;
  idx: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cstr(value: string | number | boolean | undefined | null): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

const VALID_PURPOSES: StockEntryPurpose[] = [
  "Material Issue",
  "Material Receipt",
  "Material Transfer",
  "Material Transfer for Manufacture",
  "Material Consumption for Manufacture",
  "Manufacture",
  "Repack",
  "Send to Subcontractor",
  "Disassemble",
  "Receive from Customer",
  "Return Raw Material to Customer",
  "Subcontracting Delivery",
  "Subcontracting Return",
];

/* ------------------------------------------------------------------ */
/*  Purpose & Warehouse                                                */
/* ------------------------------------------------------------------ */

export function validatePurpose(purpose: string): ValidationResult {
  if (!VALID_PURPOSES.includes(purpose as StockEntryPurpose)) {
    return {
      success: false,
      error: `Purpose must be one of ${VALID_PURPOSES.join(", ")}`,
    };
  }
  return { success: true };
}

export function validateWarehouse(doc: StockEntryDoc): ValidationResult {
  const purpose = doc.purpose;

  const sourceMandatory = [
    "Material Issue",
    "Material Transfer",
    "Send to Subcontractor",
    "Material Transfer for Manufacture",
    "Material Consumption for Manufacture",
    "Return Raw Material to Customer",
    "Subcontracting Delivery",
  ];

  const targetMandatory = [
    "Material Receipt",
    "Material Transfer",
    "Send to Subcontractor",
    "Material Transfer for Manufacture",
    "Receive from Customer",
    "Subcontracting Return",
  ];

  const hasBom = doc.items.some((d) => d.bom_no);

  for (const item of doc.items) {
    if (!item.s_warehouse && !item.t_warehouse) {
      item.s_warehouse = doc.from_warehouse;
      item.t_warehouse = doc.to_warehouse;
    }

    if (sourceMandatory.includes(purpose) && !item.s_warehouse) {
      if (doc.from_warehouse) {
        item.s_warehouse = doc.from_warehouse;
      } else {
        return {
          success: false,
          error: `Source warehouse is mandatory for row ${item.idx}`,
        };
      }
    }

    if (targetMandatory.includes(purpose) && !item.t_warehouse) {
      if (doc.to_warehouse) {
        item.t_warehouse = doc.to_warehouse;
      } else {
        return {
          success: false,
          error: `Target warehouse is mandatory for row ${item.idx}`,
        };
      }
    }

    if (purpose === "Manufacture" && hasBom) {
      if (item.is_finished_item || item.type || item.is_legacy_scrap_item) {
        item.s_warehouse = undefined;
        if (!item.t_warehouse) {
          return {
            success: false,
            error: `Target warehouse is mandatory for row ${item.idx}`,
          };
        }
      } else {
        item.t_warehouse = undefined;
        if (!item.s_warehouse) {
          return {
            success: false,
            error: `Source warehouse is mandatory for row ${item.idx}`,
          };
        }
      }
    }

    if (purpose === "Disassemble" && hasBom) {
      if (item.is_finished_item || item.type || item.is_legacy_scrap_item) {
        item.t_warehouse = undefined;
        if (!item.s_warehouse) {
          return {
            success: false,
            error: `Source warehouse is mandatory for row ${item.idx}`,
          };
        }
      } else {
        item.s_warehouse = undefined;
        if (!item.t_warehouse) {
          return {
            success: false,
            error: `Target warehouse is mandatory for row ${item.idx}`,
          };
        }
      }
    }

    if (
      cstr(item.s_warehouse) === cstr(item.t_warehouse) &&
      !["Material Transfer for Manufacture", "Material Transfer"].includes(purpose)
    ) {
      return {
        success: false,
        error: `Source and target warehouse cannot be same for row ${item.idx}`,
      };
    }

    if (!item.s_warehouse && !item.t_warehouse) {
      return { success: false, error: "At least one warehouse is mandatory" };
    }
  }

  return { success: true };
}

export function validateSourceTargetSame(
  items: StockEntryItem[],
  purpose: string
): ValidationResult {
  if (purpose !== "Material Transfer") return { success: true };

  for (const item of items) {
    if (cstr(item.s_warehouse) === cstr(item.t_warehouse)) {
      return {
        success: false,
        error: `Row #${item.idx}: Source and Target Warehouse cannot be the same for Material Transfer`,
      };
    }
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Quantity & Transfer Qty                                            */
/* ------------------------------------------------------------------ */

export function setTransferQty(items: StockEntryItem[], precision = 2): StockEntryItem[] {
  for (const item of items) {
    if (!flt(item.conversion_factor)) {
      throw new Error(`Row ${item.idx}: UOM Conversion Factor is mandatory`);
    }
    item.transfer_qty = flt(flt(item.qty) * flt(item.conversion_factor), precision);
    if (!flt(item.transfer_qty)) {
      throw new Error(`Row ${item.idx}: Qty in Stock UOM can not be zero.`);
    }
  }
  return items;
}

export function validateQtyIsPositive(items: StockEntryItem[]): ValidationResult {
  for (const item of items) {
    if (flt(item.qty) < 0) {
      return {
        success: false,
        error: `Row ${item.idx}: The item ${item.item_code}, quantity must be positive number`,
      };
    }
  }
  return { success: true };
}

export function validateRawMaterialsExist(
  items: StockEntryItem[],
  purpose: string
): ValidationResult {
  if (!["Manufacture", "Repack", "Disassemble"].includes(purpose)) {
    return { success: true };
  }

  const rawMaterials = items.filter((row) => row.s_warehouse);
  if (rawMaterials.length === 0) {
    return {
      success: false,
      error: `At least one raw material item must be present in the stock entry for the type ${purpose}`,
    };
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Finished Goods                                                     */
/* ------------------------------------------------------------------ */

export function validateFinishedGoods(
  items: StockEntryItem[],
  purpose: string,
  productionItem?: string,
  workOrderQty?: number,
  fgCompletedQty?: number,
  overproductionPercentage = 0
): ValidationResult {
  if (purpose !== "Manufacture" && purpose !== "Repack") {
    return { success: true };
  }

  const finishedItems = items.filter((d) => d.is_finished_item);

  if (finishedItems.length === 0) {
    return {
      success: false,
      error: "There must be atleast 1 Finished Good in this Stock Entry",
    };
  }

  if (purpose === "Manufacture") {
    const uniqueFinishedItems = new Set(finishedItems.map((d) => d.item_code));
    if (uniqueFinishedItems.size > 1) {
      return {
        success: false,
        error: "Multiple items cannot be marked as finished item",
      };
    }

    if (productionItem) {
      for (const d of finishedItems) {
        if (d.item_code !== productionItem) {
          return {
            success: false,
            error: `Finished Item ${d.item_code} does not match with Work Order`,
          };
        }
      }
    }

    if (workOrderQty !== undefined && fgCompletedQty !== undefined) {
      const allowedQty = workOrderQty + (overproductionPercentage / 100) * workOrderQty;
      if (fgCompletedQty > allowedQty) {
        return {
          success: false,
          error: `For quantity ${fgCompletedQty} should not be greater than allowed quantity ${allowedQty}`,
        };
      }
    }
  }

  return { success: true };
}

export function validateFgCompletedQty(
  items: StockEntryItem[],
  fgCompletedQty: number,
  purpose: string,
  fromBom: boolean
): ValidationResult {
  if (purpose !== "Manufacture" || !fromBom) {
    return { success: true };
  }

  const fgQty: Record<string, number> = {};
  for (const d of items) {
    if (d.is_finished_item) {
      fgQty[d.item_code] = (fgQty[d.item_code] ?? 0) + flt(d.qty);
    }
  }

  if (Object.keys(fgQty).length === 0) {
    return { success: true };
  }

  const fgItem = Object.keys(fgQty)[0];
  const fgItemQty = flt(fgQty[fgItem]);
  const processLossQty = fgCompletedQty > fgItemQty ? fgCompletedQty - fgItemQty : 0;

  if (processLossQty) {
    if (fgCompletedQty !== flt(fgItemQty) + flt(processLossQty)) {
      return {
        success: false,
        error: `Since there is a process loss of ${processLossQty} units for the finished good ${fgItem}, you should reduce the quantity by ${processLossQty} units for the finished good ${fgItem} in the Items Table.`,
      };
    }
  }

  return { success: true };
}

export function markFinishedAndSecondaryItems(
  items: StockEntryItem[],
  purpose: string,
  finishedItem?: string
): StockEntryItem[] {
  if (purpose !== "Repack" && items.some((d) => d.is_finished_item && d.t_warehouse)) {
    return items;
  }

  for (const d of items) {
    if (d.t_warehouse && !d.s_warehouse) {
      if (purpose === "Repack" || d.item_code === finishedItem) {
        d.is_finished_item = true;
      }
    } else {
      d.is_finished_item = false;
      d.type = "";
    }
  }

  return items;
}

export function validateRepackEntry(items: StockEntryItem[]): ValidationResult {
  const fgItems = items.filter((row) => row.is_finished_item);
  const fgMap = new Map<string, StockEntryItem>();
  for (const row of fgItems) {
    fgMap.set(row.item_code, row);
  }

  if (fgMap.size > 1) {
    const allManual = Array.from(fgMap.values()).every((row) => row.set_basic_rate_manually);
    if (!allManual) {
      return {
        success: false,
        error: `When there are multiple finished goods (${Array.from(fgMap.keys()).join(", ")}) in a Repack stock entry, the basic rate for all finished goods must be set manually. To set rate manually, enable the checkbox 'Set Basic Rate Manually' in the respective finished good row.`,
      };
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Batch Validation                                                   */
/* ------------------------------------------------------------------ */

export function validateBatch(
  items: StockEntryItem[],
  postingDate: string,
  purpose: string,
  batchMap: Map<string, { disabled: boolean; expiryDate?: string }>
): ValidationResult {
  const purposesToCheck = [
    "Material Transfer for Manufacture",
    "Manufacture",
    "Repack",
    "Send to Subcontractor",
  ];

  for (const item of items) {
    if (!item.batch_no || !purposesToCheck.includes(purpose)) continue;

    const batchInfo = batchMap.get(item.batch_no);
    if (!batchInfo) continue;

    if (batchInfo.disabled) {
      return {
        success: false,
        error: `Batch ${item.batch_no} of Item ${item.item_code} is disabled.`,
      };
    }

    if (batchInfo.expiryDate) {
      if (getdate(postingDate) > getdate(batchInfo.expiryDate)) {
        return {
          success: false,
          error: `Batch ${item.batch_no} of Item ${item.item_code} has expired.`,
        };
      }
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Difference Account                                                 */
/* ------------------------------------------------------------------ */

export function validateDifferenceAccount(
  items: StockEntryItem[],
  isOpening: string,
  accountMap: Map<string, { accountType: string; reportType: string }>
): ValidationResult {
  for (const d of items) {
    if (!d.expense_account) {
      return {
        success: false,
        error: `Please enter Difference Account or set default Stock Adjustment Account for company`,
      };
    }

    const acc = accountMap.get(d.expense_account);
    if (!acc) continue;

    if (isOpening === "Yes" && acc.reportType === "Profit and Loss") {
      return {
        success: false,
        error: "Difference Account must be a Asset/Liability type account (Temporary Opening), since this Stock Entry is an Opening Entry",
      };
    }

    if (acc.accountType === "Stock") {
      return {
        success: false,
        error: `At row #${d.idx}: the Difference Account must not be a Stock type account, please change the Account Type for the account ${d.expense_account} or select a different account`,
      };
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Rate & Amount Calculations                                         */
/* ------------------------------------------------------------------ */

export function calculateRateAndAmount(
  doc: StockEntryDoc,
  resetOutgoingRate = true,
  raiseErrorIfNoRate = true,
  itemValuationRates?: Map<string, number>
): CalculatedStockEntry {
  const items = setBasicRate(doc.items, doc.purpose, resetOutgoingRate, raiseErrorIfNoRate, itemValuationRates);
  const withAdditionalCosts = distributeAdditionalCosts(items, doc.purpose, flt(doc.total_additional_costs));
  const withValuation = updateValuationRate(withAdditionalCosts, resetOutgoingRate);
  const totals = setTotalIncomingOutgoingValue(withValuation);

  return {
    items: totals.items,
    total_additional_costs: flt(doc.total_additional_costs),
    total_amount: setTotalAmount(totals.items, doc.purpose),
    total_incoming_value: totals.totalIncoming,
    total_outgoing_value: totals.totalOutgoing,
    value_difference: totals.valueDifference,
  };
}

export function setBasicRate(
  items: StockEntryItem[],
  purpose: string,
  resetOutgoingRate = true,
  raiseErrorIfNoRate = true,
  itemValuationRates?: Map<string, number>
): StockEntryItem[] {
  const outgoingItemsCost = setRateForOutgoingItems(items, resetOutgoingRate);

  const zeroRateItems: string[] = [];

  for (const d of items) {
    if (d.s_warehouse || d.set_basic_rate_manually) continue;

    if (d.allow_zero_valuation_rate && d.basic_rate && purpose !== "Receive from Customer") {
      d.basic_rate = 0;
      zeroRateItems.push(d.item_code);
      continue;
    }

    if (d.is_finished_item) {
      if (purpose === "Manufacture") {
        d.basic_rate = getBasicRateForManufacturedItem(d.transfer_qty ?? d.qty, outgoingItemsCost);
      } else if (purpose === "Repack") {
        d.basic_rate = getBasicRateForRepackedItems(items, outgoingItemsCost);
      }
    }

    if (!d.basic_rate && !d.allow_zero_valuation_rate) {
      const fallbackRate = itemValuationRates?.get(d.item_code);
      if (fallbackRate !== undefined) {
        d.basic_rate = fallbackRate;
      } else if (raiseErrorIfNoRate) {
        // Caller should handle missing rate; we set to 0 to avoid NaN
        d.basic_rate = 0;
      }
    }

    d.basic_rate = flt(d.basic_rate);
    d.basic_amount = flt(flt(d.transfer_qty ?? d.qty) * flt(d.basic_rate));
  }

  return items;
}

export function setRateForOutgoingItems(
  items: StockEntryItem[],
  resetOutgoingRate = true
): number {
  let outgoingItemsCost = 0;
  for (const d of items) {
    if (!d.s_warehouse) continue;

    if (resetOutgoingRate) {
      // Rate should be provided by caller (from previous SLE / incoming rate)
      // If not set, we leave it as-is.
    }

    d.basic_amount = flt(flt(d.transfer_qty ?? d.qty) * flt(d.basic_rate));
    if (!d.t_warehouse) {
      outgoingItemsCost += flt(d.basic_amount);
    }
  }
  return outgoingItemsCost;
}

export function getBasicRateForManufacturedItem(
  finishedItemQty: number,
  outgoingItemsCost: number,
  scrapItemsCost = 0
): number {
  if (!finishedItemQty) return 0;
  return flt((outgoingItemsCost - scrapItemsCost) / finishedItemQty);
}

export function getBasicRateForRepackedItems(
  items: StockEntryItem[],
  outgoingItemsCost: number
): number {
  const finishedItems = items.filter((d) => d.is_finished_item);
  const finishedItemCodes = finishedItems.map((d) => d.item_code);

  if (finishedItemCodes.length === 1) {
    const fg = finishedItems[0];
    const qty = fg.transfer_qty ?? fg.qty;
    if (!qty) return 0;
    return flt(outgoingItemsCost / qty);
  }

  const uniqueFinishedItems = new Set(finishedItemCodes);
  if (uniqueFinishedItems.size === 1) {
    const totalFgQty = finishedItems.reduce((sum, d) => sum + flt(d.transfer_qty ?? d.qty), 0);
    if (!totalFgQty) return 0;
    return flt(outgoingItemsCost / totalFgQty);
  }

  return 0;
}

export function distributeAdditionalCosts(
  items: StockEntryItem[],
  purpose: string,
  totalAdditionalCosts: number
): StockEntryItem[] {
  // If no incoming items, set additional costs to 0
  const hasIncoming = items.some((d) => d.t_warehouse);
  if (!hasIncoming) {
    for (const d of items) {
      d.additional_cost = 0;
    }
    return items;
  }

  let incomingItemsCost = 0;
  if (purpose === "Repack" || purpose === "Manufacture") {
    incomingItemsCost = items
      .filter((d) => d.is_finished_item)
      .reduce((sum, d) => sum + flt(d.basic_amount), 0);
  } else {
    incomingItemsCost = items
      .filter((d) => d.t_warehouse)
      .reduce((sum, d) => sum + flt(d.basic_amount), 0);
  }

  if (!incomingItemsCost) {
    for (const d of items) {
      d.additional_cost = 0;
    }
    return items;
  }

  for (const d of items) {
    if ((purpose === "Repack" || purpose === "Manufacture") && !d.is_finished_item) {
      d.additional_cost = 0;
      continue;
    }
    if (!d.t_warehouse) {
      d.additional_cost = 0;
      continue;
    }
    d.additional_cost = (flt(d.basic_amount) / incomingItemsCost) * totalAdditionalCosts;
  }

  return items;
}

export function updateValuationRate(
  items: StockEntryItem[],
  resetOutgoingRate = true
): StockEntryItem[] {
  for (const d of items) {
    if (!resetOutgoingRate && d.s_warehouse) continue;

    const transferQty = flt(d.transfer_qty ?? d.qty);
    if (!transferQty) continue;

    d.amount = flt(
      flt(d.basic_amount) + flt(d.additional_cost) + flt(d.landed_cost_voucher_amount)
    );

    d.valuation_rate =
      flt(d.basic_rate) +
      (flt(d.additional_cost) + flt(d.landed_cost_voucher_amount)) / transferQty;
  }

  return items;
}

export function setTotalIncomingOutgoingValue(items: StockEntryItem[]): {
  items: StockEntryItem[];
  totalIncoming: number;
  totalOutgoing: number;
  valueDifference: number;
} {
  let totalIncoming = 0;
  let totalOutgoing = 0;

  for (const d of items) {
    if (d.t_warehouse) {
      totalIncoming += flt(d.amount);
    }
    if (d.s_warehouse) {
      totalOutgoing += flt(d.amount);
    }
  }

  return {
    items,
    totalIncoming,
    totalOutgoing,
    valueDifference: totalIncoming - totalOutgoing,
  };
}

export function setTotalAmount(items: StockEntryItem[], purpose: string): number | undefined {
  if (purpose === "Manufacture" || purpose === "Repack") {
    return undefined;
  }
  return items.reduce((sum, item) => sum + flt(item.amount), 0);
}

/* ------------------------------------------------------------------ */
/*  BOM & Component Quantities                                         */
/* ------------------------------------------------------------------ */

export function validateComponentQuantities(
  items: StockEntryItem[],
  bomItems: BomItem[],
  fgCompletedQty: number,
  precision = 2
): ValidationResult {
  const rawMaterialMap = new Map<string, StockEntryItem>();
  for (const row of items) {
    if (row.s_warehouse) {
      rawMaterialMap.set(row.item_code, row);
    }
  }

  for (const bomItem of bomItems) {
    const matchedItem = rawMaterialMap.get(bomItem.item_code) ?? rawMaterialMap.get(bomItem.item_code);
    if (!matchedItem) {
      return {
        success: false,
        error: `According to the BOM, the Item '${bomItem.item_code}' is missing in the stock entry.`,
      };
    }

    if (flt(bomItem.qty, precision) !== flt(matchedItem.qty, precision)) {
      return {
        success: false,
        error: `For the item ${bomItem.item_code}, the consumed quantity should be ${bomItem.qty} according to the BOM.`,
      };
    }
  }

  return { success: true };
}

export function getPendingRawMaterials(
  requiredItems: Array<{
    item_code: string;
    required_qty: number;
    transferred_qty: number;
    source_warehouse?: string;
    include_item_in_manufacturing?: boolean;
    allow_alternative_item?: boolean;
  }>,
  workOrderQty: number,
  fgCompletedQty: number,
  materialTransferredForManufacturing: number,
  overproductionPercentage = 0,
  transferExtraMaterialsPercentage = 0,
  backflushBasedOn?: string
): Array<{
  item_code: string;
  qty: number;
  from_warehouse?: string;
  to_warehouse?: string;
  allow_alternative_item?: boolean;
}> {
  const maxQty = flt(workOrderQty);
  const toTransferQty = flt(materialTransferredForManufacturing) + flt(fgCompletedQty);
  let transferLimitQty = maxQty + (maxQty * overproductionPercentage) / 100;
  if (transferExtraMaterialsPercentage) {
    transferLimitQty = maxQty + (maxQty * transferExtraMaterialsPercentage) / 100;
  }
  const allowOverproduction = transferLimitQty >= toTransferQty;

  const result: Array<{
    item_code: string;
    qty: number;
    from_warehouse?: string;
    to_warehouse?: string;
    allow_alternative_item?: boolean;
  }> = [];

  for (const item of requiredItems) {
    if (!item.include_item_in_manufacturing) continue;

    const pendingToIssue = flt(item.required_qty) - flt(item.transferred_qty);
    const desireToTransfer = (flt(fgCompletedQty) * flt(item.required_qty)) / maxQty;

    let qty = 0;
    if (
      desireToTransfer <= pendingToIssue ||
      (desireToTransfer > 0 && backflushBasedOn === "Material Transferred for Manufacture") ||
      allowOverproduction
    ) {
      qty = desireToTransfer > 0 ? desireToTransfer : pendingToIssue;
    } else if (pendingToIssue > 0) {
      qty = pendingToIssue;
    }

    if (qty > 0) {
      result.push({
        item_code: item.item_code,
        qty,
        from_warehouse: item.source_warehouse,
        allow_alternative_item: item.allow_alternative_item,
      });
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Work Order                                                         */
/* ------------------------------------------------------------------ */

export function validateWorkOrder(
  purpose: string,
  workOrder?: string,
  fgCompletedQty?: number,
  trackSemiFinishedGoods?: boolean
): ValidationResult {
  const purposes = [
    "Manufacture",
    "Material Transfer for Manufacture",
    "Material Consumption for Manufacture",
    "Disassemble",
  ];

  if (!purposes.includes(purpose)) {
    return { success: true };
  }

  if (
    (purpose === "Manufacture" || purpose === "Material Consumption for Manufacture") &&
    workOrder &&
    !trackSemiFinishedGoods
  ) {
    if (!fgCompletedQty) {
      return { success: false, error: "For Quantity (Manufactured Qty) is mandatory" };
    }
  }

  return { success: true };
}

export function validateSourceStockEntry(
  sourceStockEntry: string | undefined,
  workOrder: string | undefined,
  sourceWorkOrder: string | undefined,
  fgCompletedQty: number,
  availableQty: number
): ValidationResult {
  if (!sourceStockEntry) return { success: true };

  if (workOrder && sourceWorkOrder && sourceWorkOrder !== workOrder) {
    return {
      success: false,
      error: `Source Stock Entry ${sourceStockEntry} belongs to Work Order ${sourceWorkOrder}, not ${workOrder}. Please use a manufacture entry from the same Work Order.`,
    };
  }

  if (flt(fgCompletedQty) > availableQty) {
    return {
      success: false,
      error: `Cannot disassemble ${fgCompletedQty} qty against Stock Entry ${sourceStockEntry}. Only ${availableQty} qty available to disassemble.`,
    };
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Material Request                                                   */
/* ------------------------------------------------------------------ */

export function validateWithMaterialRequest(
  items: StockEntryItem[],
  purpose: string,
  addToTransit?: boolean,
  outgoingStockEntry?: string,
  getMaterialRequestItem?: (steDetail: string) => MaterialRequestItemDetail | undefined
): ValidationResult {
  for (const item of items) {
    let materialRequest = item.material_request;
    let materialRequestItem = item.material_request_item;

    if (purpose === "Material Transfer" && outgoingStockEntry && item.ste_detail) {
      const parentSe = getMaterialRequestItem?.(item.ste_detail);
      if (parentSe) {
        materialRequest = parentSe.item_code ? undefined : materialRequest;
        materialRequestItem = parentSe.item_code ? undefined : materialRequestItem;
      }
    }

    if (materialRequest && materialRequestItem) {
      if (purpose === "Material Transfer" && addToTransit) {
        continue;
      }
      // Additional checks would be performed by the caller with actual MR data
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Process Loss                                                       */
/* ------------------------------------------------------------------ */

export function setProcessLossQty(
  fgCompletedQty: number,
  processLossPercentage?: number,
  processLossQty?: number
): { processLossQty: number; processLossPercentage: number } {
  if (processLossPercentage && !processLossQty) {
    processLossQty = (flt(fgCompletedQty) * flt(processLossPercentage)) / 100;
  } else if (processLossQty && !processLossPercentage && fgCompletedQty) {
    processLossPercentage = (flt(processLossQty) / flt(fgCompletedQty)) * 100;
  }

  return {
    processLossQty: flt(processLossQty),
    processLossPercentage: flt(processLossPercentage),
  };
}

/* ------------------------------------------------------------------ */
/*  Add to Stock Entry Detail                                          */
/* ------------------------------------------------------------------ */

export interface StockEntryItemDict {
  item_code?: string;
  item_name?: string;
  description?: string;
  qty?: number;
  stock_uom?: string;
  uom?: string;
  from_warehouse?: string;
  to_warehouse?: string;
  s_warehouse?: string;
  t_warehouse?: string;
  conversion_factor?: number;
  is_finished_item?: boolean;
  type?: string;
  is_legacy_scrap_item?: boolean;
  cost_center?: string;
  expense_account?: string;
  allow_zero_valuation_rate?: boolean;
  use_serial_batch_fields?: boolean;
  batch_no?: string;
  serial_no?: string;
  serial_and_batch_bundle?: string;
  original_item?: string;
  subcontracted_item?: string;
  sco_rm_detail?: string;
  scio_detail?: string;
  po_detail?: string;
  job_card_item?: string;
  allow_alternative_item?: boolean;
}

export function addToStockEntryDetail(
  items: StockEntryItem[],
  itemDict: Record<string, StockEntryItemDict>,
  bomNo?: string,
  fromWarehouse?: string,
  toWarehouse?: string,
  precision = 2
): StockEntryItem[] {
  const result = [...items];
  let idx = items.length > 0 ? Math.max(...items.map((i) => i.idx)) + 1 : 1;

  for (const [key, itemRow] of Object.entries(itemDict)) {
    const childQty = flt(itemRow.qty ?? 0, precision);
    if (childQty <= 0 && !itemRow.type && !itemRow.is_legacy_scrap_item) {
      continue;
    }

    const seChild: StockEntryItem = {
      item_code: itemRow.item_code ?? key,
      item_name: itemRow.item_name,
      description: itemRow.description,
      qty: childQty > 0 ? childQty : 0,
      stock_uom: itemRow.stock_uom ?? "Nos",
      uom: itemRow.uom ?? itemRow.stock_uom ?? "Nos",
      s_warehouse: itemRow.s_warehouse ?? itemRow.from_warehouse ?? fromWarehouse,
      t_warehouse: itemRow.t_warehouse ?? itemRow.to_warehouse ?? toWarehouse,
      conversion_factor: flt(itemRow.conversion_factor) || 1,
      is_finished_item: itemRow.is_finished_item ?? false,
      type: itemRow.type,
      is_legacy_scrap_item: itemRow.is_legacy_scrap_item,
      bom_no: bomNo,
      cost_center: itemRow.cost_center,
      expense_account: itemRow.expense_account,
      allow_zero_valuation_rate: itemRow.allow_zero_valuation_rate ?? false,
      use_serial_batch_fields: itemRow.use_serial_batch_fields,
      batch_no: itemRow.batch_no,
      serial_no: itemRow.serial_no,
      serial_and_batch_bundle: itemRow.serial_and_batch_bundle,
      original_item: itemRow.original_item,
      subcontracted_item: itemRow.subcontracted_item,
      sco_rm_detail: itemRow.sco_rm_detail,
      scio_detail: itemRow.scio_detail,
      po_detail: itemRow.po_detail,
      job_card_item: itemRow.job_card_item,
      idx,
    };

    seChild.transfer_qty = flt(seChild.qty * (seChild.conversion_factor ?? 1));
    idx++;
    result.push(seChild);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Validation Orchestrator                                            */
/* ------------------------------------------------------------------ */

export function validateStockEntry(doc: StockEntryDoc): ValidationResult {
  const warnings: string[] = [];

  const purposeResult = validatePurpose(doc.purpose);
  if (!purposeResult.success) return purposeResult;

  const qtyResult = validateQtyIsPositive(doc.items);
  if (!qtyResult.success) return qtyResult;

  const warehouseResult = validateWarehouse(doc);
  if (!warehouseResult.success) return warehouseResult;

  const sameWhResult = validateSourceTargetSame(doc.items, doc.purpose);
  if (!sameWhResult.success) return sameWhResult;

  const rawMaterialResult = validateRawMaterialsExist(doc.items, doc.purpose);
  if (!rawMaterialResult.success) return rawMaterialResult;

  if (doc.purpose === "Manufacture" || doc.purpose === "Repack") {
    const fgResult = validateFinishedGoods(
      doc.items,
      doc.purpose,
      undefined,
      undefined,
      doc.fg_completed_qty
    );
    if (!fgResult.success) return fgResult;
  }

  if (doc.purpose === "Manufacture" && doc.from_bom) {
    const fgQtyResult = validateFgCompletedQty(
      doc.items,
      doc.fg_completed_qty ?? 0,
      doc.purpose,
      doc.from_bom
    );
    if (!fgQtyResult.success) return fgQtyResult;
  }

  if (doc.purpose === "Repack") {
    const repackResult = validateRepackEntry(doc.items);
    if (!repackResult.success) return repackResult;
  }

  if (!doc.from_bom) {
    doc.fg_completed_qty = 0;
  }

  return { success: true, warnings };
}
