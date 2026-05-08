/**
 * Ported from erpnext/selling/doctype/sales_order/sales_order.py
 * Pure business logic — no Frappe / Prisma imports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SalesOrderItem {
  name: string;
  idx: number;
  item_code: string;
  item_name?: string;
  description?: string;
  qty: number;
  rate: number;
  amount: number;
  stock_qty: number;
  stock_uom?: string;
  uom?: string;
  conversion_factor: number;
  warehouse?: string;
  delivered_qty?: number;
  picked_qty?: number;
  billed_amt?: number;
  returned_qty?: number;
  ordered_qty?: number;
  requested_qty?: number;
  produced_qty?: number;
  reserve_stock?: boolean;
  is_stock_item?: boolean;
  delivered_by_supplier?: boolean;
  supplier?: string;
  delivery_date?: string; // ISO date
  quotation_item?: string;
  prevdoc_docname?: string;
  fg_item?: string;
  fg_item_qty?: number;
  is_alternative?: boolean;
  has_alternative_item?: boolean;
  ensure_delivery_based_on_produced_serial_no?: boolean;
  against_blanket_order?: string;
  blanket_order?: string;
  blanket_order_rate?: number;
  subcontracted_qty?: number;
}

export type SalesOrderStatus =
  | ""
  | "Draft"
  | "On Hold"
  | "To Pay"
  | "To Deliver and Bill"
  | "To Bill"
  | "To Deliver"
  | "Completed"
  | "Cancelled"
  | "Closed";

export type BillingStatus = "Not Billed" | "Fully Billed" | "Partly Billed" | "Closed";
export type DeliveryStatus = "Not Delivered" | "Fully Delivered" | "Partly Delivered" | "Closed" | "Not Applicable";
export type AdvancePaymentStatus = "Not Requested" | "Requested" | "Partially Paid" | "Fully Paid";
export type OrderType = "" | "Sales" | "Maintenance" | "Shopping Cart";

export interface SalesOrder {
  name?: string;
  docstatus: number;
  status?: SalesOrderStatus;
  billing_status?: BillingStatus;
  delivery_status?: DeliveryStatus;
  advance_payment_status?: AdvancePaymentStatus;
  order_type: OrderType;
  transaction_date: string; // ISO date
  delivery_date?: string;
  customer: string;
  customer_name?: string;
  company: string;
  currency: string;
  conversion_rate: number;
  project?: string;
  po_no?: string;
  po_date?: string;
  skip_delivery_note?: boolean;
  is_subcontracted?: boolean;
  reserve_stock?: boolean;
  has_unit_price_items?: boolean;
  per_delivered?: number;
  per_billed?: number;
  per_picked?: number;
  grand_total?: number;
  base_grand_total?: number;
  total?: number;
  base_total?: number;
  net_total?: number;
  base_net_total?: number;
  total_qty?: number;
  total_taxes_and_charges?: number;
  base_total_taxes_and_charges?: number;
  discount_amount?: number;
  base_discount_amount?: number;
  additional_discount_percentage?: number;
  apply_discount_on?: "" | "Grand Total" | "Net Total";
  rounded_total?: number;
  base_rounded_total?: number;
  rounding_adjustment?: number;
  base_rounding_adjustment?: number;
  in_words?: string;
  base_in_words?: string;
  selling_price_list?: string;
  price_list_currency?: string;
  plc_conversion_rate?: number;
  tax_category?: string;
  taxes_and_charges?: string;
  shipping_rule?: string;
  incoterm?: string;
  named_place?: string;
  source_warehouse?: string;
  set_warehouse?: string;
  tc_name?: string;
  terms?: string;
  letter_head?: string;
  group_same_items?: boolean;
  select_print_heading?: string;
  language?: string;
  inter_company_order_reference?: string;
  represents_company?: string;
  is_internal_customer?: boolean;
  coupon_code?: string;
  loyalty_points?: number;
  loyalty_amount?: number;
  commission_rate?: number;
  total_commission?: number;
  amount_eligible_for_commission?: number;
  disable_rounded_total?: boolean;
  items: SalesOrderItem[];
  sales_team?: { sales_person: string; allocated_percentage: number; commission_rate?: number; allocated_amount?: number; incentives?: number }[];
  packed_items?: PackedItem[];
}

export interface PackedItem {
  name: string;
  parent_item: string;
  parent_detail_docname: string;
  item_code: string;
  warehouse?: string;
  qty: number;
  stock_qty?: number;
  ordered_qty?: number;
  requested_qty?: number;
  conversion_factor?: number;
}

export interface SalesOrderValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  doc?: SalesOrder;
}

export interface ItemWarehouseSetting {
  item_code: string;
  is_stock_item: boolean;
  has_serial_no: boolean;
  is_sub_contracted_item: boolean;
  default_bom?: string;
}

export interface ProductBundleInfo {
  item_code: string;
  disabled: boolean;
  items?: { item_code: string; qty: number }[];
}

export interface StockSettings {
  enable_stock_reservation: boolean;
  auto_reserve_stock: boolean;
  over_picking_allowance: number;
  use_serial_batch_fields: boolean;
}

export interface SellingSettings {
  allow_zero_qty_in_sales_order: boolean;
  allow_against_multiple_purchase_orders: boolean;
  sales_update_frequency: "Each Transaction" | "Daily" | "Weekly" | "Monthly";
  maintain_same_sales_rate: boolean;
  enable_cutoff_date_on_bulk_delivery_note_creation: boolean;
}

export interface CompanySettings {
  credit_limit?: number;
}

export interface ReservedQtyDetails {
  [itemName: string]: number;
}

export interface WorkOrderInfo {
  sales_order_item: string;
  sales_order: string;
  production_item: string;
  qty: number;
  process_loss_qty: number;
  status: string;
}

export interface BOMInfo {
  item: string;
  is_active: boolean;
  name: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function getdate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function cint(value: number | string | undefined): number {
  return typeof value === "number" ? Math.trunc(value) : parseInt(value ?? "0", 10);
}

/* ------------------------------------------------------------------ */
/*  Validation entry point                                             */
/* ------------------------------------------------------------------ */

