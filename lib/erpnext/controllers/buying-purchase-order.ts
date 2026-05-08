/**
 * Ported from erpnext/buying/doctype/purchase_order/purchase_order.py
 * Pure business logic for Purchase Order validation & calculations.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PurchaseOrderItem {
  idx: number;
  name?: string;
  item_code?: string;
  item_name?: string;
  description?: string;
  qty: number;
  rate?: number;
  amount?: number;
  stock_qty?: number;
  received_qty?: number;
  billed_amt?: number;
  conversion_factor?: number;
  uom?: string;
  stock_uom?: string;
  warehouse?: string;
  schedule_date?: string;
  material_request?: string;
  material_request_item?: string;
  sales_order?: string;
  sales_order_item?: string;
  production_plan?: string;
  production_plan_sub_assembly_item?: string;
  supplier_quotation?: string;
  supplier_quotation_item?: string;
  delivered_by_supplier?: boolean | number;
  fg_item?: string;
  fg_item_qty?: number;
  bom?: string;
  subcontracted_qty?: number;
  cost_center?: string;
  project?: string;
  job_card?: string;
  base_price_list_rate?: number;
  discount_percentage?: number;
  base_rate?: number;
  price_list_rate?: number;
  last_purchase_rate?: number;
}

export interface PurchaseOrderTax {
  idx: number;
  charge_type: string;
  account_head: string;
  rate: number;
  tax_amount?: number;
  category?: string;
  add_deduct_tax?: string;
  included_in_print_rate?: boolean;
}

export interface PurchaseOrderDoc {
  name?: string;
  docstatus?: number;
  status?: string;
  supplier: string;
  supplier_name?: string;
  company: string;
  currency: string;
  conversion_rate?: number;
  is_subcontracted?: boolean;
  has_unit_price_items?: boolean;
  items: PurchaseOrderItem[];
  taxes?: PurchaseOrderTax[];
  per_received?: number;
  per_billed?: number;
  grand_total?: number;
  base_grand_total?: number;
  total?: number;
  net_total?: number;
  total_qty?: number;
  schedule_date?: string;
  transaction_date?: string;
  set_warehouse?: string;
  inter_company_order_reference?: string;
  project?: string;
  customer?: string;
  billing_address?: string;
  shipping_address?: string;
  dispatch_address?: string;
  supplier_warehouse?: string;
  cost_center?: string;
  apply_discount_on?: string;
  discount_amount?: number;
  additional_discount_percentage?: number;
  advance_payment_status?: string;
  party_account_currency?: string;
}

export interface ValidationResult<T = never> {
  valid: boolean;
  error?: string;
  warnings?: string[];
  doc?: T;
}

export interface POValidationContext {
  supplierPreventPO?: boolean;
  supplierWarnPO?: boolean;
  supplierScorecardStatus?: string;
  supplierPartyAccountCurrency?: string;
  itemMinOrderQtyMap?: Record<string, number>;
  itemIsSubcontractedMap?: Record<string, boolean>;
  itemDefaultBomMap?: Record<string, string>;
  allowZeroQtyInPurchaseOrder?: boolean;
  maintainSameRate?: boolean;
  referenceDocRates?: Array<{
    supplier_quotation: string;
    supplier_quotation_item: string;
    rate: number;
  }>;
}

export interface LastPurchaseDetails {
  base_price_list_rate?: number;
  discount_percentage?: number;
  base_rate?: number;
  base_net_rate?: number;
}

export interface SubcontractingBOM {
  service_item: string;
  conversion_factor: number;
  service_item_uom: string;
}

export interface ReceiptMappingRow {
  item_code?: string;
  qty: number;
  stock_qty: number;
  amount: number;
  base_amount: number;
  purchase_order_item?: string;
  purchase_order?: string;
  bom?: string;
  material_request?: string;
  material_request_item?: string;
  sales_order?: string;
  sales_order_item?: string;
  wip_composite_asset?: string;
}

export interface InvoiceMappingRow {
  item_code?: string;
  qty: number;
  po_detail?: string;
  purchase_order?: string;
  material_request?: string;
  material_request_item?: string;
  wip_composite_asset?: string;
  cost_center?: string;
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
/*  Main Validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Main Purchase Order validation.
 * Ported from PurchaseOrder.validate()
 */
