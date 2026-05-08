/**
 * Ported from erpnext/selling/doctype/quotation/quotation.py
 * Pure business logic — no Frappe / Prisma imports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QuotationItem {
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
  is_alternative?: boolean;
  has_alternative_item?: boolean;
  ordered_qty?: number;
  prevdoc_docname?: string;
  against_blanket_order?: string;
  blanket_order?: string;
  blanket_order_rate?: number;
}

export type QuotationStatus =
  | "Draft"
  | "Open"
  | "Replied"
  | "Partially Ordered"
  | "Ordered"
  | "Lost"
  | "Cancelled"
  | "Expired";

export type OrderType = "" | "Sales" | "Maintenance" | "Shopping Cart";
export type QuotationTo = "Customer" | "Lead" | "Prospect" | "CRM Deal";

export interface Quotation {
  name?: string;
  docstatus: number;
  status?: QuotationStatus;
  order_type: OrderType;
  transaction_date: string; // ISO date
  valid_till?: string; // ISO date
  quotation_to: QuotationTo;
  party_name?: string;
  customer_name?: string;
  customer_address?: string;
  shipping_address_name?: string;
  shipping_address?: string;
  company: string;
  currency: string;
  conversion_rate: number;
  selling_price_list?: string;
  price_list_currency?: string;
  plc_conversion_rate?: number;
  project?: string;
  opportunity?: string;
  referral_sales_partner?: string;
  supplier_quotation?: string;
  tax_category?: string;
  taxes_and_charges?: string;
  shipping_rule?: string;
  incoterm?: string;
  named_place?: string;
  tc_name?: string;
  terms?: string;
  letter_head?: string;
  group_same_items?: boolean;
  select_print_heading?: string;
  language?: string;
  coupon_code?: string;
  grand_total?: number;
  base_grand_total?: number;
  total?: number;
  base_total?: number;
  net_total?: number;
  base_net_total?: number;
  total_qty?: number;
  total_net_weight?: number;
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
  disable_rounded_total?: boolean;
  has_unit_price_items?: boolean;
  with_items?: boolean;
  lost_reasons?: { lost_reason: string }[];
  competitors?: { competitor: string }[];
  order_lost_reason?: string;
  items: QuotationItem[];
  sales_team?: { sales_person: string; allocated_percentage: number; commission_rate?: number; allocated_amount?: number; incentives?: number }[];
}

export interface QuotationValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  doc?: Quotation;
}

export interface SellingSettings {
  allow_zero_qty_in_quotation: boolean;
  allow_sales_order_creation_for_expired_quotation: boolean;
}

export interface OrderedItemInfo {
  [quotationItemName: string]: number;
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

function nowdate(): string {
  return new Date().toISOString().split("T")[0];
}

/* ------------------------------------------------------------------ */
/*  Validation entry point                                             */
/* ------------------------------------------------------------------ */

export function validateQuotation(
  doc: Quotation,
  settings: SellingSettings
): QuotationValidationResult {
  const warnings: string[] = [];

  // Set status
  doc.status = getQuotationStatus(doc);

  // UOM integer validations
  for (const item of doc.items) {
    if (item.stock_uom && item.stock_qty && !Number.isInteger(item.stock_qty)) {
      return { success: false, error: `Row ${item.idx}: Stock Qty must be whole number for UOM ${item.stock_uom}` };
    }
    if (item.uom && item.qty && !Number.isInteger(item.qty)) {
      return { success: false, error: `Row ${item.idx}: Qty must be whole number for UOM ${item.uom}` };
    }
  }

  // Valid till
  const vtErr = validateValidTill(doc);
  if (vtErr) return { success: false, error: vtErr };

  // Customer name
  doc.customer_name = resolveCustomerName(doc);

  // With items flag
  if (doc.items && doc.items.length > 0) {
    doc.with_items = true;
  }

  // Set has_unit_price_items
  if (settings.allow_zero_qty_in_quotation) {
    doc.has_unit_price_items = doc.items.some((row) => row.item_code && !row.qty);
  }

  return { success: true, warnings, doc };
}

/* ------------------------------------------------------------------ */
/*  validateValidTill                                                 */
/* ------------------------------------------------------------------ */