export function validateSalesOrder(
  doc: SalesOrder,
  itemMap: Record<string, ItemWarehouseSetting>,
  bundleMap: Record<string, ProductBundleInfo>,
  settings: SellingSettings,
  stockSettings: StockSettings
): SalesOrderValidationResult {
  const warnings: string[] = [];

  // Delivery date validation
  const deliveryErr = validateDeliveryDate(doc);
  if (deliveryErr) return { success: false, error: deliveryErr };

  // UOM integer validations
  for (const item of doc.items) {
    if (item.stock_uom && item.stock_qty && !Number.isInteger(item.stock_qty)) {
      return { success: false, error: `Row ${item.idx}: Stock Qty must be whole number for UOM ${item.stock_uom}` };
    }
    if (item.uom && item.qty && !Number.isInteger(item.qty)) {
      return { success: false, error: `Row ${item.idx}: Qty must be whole number for UOM ${item.uom}` };
    }
  }

  // Item validations (projected qty lookup is skipped — pure logic)
  for (const item of doc.items) {
    item.ordered_qty = flt(item.ordered_qty);
  }

  // Warehouse validation
  const whErr = validateWarehouse(doc, itemMap, bundleMap);
  if (whErr) return { success: false, error: whErr };

  // Drop ship validation
  const dsErr = validateDropShip(doc);
  if (dsErr) return { success: false, error: dsErr };

  // Serial no based delivery
  const serialErr = validateSerialNoBasedDelivery(doc, itemMap);
  if (serialErr) return { success: false, error: serialErr };

  // Reserved stock
  validateReservedStock(doc, stockSettings, itemMap);

  // FG item for subcontracting
  const fgErr = validateFgItemForSubcontracting(doc, itemMap, {});
  if (fgErr) return { success: false, error: fgErr };

  // PO validation
  const poErr = validatePO(doc, [], settings);
  if (poErr) return { success: false, error: poErr };

  // Set default statuses
  if (!doc.billing_status) doc.billing_status = "Not Billed";
  if (!doc.delivery_status) doc.delivery_status = "Not Delivered";
  if (!doc.advance_payment_status) doc.advance_payment_status = "Not Requested";

  // Auto reserve stock on new
  if (doc.docstatus === 0 && stockSettings.auto_reserve_stock) {
    doc.reserve_stock = true;
  }

  // Set has_unit_price_items
  if (settings.allow_zero_qty_in_sales_order) {
    doc.has_unit_price_items = doc.items.some((row) => row.item_code && !row.qty);
  }

  // Set missing delivery dates on items
  if (doc.delivery_date) {
    for (const item of doc.items) {
      if (!item.delivery_date) item.delivery_date = doc.delivery_date;
    }
  }

  return { success: true, warnings, doc };
}