export function validatePurchaseOrder(
  doc: PurchaseOrderDoc,
  ctx: POValidationContext
): ValidationResult<PurchaseOrderDoc> {
  const warnings: string[] = [];
  let d = { ...doc };

  // set_has_unit_price_items
  d = setHasUnitPriceItems(d, ctx.allowZeroQtyInPurchaseOrder ?? false);

  // validate_supplier
  const supplierVal = validateSupplier(d, ctx);
  if (!supplierVal.valid) return supplierVal;
  if (supplierVal.warnings) warnings.push(...supplierVal.warnings);

  // validate_schedule_date
  const scheduleVal = validateScheduleDate(d);
  if (!scheduleVal.valid) return scheduleVal;

  // validate_uom_is_integer
  const uomIntVal = validateUomIsInteger(d.items, "uom", "qty");
  if (!uomIntVal.valid) return uomIntVal;
  const stockUomIntVal = validateUomIsInteger(d.items, "stock_uom", "stock_qty");
  if (!stockUomIntVal.valid) return stockUomIntVal;

  // validate_minimum_order_qty
  const minQtyVal = validateMinimumOrderQty(d.items, ctx.itemMinOrderQtyMap ?? {});
  if (!minQtyVal.valid) return minQtyVal;

  // validate_fg_item_for_subcontracting
  const fgVal = validateFgItemForSubcontracting(
    d.items,
    d.is_subcontracted ?? false,
    ctx.itemIsSubcontractedMap ?? {},
    ctx.itemDefaultBomMap ?? {}
  );
  if (!fgVal.valid) return fgVal;

  // set_received_qty_for_drop_ship_items
  d.items = setReceivedQtyForDropShipItems(d.items);

  // advance_payment_status default
  if (!d.advance_payment_status) {
    d.advance_payment_status = "Not Initiated";
  }

  return { valid: true, warnings, doc: d };
}

/* ------------------------------------------------------------------ */
/*  Supplier Validation                                                */
/* ------------------------------------------------------------------ */

/**
 * Validate supplier scorecard standing & set party account currency.
 * Ported from PurchaseOrder.validate_supplier()
 */
export function validateSupplier(
  doc: PurchaseOrderDoc,
  ctx: POValidationContext
): ValidationResult<PurchaseOrderDoc> {
  const warnings: string[] = [];
  let d = { ...doc };

  if (ctx.supplierPreventPO) {
    if (ctx.supplierScorecardStatus) {
      return {
        valid: false,
        error: `Purchase Orders are not allowed for ${d.supplier} due to a scorecard standing of ${ctx.supplierScorecardStatus}.`,
      };
    }
  }

  if (ctx.supplierWarnPO) {
    if (ctx.supplierScorecardStatus) {
      warnings.push(
        `${d.supplier} currently has a ${ctx.supplierScorecardStatus} Supplier Scorecard standing, and Purchase Orders to this supplier should be issued with caution.`
      );
    }
  }

  if (ctx.supplierPartyAccountCurrency) {
    d = { ...d, party_account_currency: ctx.supplierPartyAccountCurrency };
  }

  return { valid: true, warnings, doc: d };
}

/* ------------------------------------------------------------------ */
/*  Schedule Date Validation                                           */
/* ------------------------------------------------------------------ */

/**
 * Ensure schedule_date exists on all items.
 */