export function validateValidTill(doc: Quotation): string | undefined {
  if (doc.valid_till) {
    const validTill = getdate(doc.valid_till);
    const txDate = getdate(doc.transaction_date);
    if (validTill && txDate && validTill < txDate) {
      return "Valid till date cannot be before transaction date";
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  resolveCustomerName                                               */
/* ------------------------------------------------------------------ */

export function resolveCustomerName(doc: Quotation): string {
  if (doc.quotation_to === "Customer" && doc.party_name) {
    return doc.customer_name ?? doc.party_name;
  }
  if (doc.quotation_to === "Lead" && doc.party_name) {
    return doc.customer_name ?? doc.party_name;
  }
  if (doc.quotation_to === "Prospect" && doc.party_name) {
    return doc.customer_name ?? doc.party_name;
  }
  if (doc.quotation_to === "CRM Deal" && doc.party_name) {
    return doc.customer_name ?? doc.party_name;
  }
  return doc.customer_name ?? "";
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

export function getQuotationStatus(doc: Quotation): QuotationStatus {
  if (doc.docstatus === 0) return "Draft";
  if (doc.docstatus === 2) return "Cancelled";

  const orderedStatus = getOrderedStatus(doc, {});
  if (orderedStatus === "Ordered") return "Ordered";
  if (orderedStatus === "Partially Ordered") return "Partially Ordered";

  if (doc.valid_till) {
    const vt = getdate(doc.valid_till);
    const today = getdate(nowdate());
    if (vt && today && vt < today) return "Expired";
  }

  return "Open";
}

export function getOrderedStatus(
  doc: Quotation,
  orderedItems: OrderedItemInfo
): "Open" | "Partially Ordered" | "Ordered" {
  if (!orderedItems || Object.keys(orderedItems).length === 0) return "Open";

  const hasAlternatives = doc.items.some((row) => row.is_alternative);
  const checkItems = hasAlternatives ? getValidItems(doc, {}) : doc.items;

  for (const row of checkItems) {
    const ordered = orderedItems[row.name] ?? 0;
    if (row.stock_qty > ordered) return "Partially Ordered";
  }

  return "Ordered";
}

export function getValidItems(
  doc: Quotation,
  salesOrderItemsByQuotationItem: Record<string, { item_code: string }[]>
): QuotationItem[] {
  function isInSalesOrder(row: QuotationItem): boolean {
    const soItems = salesOrderItemsByQuotationItem[row.name] ?? [];
    return soItems.some((so) => so.item_code === row.item_code);
  }

  function canMap(row: QuotationItem): boolean {
    if (row.is_alternative || row.has_alternative_item) {
      return isInSalesOrder(row);
    }
    return true;
  }

  return doc.items.filter(canMap);
}

export function isFullyOrdered(doc: Quotation, orderedItems: OrderedItemInfo): boolean {
  return getOrderedStatus(doc, orderedItems) === "Ordered";
}

export function isPartiallyOrdered(doc: Quotation, orderedItems: OrderedItemInfo): boolean {
  return getOrderedStatus(doc, orderedItems) === "Partially Ordered";
}

/* ------------------------------------------------------------------ */
/*  Alternative item helpers                                           */
/* ------------------------------------------------------------------ */

export function setHasAlternativeItem(doc: Quotation): Quotation {
  if (!doc.items.some((row) => row.is_alternative)) return doc;

  const itemsWithAlternatives = getRowsWithAlternatives(doc.items);
  for (const row of doc.items) {
    if (!row.is_alternative && itemsWithAlternatives.includes(row.name)) {
      row.has_alternative_item = true;
    }
  }
  return doc;
}

export function getRowsWithAlternatives(items: QuotationItem[]): string[] {
  const rows: string[] = [];
  const tableLength = items.length;

  for (let idx = 0; idx < tableLength; idx++) {
    const row = items[idx];
    if (row.is_alternative) continue;
    if (idx === tableLength - 1) break;
    if (items[idx + 1].is_alternative) {
      rows.push(row.name);
    }
  }

  return rows;
}

/* ------------------------------------------------------------------ */
/*  Declare enquiry lost                                               */
/* ------------------------------------------------------------------ */

export function canDeclareLost(
  doc: Quotation,
  orderedItems: OrderedItemInfo
): { canDeclare: boolean; error?: string } {
  if (isFullyOrdered(doc, orderedItems) || isPartiallyOrdered(doc, orderedItems)) {
    return { canDeclare: false, error: "Cannot set as Lost as Sales Order is made." };
  }
  return { canDeclare: true };
}

export function declareEnquiryLost(
  doc: Quotation,
  lostReasonsList: { lost_reason: string }[],
  validReasons: string[],
  competitors: { competitor: string }[],
  detailedReason?: string
): QuotationValidationResult {
  const errors: string[] = [];

  for (const reason of lostReasonsList) {
    if (!validReasons.includes(reason.lost_reason)) {
      errors.push(`Invalid lost reason ${reason.lost_reason}, please create a new lost reason`);
    }
  }

  if (errors.length) {
    return { success: false, error: errors.join("\n") };
  }

  doc.status = "Lost";
  if (detailedReason) {
    doc.order_lost_reason = detailedReason;
  }
  doc.lost_reasons = lostReasonsList;
  doc.competitors = competitors;

  return { success: true, doc };
}

/* ------------------------------------------------------------------ */
/*  Expired status                                                     */
/* ------------------------------------------------------------------ */

export function shouldSetExpired(
  doc: Quotation,
  hasSalesOrder: boolean
): boolean {
  if (doc.docstatus !== 1) return false;
  if (doc.status === "Expired" || doc.status === "Lost" || doc.status === "Cancelled") return false;
  if (!doc.valid_till) return false;

  const vt = getdate(doc.valid_till);
  const today = getdate(nowdate());
  if (!vt || !today) return false;

  if (vt >= today) return false;
  if (hasSalesOrder) return false;

  return true;
}

/* ------------------------------------------------------------------ */
/*  Indicator                                                          */
/* ------------------------------------------------------------------ */

export function setQuotationIndicator(
  docstatus: number,
  validTill?: string
): { color: string; title: string } {
  if (docstatus === 1) {
    if (validTill) {
      const vt = getdate(validTill);
      const today = getdate(nowdate());
      if (vt && today && vt < today) {
        return { color: "gray", title: "Expired" };
      }
    }
    return { color: "blue", title: "Submitted" };
  }
  return { color: "gray", title: "Draft" };
}

/* ------------------------------------------------------------------ */
/*  Sales Order mapping helpers                                        */
/* ------------------------------------------------------------------ */

export interface SalesOrderItemDraft {
  item_code: string;
  qty: number;
  stock_qty: number;
  rate: number;
  amount: number;
  conversion_factor: number;
  uom?: string;
  stock_uom?: string;
  warehouse?: string;
  against_blanket_order?: string;
  blanket_order?: string;
  blanket_order_rate?: number;
  prevdoc_docname?: string;
  quotation_item?: string;
}

export function canMapRowToSalesOrder(
  item: QuotationItem,
  orderedItems: OrderedItemInfo,
  selectedRows: string[],
  hasUnitPriceItems: boolean
): boolean {
  const isUnitPriceRow = hasUnitPriceItems && item.qty === 0;

  if (!(item.stock_qty > (orderedItems[item.name] ?? 0) || isUnitPriceRow)) {
    return false;
  }

  if (!selectedRows || selectedRows.length === 0) {
    return !item.is_alternative;
  }

  if (selectedRows.length > 0 && (item.is_alternative || item.has_alternative_item)) {
    return selectedRows.includes(item.name);
  }

  return true;
}

export function mapQuotationItemToSO(
  source: QuotationItem,
  orderedItems: OrderedItemInfo
): SalesOrderItemDraft {
  const balanceStockQty = Math.max(
    flt(source.stock_qty) - flt(orderedItems[source.name] ?? 0),
    0
  );
  const qty = flt(balanceStockQty) / flt(source.conversion_factor || 1);

  return {
    item_code: source.item_code,
    qty,
    stock_qty: balanceStockQty,
    rate: source.rate,
    amount: flt(qty * source.rate),
    conversion_factor: source.conversion_factor || 1,
    uom: source.uom,
    stock_uom: source.stock_uom,
    warehouse: source.warehouse,
    against_blanket_order: source.against_blanket_order,
    blanket_order: source.blanket_order,
    blanket_order_rate: source.blanket_order_rate,
    prevdoc_docname: source.name,
    quotation_item: source.name,
  };
}

/* ------------------------------------------------------------------ */
/*  Sales Invoice mapping helpers                                      */
/* ------------------------------------------------------------------ */

export interface SalesInvoiceItemDraft {
  item_code: string;
  qty: number;
  stock_qty: number;
  rate: number;
  amount: number;
  conversion_factor: number;
  cost_center?: string;
}

export function mapQuotationItemToSI(
  source: QuotationItem
): SalesInvoiceItemDraft {
  const stockQty = flt(source.qty) * flt(source.conversion_factor || 1);
  return {
    item_code: source.item_code,
    qty: source.qty,
    stock_qty: stockQty,
    rate: source.rate,
    amount: source.amount,
    conversion_factor: source.conversion_factor || 1,
  };
}

/* ------------------------------------------------------------------ */
/*  setHasUnitPriceItems                                               */
/* ------------------------------------------------------------------ */

export function setHasUnitPriceItems(
  doc: Quotation,
  settings: SellingSettings
): Quotation {
  if (!settings.allow_zero_qty_in_quotation) {
    doc.has_unit_price_items = false;
    return doc;
  }
  doc.has_unit_price_items = doc.items.some((row) => row.item_code && !row.qty);
  return doc;
}