/* ------------------------------------------------------------------ */
/*  validateDeliveryDate                                               */
/* ------------------------------------------------------------------ */

export function validateDeliveryDate(doc: SalesOrder): string | undefined {
  if (doc.order_type === "Sales" && !doc.skip_delivery_note) {
    const deliveryDateList = doc.items
      .map((d) => d.delivery_date)
      .filter((d): d is string => !!d);

    const maxDeliveryDate = deliveryDateList.length > 0
      ? deliveryDateList.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
      : undefined;

    if ((maxDeliveryDate && !doc.delivery_date) ||
        (maxDeliveryDate && doc.delivery_date && getdate(doc.delivery_date)?.getTime() !== getdate(maxDeliveryDate)?.getTime())) {
      doc.delivery_date = maxDeliveryDate;
    }

    const txDate = getdate(doc.transaction_date);
    if (doc.delivery_date) {
      for (const d of doc.items) {
        if (!d.delivery_date) d.delivery_date = doc.delivery_date;
        const dd = getdate(d.delivery_date);
        if (txDate && dd && txDate > dd) {
          return "Expected Delivery Date should be after Sales Order Date";
        }
      }
    } else {
      return "Please enter Delivery Date";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validatePO                                                         */
/* ------------------------------------------------------------------ */

export function validatePO(
  doc: SalesOrder,
  existingSOs: { name: string; po_no: string; customer: string; docstatus: number }[],
  settings: SellingSettings
): string | undefined {
  if (doc.po_date && !doc.skip_delivery_note) {
    const poDate = getdate(doc.po_date);
    for (const d of doc.items) {
      const dd = getdate(d.delivery_date);
      if (dd && poDate && poDate > dd) {
        return `Row ${d.idx}: Expected Delivery Date cannot be before Purchase Order Date`;
      }
    }
  }

  if (doc.po_no && doc.customer && !doc.skip_delivery_note) {
    const dup = existingSOs.find(
      (so) => so.po_no === doc.po_no && so.name !== doc.name && so.docstatus < 2 && so.customer === doc.customer
    );
    if (dup) {
      if (settings.allow_against_multiple_purchase_orders) {
        return undefined; // Warning only, caller should handle
      }
      return `Sales Order ${dup.name} already exists against Customer's Purchase Order ${doc.po_no}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateWarehouse                                                  */
/* ------------------------------------------------------------------ */

export function validateWarehouse(
  doc: SalesOrder,
  itemMap: Record<string, ItemWarehouseSetting>,
  bundleMap: Record<string, ProductBundleInfo>
): string | undefined {
  for (const d of doc.items) {
    const item = itemMap[d.item_code];
    const isStockItem = item?.is_stock_item === true;
    const hasBundleStock = !!(
      bundleMap[d.item_code]?.items?.some((bi) => itemMap[bi.item_code]?.is_stock_item)
    );
    if ((isStockItem || hasBundleStock) && !d.warehouse && !cint(d.delivered_by_supplier ? 1 : 0)) {
      return `Delivery warehouse required for stock item ${d.item_code}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateDropShip                                                   */
/* ------------------------------------------------------------------ */

export function validateDropShip(doc: SalesOrder): string | undefined {
  for (const d of doc.items) {
    if (d.delivered_by_supplier && !d.supplier) {
      return `Row ${d.idx}: Set Supplier for item ${d.item_code}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateSerialNoBasedDelivery                                      */
/* ------------------------------------------------------------------ */

export function validateSerialNoBasedDelivery(
  doc: SalesOrder,
  itemMap: Record<string, ItemWarehouseSetting>
): string | undefined {
  const reservedItems: string[] = [];
  const normalItems: string[] = [];

  for (const item of doc.items) {
    if (item.ensure_delivery_based_on_produced_serial_no) {
      if (normalItems.includes(item.item_code)) {
        return `Cannot ensure delivery by Serial No as Item ${item.item_code} is added with and without Ensure Delivery by Serial No.`;
      }
      if (!reservedItems.includes(item.item_code)) {
        const master = itemMap[item.item_code];
        if (!master?.has_serial_no) {
          return `Item ${item.item_code} has no Serial No. Only serialized items can have delivery based on Serial No`;
        }
      }
      reservedItems.push(item.item_code);
    } else {
      normalItems.push(item.item_code);
    }

    if (!item.ensure_delivery_based_on_produced_serial_no && reservedItems.includes(item.item_code)) {
      return `Cannot ensure delivery by Serial No as Item ${item.item_code} is added with and without Ensure Delivery by Serial No.`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateReservedStock                                              */
/* ------------------------------------------------------------------ */

export function validateReservedStock(
  doc: SalesOrder,
  stockSettings: StockSettings,
  itemMap: Record<string, ItemWarehouseSetting>
): void {
  const enableStockReservation = stockSettings.enable_stock_reservation;
  for (const item of doc.items) {
    if (item.reserve_stock && (!enableStockReservation || !itemMap[item.item_code]?.is_stock_item)) {
      item.reserve_stock = false;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  validateFgItemForSubcontracting                                    */
/* ------------------------------------------------------------------ */

export function validateFgItemForSubcontracting(
  doc: SalesOrder,
  itemMap: Record<string, ItemWarehouseSetting>,
  subcontractingBOMs: Record<string, { finished_good: string; finished_good_bom: string }[]>
): string | undefined {
  if (doc.is_subcontracted) {
    for (const item of doc.items) {
      if (!item.fg_item) {
        return `Row ${item.idx}: Finished Good Item is not specified for service item ${item.item_code}`;
      }
      const fgMaster = itemMap[item.fg_item];
      if (!fgMaster?.is_sub_contracted_item) {
        return `Row ${item.idx}: Finished Good Item ${item.fg_item} must be a sub-contracted item`;
      }
      const hasSubBOM = (subcontractingBOMs[item.fg_item] ?? []).some((b) => b.finished_good_bom);
      const hasDefaultBOM = !!fgMaster?.default_bom;
      if (!hasSubBOM && !hasDefaultBOM) {
        return `Row ${item.idx}: BOM not found for FG Item ${item.fg_item}`;
      }
      if (!item.fg_item_qty) {
        return `Row ${item.idx}: Finished Good Item Qty can not be zero`;
      }
    }
  } else {
    for (const item of doc.items) {
      item.fg_item = undefined;
      item.fg_item_qty = 0;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  getUnreservedQty                                                   */
/* ------------------------------------------------------------------ */

export function getUnreservedQty(
  item: SalesOrderItem,
  reservedQtyDetails: ReservedQtyDetails
): number {
  const existingReservedQty = reservedQtyDetails[item.name] ?? 0;
  return flt(
    item.stock_qty -
      flt(item.delivered_qty ?? 0) * (item.conversion_factor || 1) -
      existingReservedQty,
    2
  );
}

/* ------------------------------------------------------------------ */
/*  hasUnreservedStock                                                 */
/* ------------------------------------------------------------------ */

export function hasUnreservedStock(
  doc: SalesOrder,
  reservedQtyDetails: ReservedQtyDetails
): boolean {
  for (const item of doc.items) {
    if (!item.reserve_stock) continue;
    const unreserved = getUnreservedQty(item, reservedQtyDetails);
    if (unreserved > 0) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

export function getDeliveryStatus(doc: SalesOrder): DeliveryStatus {
  if (doc.skip_delivery_note) return "Not Applicable";

  const totQty = doc.items.reduce((s, i) => s + flt(i.qty), 0);
  const deliveredQty = doc.items.reduce((s, i) => s + Math.min(flt(i.delivered_qty ?? 0), flt(i.qty)), 0);

  if (totQty === 0) return "Not Delivered";

  const perDelivered = (deliveredQty / totQty) * 100;
  if (perDelivered >= 100) return "Fully Delivered";
  if (perDelivered > 0) return "Partly Delivered";
  return "Not Delivered";
}

export function getBillingStatus(doc: SalesOrder): BillingStatus {
  const totAmt = doc.items.reduce((s, i) => s + flt(i.amount), 0);
  const billedAmt = doc.items.reduce((s, i) => s + flt(i.billed_amt ?? 0), 0);

  if (totAmt === 0) return "Not Billed";

  const perBilled = (billedAmt / totAmt) * 100;
  if (perBilled >= 100) return "Fully Billed";
  if (perBilled > 0) return "Partly Billed";
  return "Not Billed";
}

export function calculatePerDelivered(doc: SalesOrder): number {
  const totQty = doc.items.reduce((s, i) => s + flt(i.qty), 0);
  const deliveredQty = doc.items.reduce((s, i) => s + Math.min(flt(i.delivered_qty ?? 0), flt(i.qty)), 0);
  if (!totQty) return 0;
  return flt((deliveredQty / totQty) * 100, 2);
}

export function calculatePerBilled(doc: SalesOrder): number {
  const totAmt = doc.items.reduce((s, i) => s + flt(i.amount), 0);
  const billedAmt = doc.items.reduce((s, i) => s + flt(i.billed_amt ?? 0), 0);
  if (!totAmt) return 0;
  return flt((billedAmt / totAmt) * 100, 2);
}

export function calculatePerPicked(doc: SalesOrder): number {
  let totalPickedQty = 0;
  let totalQty = 0;
  for (const item of doc.items) {
    totalPickedQty += flt(item.picked_qty ?? 0);
    totalQty += flt(item.stock_qty ?? 0);
  }
  if (!totalQty) return 0;
  return flt((totalPickedQty / totalQty) * 100, 2);
}

export function updatePickingStatus(
  doc: SalesOrder,
  stockSettings: StockSettings
): { per_picked: number; error?: string } {
  let totalPickedQty = 0;
  let totalQty = 0;

  for (const item of doc.items) {
    totalPickedQty += flt(item.picked_qty ?? 0);
    totalQty += flt(item.stock_qty ?? 0);
  }

  let perPicked = 0;
  if (totalPickedQty && totalQty) {
    perPicked = (totalPickedQty / totalQty) * 100;

    const pickPercentage = stockSettings.over_picking_allowance;
    if (pickPercentage) {
      totalQty += flt(totalQty) * (pickPercentage / 100);
    }

    if (totalPickedQty > totalQty) {
      return {
        per_picked: flt(perPicked, 2),
        error: `Total Picked Quantity ${totalPickedQty} is more than ordered qty ${totalQty}. You can set the Over Picking Allowance in Stock Settings.`,
      };
    }
  }

  return { per_picked: flt(perPicked, 2) };
}

export function setSalesOrderStatus(doc: SalesOrder): SalesOrderStatus {
  if (doc.docstatus === 0) return "Draft";
  if (doc.docstatus === 2) return "Cancelled";

  const perDelivered = calculatePerDelivered(doc);
  const perBilled = calculatePerBilled(doc);

  if (perDelivered >= 100 && perBilled >= 100) return "Completed";
  if (perDelivered >= 100 && perBilled < 100) return "To Bill";
  if (perDelivered < 100 && perBilled >= 100) return "To Deliver";
  return "To Deliver and Bill";
}

export function setIndicator(status: SalesOrderStatus): { color: string; title: string } {
  const colorMap: Record<string, string> = {
    Draft: "red",
    "On Hold": "orange",
    "To Deliver and Bill": "orange",
    "To Bill": "orange",
    "To Deliver": "orange",
    Completed: "green",
    Cancelled: "red",
  };
  return { color: colorMap[status] ?? "blue", title: status };
}

/* ------------------------------------------------------------------ */
/*  close / unclose helpers                                            */
/* ------------------------------------------------------------------ */

export function canCloseOrUnclose(
  doc: SalesOrder,
  targetStatus: "Closed" | "Draft"
): { allowed: boolean; error?: string } {
  if (doc.docstatus !== 1) {
    return { allowed: false, error: "Only submitted Sales Orders can be closed/unclosed" };
  }
  if (targetStatus === "Closed") {
    if (doc.status === "Cancelled" || doc.status === "Closed") {
      return { allowed: false, error: "Sales Order is already Closed or Cancelled" };
    }
    if (calculatePerDelivered(doc) >= 100 && calculatePerBilled(doc) >= 100) {
      return { allowed: false, error: "Fully delivered and billed Sales Order cannot be closed" };
    }
  }
  return { allowed: true };
}

/* ------------------------------------------------------------------ */
/*  Supplier after submit validation                                   */
/* ------------------------------------------------------------------ */

export function validateSupplierAfterSubmit(
  doc: SalesOrder,
  originalSuppliers: Record<string, string | undefined>
): string | undefined {
  const errors: string[] = [];
  for (const item of doc.items) {
    if (item.supplier) {
      const original = originalSuppliers[item.name];
      if ((item.ordered_qty ?? 0) > 0 && item.supplier !== original) {
        errors.push(`Row ${item.idx}: Not allowed to change Supplier as Purchase Order already exists`);
      }
    }
  }
  if (errors.length) return errors.join("\n");
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Work Order helpers                                                 */
/* ------------------------------------------------------------------ */

export function getWorkOrderItems(
  doc: SalesOrder,
  workOrders: WorkOrderInfo[],
  boms: Record<string, string>, // item_code -> default_bom
  productBundleParents: string[],
  overproductionPercentage: number,
  forRawMaterialRequest: boolean
): {
  name: string;
  item_code: string;
  item_name?: string;
  description?: string;
  bom: string;
  warehouse?: string;
  pending_qty: number;
  required_qty: number;
  sales_order_item: string;
}[] {
  const items: ReturnType<typeof getWorkOrderItems> = [];

  for (const i of doc.items) {
    const bom = boms[i.item_code];
    const stockQty = i.stock_qty;

    let pendingQty: number;
    if (!forRawMaterialRequest) {
      const totalWOQty = workOrders
        .filter(
          (wo) =>
            wo.production_item === i.item_code &&
            wo.sales_order === doc.name &&
            wo.sales_order_item === i.name &&
            wo.status !== "Closed"
        )
        .reduce((s, wo) => s + flt(wo.qty - wo.process_loss_qty), 0);
      pendingQty = stockQty - totalWOQty;
    } else {
      pendingQty = stockQty;
    }

    if (!pendingQty) {
      pendingQty = stockQty * overproductionPercentage;
    }

    if (pendingQty > 0 && !productBundleParents.includes(i.item_code) && bom) {
      items.push({
        name: i.name,
        item_code: i.item_code,
        item_name: i.item_name,
        description: i.description,
        bom,
        warehouse: i.warehouse,
        pending_qty: pendingQty,
        required_qty: forRawMaterialRequest ? pendingQty : 0,
        sales_order_item: i.name,
      });
    }
  }

  return items;
}

/* ------------------------------------------------------------------ */
/*  Remaining qty for material request                                 */
/* ------------------------------------------------------------------ */

export function getRemainingQty(
  soItem: SalesOrderItem,
  requestedQtyMap: Record<string, number>
): number {
  return flt(
    flt(soItem.qty) -
      flt(requestedQtyMap[soItem.name] ?? 0) -
      Math.max(flt(soItem.delivered_qty ?? 0), 0),
    2
  );
}

export function getRemainingPackedItemQty(
  packedItem: PackedItem,
  requestedQtyMap: Record<string, number>,
  deliveredQty: number,
  bundleItemQty: number
): number {
  return flt(
    flt(packedItem.qty) -
      flt(requestedQtyMap[packedItem.name] ?? 0) -
      Math.max(flt(deliveredQty) * flt(bundleItemQty), 0),
    2
  );
}

/* ------------------------------------------------------------------ */
/*  Update produced qty                                                */
/* ------------------------------------------------------------------ */

export function updateProducedQty(
  salesOrderItem: SalesOrderItem,
  linkedWorkOrders: { produced_qty: number }[]
): number {
  let totalProducedQty = 0;
  for (const wo of linkedWorkOrders) {
    totalProducedQty += flt(wo.produced_qty);
  }
  return totalProducedQty;
}

/* ------------------------------------------------------------------ */
/*  Subcontracting helpers                                             */
/* ------------------------------------------------------------------ */

export function isSoFullySubcontracted(doc: SalesOrder): boolean {
  return doc.items.every((item) => flt(item.qty) === flt(item.subcontracted_qty ?? 0));
}