export function validateScheduleDate(doc: PurchaseOrderDoc): ValidationResult<never> {
  for (const item of doc.items) {
    if (!item.schedule_date) {
      return { valid: false, error: `Row ${item.idx}: Please enter Schedule Date` };
    }
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  UOM Integer Validation                                             */
/* ------------------------------------------------------------------ */

/**
 * Validate that qty fields are integers when UOM requires it.
 * Ported from BuyingController.validate_uom_is_integer
 */
export function validateUomIsInteger(
  items: PurchaseOrderItem[],
  uomField: "uom" | "stock_uom",
  qtyField: "qty" | "stock_qty"
): ValidationResult<never> {
  const intUoms = new Set(["Nos", "Unit", "Pair", "Set", "Box", "Packet", "Pack"]);
  for (const item of items) {
    const uom = item[uomField];
    const qty = item[qtyField];
    if (uom && qty !== undefined && qty !== null) {
      if (intUoms.has(uom) && !Number.isInteger(flt(qty, 0))) {
        return {
          valid: false,
          error: `Row ${item.idx}: ${qtyField} must be whole number for UOM ${uom}`,
        };
      }
    }
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Minimum Order Qty Validation                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate minimum order quantity per item.
 * Ported from PurchaseOrder.validate_minimum_order_qty()
 */
export function validateMinimumOrderQty(
  items: PurchaseOrderItem[],
  itemMinOrderQtyMap: Record<string, number>
): ValidationResult<never> {
  const itemwiseQty: Record<string, number> = {};

  for (const d of items) {
    if (!d.item_code) continue;
    itemwiseQty[d.item_code] = flt(itemwiseQty[d.item_code] ?? 0) + flt(d.stock_qty ?? d.qty);
  }

  for (const [itemCode, qty] of Object.entries(itemwiseQty)) {
    const minQty = flt(itemMinOrderQtyMap[itemCode] ?? 0);
    if (flt(qty) < minQty) {
      return {
        valid: false,
        error: `Item ${itemCode}: Ordered qty ${qty} cannot be less than minimum order qty ${minQty} (defined in Item).`,
      };
    }
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Subcontracting FG Validation                                       */
/* ------------------------------------------------------------------ */

/**
 * Validate finished-good item for subcontracted POs.
 * Ported from PurchaseOrder.validate_fg_item_for_subcontracting()
 */
export function validateFgItemForSubcontracting(
  items: PurchaseOrderItem[],
  isSubcontracted: boolean,
  itemIsSubcontractedMap: Record<string, boolean>,
  itemDefaultBomMap: Record<string, string>
): ValidationResult<never> {
  if (isSubcontracted) {
    for (const item of items) {
      if (!item.fg_item) {
        return {
          valid: false,
          error: `Row #${item.idx}: Finished Good Item is not specified for service item ${item.item_code}`,
        };
      }

      if (!itemIsSubcontractedMap[item.fg_item]) {
        return {
          valid: false,
          error: `Row #${item.idx}: Finished Good Item ${item.fg_item} must be a sub-contracted item`,
        };
      }

      if (!item.bom && !itemDefaultBomMap[item.fg_item]) {
        return {
          valid: false,
          error: `Row #${item.idx}: Default BOM not found for FG Item ${item.fg_item}`,
        };
      }

      if (!item.fg_item_qty) {
        return {
          valid: false,
          error: `Row #${item.idx}: Finished Good Item Qty can not be zero`,
        };
      }
    }
  } else {
    for (const item of items) {
      if (item.fg_item !== undefined) {
        item.fg_item = undefined;
      }
      if (item.fg_item_qty !== undefined) {
        item.fg_item_qty = 0;
      }
    }
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Unit Price Items                                                   */
/* ------------------------------------------------------------------ */

/**
 * Set has_unit_price_items flag.
 * Ported from PurchaseOrder.set_has_unit_price_items()
 */
export function setHasUnitPriceItems(
  doc: PurchaseOrderDoc,
  allowZeroQtyInPurchaseOrder: boolean
): PurchaseOrderDoc {
  if (!allowZeroQtyInPurchaseOrder) {
    return { ...doc, has_unit_price_items: false };
  }

  const hasUnitPriceItems = doc.items.some((row) => row.item_code && !row.qty);

  return { ...doc, has_unit_price_items: hasUnitPriceItems };
}

/* ------------------------------------------------------------------ */
/*  Drop Ship                                                          */
/* ------------------------------------------------------------------ */

/**
 * Set received_qty = qty for drop-ship items.
 * Ported from PurchaseOrder.set_received_qty_for_drop_ship_items()
 */
export function setReceivedQtyForDropShipItems(items: PurchaseOrderItem[]): PurchaseOrderItem[] {
  return items.map((item) => {
    if (item.delivered_by_supplier) {
      return { ...item, received_qty: item.qty };
    }
    return item;
  });
}

/**
 * Check if PO has any drop-ship items.
 * Ported from PurchaseOrder.has_drop_ship_item()
 */
export function hasDropShipItem(items: PurchaseOrderItem[]): boolean {
  return items.some((d) => d.delivered_by_supplier);
}

/* ------------------------------------------------------------------ */
/*  Linked Documents                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check if PO is linked to a Sales Order.
 * Ported from PurchaseOrder.is_against_so()
 */
export function isAgainstSO(items: PurchaseOrderItem[]): boolean {
  return items.some((d) => d.sales_order);
}

/**
 * Check if PO is linked to a Production Plan.
 * Ported from PurchaseOrder.is_against_pp()
 */
export function isAgainstPP(items: PurchaseOrderItem[]): boolean {
  return items.some((d) => d.production_plan);
}

/* ------------------------------------------------------------------ */
/*  Receiving Percentage                                               */
/* ------------------------------------------------------------------ */

/**
 * Update per_received percentage.
 * Ported from PurchaseOrder.update_receiving_percentage()
 */
export function updateReceivingPercentage(doc: PurchaseOrderDoc): PurchaseOrderDoc {
  let totalQty = 0;
  let receivedQty = 0;

  for (const item of doc.items) {
    receivedQty += Math.min(flt(item.received_qty), flt(item.qty));
    totalQty += flt(item.qty);
  }

  const perReceived = totalQty ? flt((receivedQty / totalQty) * 100) : 0;

  return { ...doc, per_received: perReceived };
}

/* ------------------------------------------------------------------ */
/*  Last Purchase Rate                                                 */
/* ------------------------------------------------------------------ */

/**
 * Get last purchase rate for an item.
 * Ported from item_last_purchase_rate()
 */
export function getLastPurchaseRate(
  itemCode: string,
  conversionRate: number,
  conversionFactor: number,
  lastPurchaseDetails: LastPurchaseDetails | null,
  itemLastPurchaseRate: number | null
): number | null {
  const convRate = flt(conversionRate) || 1.0;
  const convFactor = flt(conversionFactor) || 1.0;

  if (lastPurchaseDetails) {
    const rate =
      (flt(lastPurchaseDetails.base_net_rate ?? lastPurchaseDetails.base_rate) * convFactor) /
      convRate;
    return flt(rate);
  }

  if (itemLastPurchaseRate) {
    return flt(itemLastPurchaseRate);
  }

  return null;
}

/**
 * Apply last purchase rates to all PO items.
 * Ported from PurchaseOrder.get_last_purchase_rate()
 */
export function applyLastPurchaseRates(
  doc: PurchaseOrderDoc,
  lastPurchaseDetailsMap: Record<string, LastPurchaseDetails | null>,
  itemLastPurchaseRateMap: Record<string, number | null>
): PurchaseOrderDoc {
  const conversionRate = flt(doc.conversion_rate) || 1.0;

  const updatedItems = doc.items.map((d) => {
    if (!d.item_code) return d;

    const details = lastPurchaseDetailsMap[d.item_code];
    const itemLPR = itemLastPurchaseRateMap[d.item_code];

    if (details) {
      const cf = flt(d.conversion_factor) || 1.0;
      const basePriceListRate = flt(details.base_price_list_rate ?? 0) * cf;
      const baseRate = flt(details.base_rate ?? 0) * cf;
      const priceListRate = basePriceListRate / conversionRate;
      const rate = baseRate / conversionRate;

      return {
        ...d,
        base_price_list_rate: basePriceListRate,
        discount_percentage: details.discount_percentage ?? 0,
        base_rate: baseRate,
        price_list_rate: priceListRate,
        rate,
        last_purchase_rate: rate,
      };
    }

    if (itemLPR) {
      return {
        ...d,
        base_price_list_rate: itemLPR,
        base_rate: itemLPR,
        price_list_rate: itemLPR,
        rate: itemLPR,
        last_purchase_rate: itemLPR,
      };
    }

    return d;
  });

  return { ...doc, items: updatedItems };
}

/* ------------------------------------------------------------------ */
/*  Update Items Check                                                 */
/* ------------------------------------------------------------------ */

/**
 * Determine if PO items can be updated.
 * Ported from PurchaseOrder.can_update_items()
 */
export function canUpdateItems(isSubcontracted: boolean, hasSubcontractingOrder: boolean): boolean {
  if (isSubcontracted && hasSubcontractingOrder) {
    return false;
  }
  return true;
}

/* ------------------------------------------------------------------ */
/*  Close / Unclose                                                    */
/* ------------------------------------------------------------------ */

/**
 * Validate close / unclose action.
 * Ported from close_or_unclose_purchase_orders()
 */
export function validateCloseOrUnclosePO(
  doc: PurchaseOrderDoc,
  status: "Closed" | "Draft"
): ValidationResult<never> {
  if (doc.docstatus !== 1) {
    return { valid: false, error: "Only submitted Purchase Orders can be closed/unclosed." };
  }

  if (status === "Closed") {
    if (doc.status === "Cancelled" || doc.status === "Closed") {
      return { valid: false, error: "Purchase Order is already Cancelled or Closed." };
    }
    if (flt(doc.per_received) >= 100 && flt(doc.per_billed) >= 100) {
      return { valid: false, error: "Purchase Order is fully received and billed." };
    }
  } else {
    if (doc.status !== "Closed") {
      return { valid: false, error: "Purchase Order is not Closed." };
    }
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Purchase Receipt Mapping Helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * Calculate remaining qty for Purchase Receipt mapping.
 * Ported from make_purchase_receipt() update_item logic.
 */
export function calculatePurchaseReceiptQty(
  poItem: PurchaseOrderItem,
  hasUnitPriceItems: boolean
): { qty: number; stock_qty: number; amount: number; base_amount: number } | null {
  const isUnitPriceRow = hasUnitPriceItems && poItem.qty === 0;

  if (!isUnitPriceRow && Math.abs(flt(poItem.received_qty)) >= Math.abs(flt(poItem.qty))) {
    return null;
  }

  if (poItem.delivered_by_supplier) {
    return null;
  }

  const qty = isUnitPriceRow ? flt(poItem.qty) : flt(poItem.qty) - flt(poItem.received_qty);
  const stockQty = qty * flt(poItem.conversion_factor ?? 1);
  const amount = qty * flt(poItem.rate ?? 0);
  const baseAmount = amount * flt(poItem.conversion_factor ?? 1);

  return {
    qty: flt(qty),
    stock_qty: flt(stockQty),
    amount: flt(amount),
    base_amount: flt(baseAmount),
  };
}

/**
 * Build Purchase Receipt item rows from a PO.
 * Pure mapping logic — caller must persist.
 */
export function buildPurchaseReceiptItems(
  poItems: PurchaseOrderItem[],
  hasUnitPriceItems: boolean
): ReceiptMappingRow[] {
  const rows: ReceiptMappingRow[] = [];

  for (const poItem of poItems) {
    const calc = calculatePurchaseReceiptQty(poItem, hasUnitPriceItems);
    if (!calc) continue;

    rows.push({
      item_code: poItem.item_code,
      qty: calc.qty,
      stock_qty: calc.stock_qty,
      amount: calc.amount,
      base_amount: calc.base_amount,
      purchase_order_item: poItem.name,
      bom: poItem.bom,
      material_request: poItem.material_request,
      material_request_item: poItem.material_request_item,
      sales_order: poItem.sales_order,
      sales_order_item: poItem.sales_order_item,
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Purchase Invoice Mapping Helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * Calculate remaining qty for Purchase Invoice mapping.
 * Ported from get_mapped_purchase_invoice() update_item logic.
 */
export function calculatePurchaseInvoiceQty(
  poItem: PurchaseOrderItem,
  billedQty: number
): { qty: number } | null {
  const baseAmount = flt(poItem.amount ?? poItem.qty * (poItem.rate ?? 0));
  const billedAmt = flt(poItem.billed_amt ?? 0);

  const qtyCondition =
    baseAmount === 0 ||
    Math.abs(billedAmt) < Math.abs(baseAmount) ||
    poItem.qty > flt(billedQty);

  if (!qtyCondition) {
    return null;
  }

  const remainingQty = flt(poItem.qty) - flt(billedQty);
  if (remainingQty <= 0) {
    return null;
  }

  return { qty: flt(remainingQty) };
}

/**
 * Build Purchase Invoice item rows from a PO.
 * Pure mapping logic — caller must persist.
 */
export function buildPurchaseInvoiceItems(
  poItems: PurchaseOrderItem[],
  billedQtyMap: Record<string, number>,
  itemDefaultCostCenterMap: Record<string, string | undefined>
): InvoiceMappingRow[] {
  const rows: InvoiceMappingRow[] = [];

  for (const poItem of poItems) {
    const billedQty = billedQtyMap[poItem.name ?? ""] ?? 0;
    const calc = calculatePurchaseInvoiceQty(poItem, billedQty);
    if (!calc) continue;

    rows.push({
      item_code: poItem.item_code,
      qty: calc.qty,
      po_detail: poItem.name,
      purchase_order: poItem.material_request,
      material_request: poItem.material_request,
      material_request_item: poItem.material_request_item,
      cost_center: poItem.cost_center ?? itemDefaultCostCenterMap[poItem.item_code ?? ""],
    });
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Subcontracting Status                                              */
/* ------------------------------------------------------------------ */

/**
 * Check if PO is fully subcontracted.
 * Ported from is_po_fully_subcontracted()
 */
export function isPoFullySubcontracted(items: PurchaseOrderItem[]): boolean {
  return !items.some((item) => flt(item.qty) !== flt(item.subcontracted_qty ?? 0));
}

/* ------------------------------------------------------------------ */
/*  Sales Order Ordered Qty Update                                     */
/* ------------------------------------------------------------------ */

/**
 * Update ordered qty in linked Sales Order for removed items.
 * Ported from PurchaseOrder.update_ordered_qty_in_so_for_removed_items()
 */
export function updateOrderedQtyInSOForRemovedItems(
  removedItems: PurchaseOrderItem[],
  soItemOrderedQtyMap: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = { ...soItemOrderedQtyMap };

  for (const item of removedItems) {
    if (item.sales_order_item) {
      const prevOrderedQty = flt(result[item.sales_order_item] ?? 0);
      result[item.sales_order_item] = flt(prevOrderedQty - flt(item.qty));
    }
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Service Items for Finished Goods                                   */
/* ------------------------------------------------------------------ */

/**
 * Set service items for finished goods in subcontracted PO.
 * Ported from PurchaseOrder.set_service_items_for_finished_goods()
 */
export function setServiceItemsForFinishedGoods(
  items: PurchaseOrderItem[],
  isSubcontracted: boolean,
  subcontractingBoms: Record<string, SubcontractingBOM>
): PurchaseOrderItem[] {
  if (!isSubcontracted) return items;

  return items.map((item) => {
    if (!item.item_code && item.fg_item && subcontractingBoms[item.fg_item]) {
      const bom = subcontractingBoms[item.fg_item];
      const qty = flt(item.fg_item_qty ?? 0) * flt(bom.conversion_factor);
      return {
        ...item,
        item_code: bom.service_item,
        qty,
        uom: bom.service_item_uom,
      };
    }
    return item;
  });
}

/* ------------------------------------------------------------------ */
/*  Previous Doc Validation                                            */
/* ------------------------------------------------------------------ */

export interface PreviousDocContext {
  supplierQuotation?: { supplier: string; company: string; currency: string } | null;
  supplierQuotationItems?: Array<{
    project?: string;
    item_code?: string;
    uom?: string;
    conversion_factor?: number;
  }> | null;
  materialRequest?: { company: string } | null;
  materialRequestItems?: Array<{ project?: string; item_code?: string }> | null;
}

/**
 * Validate PO against previous reference documents.
 * Ported from PurchaseOrder.validate_with_previous_doc()
 */
export function validateWithPreviousDoc(
  doc: PurchaseOrderDoc,
  prev: PreviousDocContext
): ValidationResult<never> {
  if (prev.supplierQuotation) {
    const sq = prev.supplierQuotation;
    if (sq.supplier !== doc.supplier) {
      return { valid: false, error: "Supplier does not match with Supplier Quotation" };
    }
    if (sq.company !== doc.company) {
      return { valid: false, error: "Company does not match with Supplier Quotation" };
    }
    if (sq.currency !== doc.currency) {
      return { valid: false, error: "Currency does not match with Supplier Quotation" };
    }
  }

  if (prev.supplierQuotationItems) {
    for (const sqItem of prev.supplierQuotationItems) {
      if (sqItem.uom && sqItem.conversion_factor === undefined) {
        return {
          valid: false,
          error: "UOM and Conversion Factor must match with Supplier Quotation Item",
        };
      }
    }
  }

  if (prev.materialRequest && prev.materialRequest.company !== doc.company) {
    return { valid: false, error: "Company does not match with Material Request" };
  }

  return { valid: true };
}
