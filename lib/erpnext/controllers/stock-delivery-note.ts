// =============================================================================
// stock-delivery-note.ts
// Ported from ERPNext: stock/doctype/delivery_note/delivery_note.py
// Pure business logic — NO database / Prisma / Frappe calls.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeliveryNoteStatus =
  | ""
  | "Draft"
  | "To Bill"
  | "Partially Billed"
  | "Completed"
  | "Return"
  | "Return Issued"
  | "Cancelled"
  | "Closed";

export interface DeliveryNoteItem {
  id?: string;
  idx: number;
  item_code: string;
  item_name?: string;
  description?: string;
  qty: number;
  stock_qty: number;
  rate: number;
  amount: number;
  uom: string;
  stock_uom: string;
  conversion_factor: number;
  warehouse?: string;
  against_sales_order?: string;
  so_detail?: string;
  against_sales_invoice?: string;
  si_detail?: string;
  against_pick_list?: string;
  pick_list_item?: string;
  dn_detail?: string;
  billed_amt?: number;
  packed_qty?: number;
  actual_qty?: number;
  projected_qty?: number;
  installed_qty?: number;
  serial_and_batch_bundle?: string;
  use_serial_batch_fields?: boolean;
  cost_center?: string;
  discount_amount?: number;
  price_list_rate?: number;
  discount_percentage?: number;
  item_tax_amount?: number;
  expense_account?: string;
}

export interface PackedItem {
  id?: string;
  idx: number;
  item_code: string;
  item_name?: string;
  description?: string;
  qty: number;
  warehouse?: string;
  packed_qty?: number;
  actual_qty?: number;
  projected_qty?: number;
}

export interface DeliveryNoteTax {
  id?: string;
  idx: number;
  charge_type?: string;
  account_head?: string;
  description?: string;
  tax_amount?: number;
  tax_amount_after_discount_amount?: number;
  base_tax_amount_after_discount_amount?: number;
  cost_center?: string;
  category?: string;
  add_deduct_tax?: string;
}

export interface DeliveryNote {
  id?: string;
  name: string;
  docstatus: number;
  company: string;
  customer: string;
  customer_name?: string;
  customer_group?: string;
  territory?: string;
  currency: string;
  conversion_rate: number;
  selling_price_list: string;
  price_list_currency: string;
  plc_conversion_rate: number;
  posting_date: string; // ISO date
  posting_time: string; // HH:MM:SS
  set_posting_time: boolean;
  project?: string;
  cost_center?: string;
  is_return: boolean;
  is_internal_customer: boolean;
  issue_credit_note: boolean;
  return_against?: string;
  inter_company_reference?: string;
  per_billed: number;
  per_installed: number;
  per_returned: number;
  status: DeliveryNoteStatus;
  total: number;
  net_total: number;
  base_total: number;
  base_net_total: number;
  grand_total: number;
  base_grand_total: number;
  rounded_total?: number;
  base_rounded_total?: number;
  rounding_adjustment?: number;
  base_rounding_adjustment?: number;
  total_taxes_and_charges: number;
  base_total_taxes_and_charges: number;
  discount_amount?: number;
  base_discount_amount?: number;
  additional_discount_percentage?: number;
  apply_discount_on?: string;
  total_qty: number;
  total_net_weight?: number;
  commission_rate?: number;
  total_commission?: number;
  amount_eligible_for_commission?: number;
  set_warehouse?: string;
  set_target_warehouse?: string;
  shipping_address_name?: string;
  shipping_address?: string;
  customer_address?: string;
  address_display?: string;
  contact_person?: string;
  contact_display?: string;
  contact_email?: string;
  contact_mobile?: string;
  company_address?: string;
  company_address_display?: string;
  transporter_name?: string;
  lr_no?: string;
  lr_date?: string;
  vehicle_no?: string;
  driver_name?: string;
  driver?: string;
  delivery_trip?: string;
  incoterm?: string;
  named_place?: string;
  terms?: string;
  tc_name?: string;
  instructions?: string;
  letter_head?: string;
  group_same_items: boolean;
  ignore_pricing_rule: boolean;
  print_without_amount: boolean;
  disable_rounded_total: boolean;
  scan_barcode?: string;
  tax_category?: string;
  tax_id?: string;
  taxes_and_charges?: string;
  sales_partner?: string;
  amount_in_words?: string;
  base_amount_in_words?: string;
  installation_status?: string;
  // child tables
  items: DeliveryNoteItem[];
  packed_items?: PackedItem[];
  taxes?: DeliveryNoteTax[];
  // transient / lookup data injected by caller
  _action?: string;
}

export interface ValidationError {
  field?: string;
  message: string;
  title?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface StatusUpdaterConfig {
  source_dt: string;
  target_dt: string;
  join_field: string;
  target_field: string;
  target_parent_dt?: string;
  target_parent_field?: string;
  target_ref_field: string;
  source_field: string;
  percent_join_field?: string;
  status_field?: string;
  keyword?: string;
  second_source_dt?: string;
  second_source_field?: string;
  second_join_field?: string;
  overflow_type?: string;
  no_allowance?: number;
  extra_cond?: string;
  second_source_extra_cond?: string;
}

export interface BilledAmountResult {
  updated_dn: string[];
  item_billed_amt_map: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DELIVERY_NOTE_STATUS_UPDATER: StatusUpdaterConfig[] = [
  {
    source_dt: "Delivery Note Item",
    target_dt: "Sales Order Item",
    join_field: "so_detail",
    target_field: "delivered_qty",
    target_parent_dt: "Sales Order",
    target_parent_field: "per_delivered",
    target_ref_field: "qty",
    source_field: "qty",
    percent_join_field: "against_sales_order",
    status_field: "delivery_status",
    keyword: "Delivered",
    second_source_dt: "Sales Invoice Item",
    second_source_field: "qty",
    second_join_field: "so_detail",
    overflow_type: "delivery",
    second_source_extra_cond: `and exists(select name from \`tabSales Invoice\`
      where name=\`tabSales Invoice Item\`.parent and update_stock = 1)`,
  },
  {
    source_dt: "Delivery Note Item",
    target_dt: "Sales Invoice Item",
    join_field: "si_detail",
    target_field: "delivered_qty",
    target_parent_dt: "Sales Invoice",
    target_ref_field: "qty",
    source_field: "qty",
    percent_join_field: "against_sales_invoice",
    overflow_type: "delivery",
    no_allowance: 1,
  },
  {
    source_dt: "Delivery Note Item",
    target_dt: "Pick List Item",
    join_field: "pick_list_item",
    target_field: "delivered_qty",
    target_parent_dt: "Pick List",
    target_parent_field: "per_delivered",
    target_ref_field: "picked_qty",
    source_field: "stock_qty",
    percent_join_field: "against_pick_list",
    status_field: "delivery_status",
    keyword: "Delivered",
  },
];

export function getReturnStatusUpdater(): StatusUpdaterConfig[] {
  return [
    {
      source_dt: "Delivery Note Item",
      target_dt: "Sales Order Item",
      join_field: "so_detail",
      target_field: "returned_qty",
      target_parent_dt: "Sales Order",
      target_ref_field: "qty",
      source_field: "-1 * qty",
      second_source_dt: "Sales Invoice Item",
      second_source_field: "-1 * qty",
      second_join_field: "so_detail",
      extra_cond: `and exists (select name from \`tabDelivery Note\`
        where name=\`tabDelivery Note Item\`.parent and is_return=1)`,
      second_source_extra_cond: `and exists (select name from \`tabSales Invoice\`
        where name=\`tabSales Invoice Item\`.parent and is_return=1 and update_stock=1)`,
    },
    {
      source_dt: "Delivery Note Item",
      target_dt: "Delivery Note Item",
      join_field: "dn_detail",
      target_field: "returned_qty",
      target_parent_dt: "Delivery Note",
      target_parent_field: "per_returned",
      target_ref_field: "stock_qty",
      source_field: "-1 * stock_qty",
      percent_join_field: "return_against",
    },
  ];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flt(value: unknown, precision?: number): number {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  if (precision !== undefined) {
    const factor = 10 ** precision;
    return Math.round(num * factor) / factor;
  }
  return num;
}

function cint(value: unknown): number {
  return Math.trunc(Number(value) || 0);
}

export function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Validations
// ---------------------------------------------------------------------------

export function validatePostingTime(dn: DeliveryNote): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!dn.posting_time) {
    errors.push({ field: "posting_time", message: "Posting Time is required" });
  }
  return errors;
}

export function validateReferences(dn: DeliveryNote): ValidationError[] {
  const errors: ValidationError[] = [];
  errors.push(...validateSalesOrderReferences(dn));
  errors.push(...validateSalesInvoiceReferences(dn));
  return errors;
}

export function validateSalesOrderReferences(dn: DeliveryNote): ValidationError[] {
  return validateDependentItemFields(
    dn.items,
    "against_sales_order",
    "so_detail",
    "References to Sales Orders are Incomplete"
  );
}

export function validateSalesInvoiceReferences(dn: DeliveryNote): ValidationError[] {
  if (dn.is_return) return [];
  return validateDependentItemFields(
    dn.items,
    "against_sales_invoice",
    "si_detail",
    "References to Sales Invoices are Incomplete"
  );
}

function validateDependentItemFields(
  items: DeliveryNoteItem[],
  fieldA: keyof DeliveryNoteItem,
  fieldB: keyof DeliveryNoteItem,
  errorTitle: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of items) {
    const hasA = !!item[fieldA];
    const hasB = !!item[fieldB];
    if (hasA && !hasB) {
      errors.push({
        field: String(fieldB),
        message: `Row ${item.idx}: The field ${String(fieldB)} is not set`,
        title: errorTitle,
      });
    } else if (hasB && !hasA) {
      errors.push({
        field: String(fieldA),
        message: `Row ${item.idx}: The field ${String(fieldA)} is not set`,
        title: errorTitle,
      });
    }
  }
  return errors;
}

export function validateProjCust(
  dn: DeliveryNote,
  projectCustomer?: string
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (dn.project && dn.customer) {
    // In pure logic, caller injects projectCustomer or we accept it as parameter
    if (projectCustomer !== undefined && projectCustomer !== dn.customer && projectCustomer !== "") {
      errors.push({
        field: "project",
        message: `Customer ${dn.customer} does not belong to project ${dn.project}`,
      });
    }
  }
  return errors;
}

export function validateWarehouse(
  dn: DeliveryNote,
  stockItemChecker: (itemCode: string) => boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of dn.items) {
    if (!item.warehouse && stockItemChecker(item.item_code)) {
      errors.push({
        field: "warehouse",
        message: `Warehouse required for stock Item ${item.item_code}`,
      });
    }
  }
  return errors;
}

export function validateUomIsInteger(
  uomField: "uom" | "stock_uom",
  qtyField: "qty" | "stock_qty",
  items: DeliveryNoteItem[],
  uomMustBeInteger: (uom: string) => boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of items) {
    const uom = item[uomField];
    const qty = item[qtyField];
    if (uomMustBeInteger(uom) && !Number.isInteger(qty)) {
      errors.push({
        field: qtyField,
        message: `Row ${item.idx}: Quantity (${qty}) must be a whole number for UOM ${uom}`,
      });
    }
  }
  return errors;
}

export interface PrevDocValidationRule {
  refDnField: keyof DeliveryNoteItem;
  compareFields: [keyof DeliveryNote, string][];
  isChildTable?: boolean;
  allowDuplicatePrevRowId?: boolean;
}

export function validateWithPreviousDoc(
  dn: DeliveryNote,
  rules: Record<string, PrevDocValidationRule>,
  referenceDocFetcher: (doctype: string, name: string) => Record<string, unknown> | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate parent-level refs
  const parentRules: Record<string, PrevDocValidationRule> = {};
  const childRules: Record<string, PrevDocValidationRule> = {};

  for (const [doctype, rule] of Object.entries(rules)) {
    if (rule.isChildTable) {
      childRules[doctype] = rule;
    } else {
      parentRules[doctype] = rule;
    }
  }

  for (const [doctype, rule] of Object.entries(parentRules)) {
    const refField = rule.refDnField as keyof DeliveryNote;
    const refValue = dn[refField] as string | undefined;
    if (!refValue) continue;
    const refDoc = referenceDocFetcher(doctype, refValue);
    if (!refDoc) {
      errors.push({ field: String(refField), message: `${doctype} ${refValue} not found` });
      continue;
    }
    for (const [field, operator] of rule.compareFields) {
      const dnVal = dn[field as keyof DeliveryNote];
      const refVal = refDoc[field as string];
      if (operator === "=" && dnVal !== refVal) {
        errors.push({
          field: String(field),
          message: `${String(field)} does not match with ${doctype} ${refValue}`,
        });
      }
    }
  }

  for (const [doctype, rule] of Object.entries(childRules)) {
    for (const item of dn.items) {
      const refValue = item[rule.refDnField] as string | undefined;
      if (!refValue) continue;
      const refDoc = referenceDocFetcher(doctype, refValue);
      if (!refDoc) {
        errors.push({
          field: String(rule.refDnField),
          message: `Row ${item.idx}: ${doctype} ${refValue} not found`,
        });
        continue;
      }
      for (const [field, operator] of rule.compareFields) {
        const itemVal = item[field as keyof DeliveryNoteItem];
        const refVal = refDoc[field as string];
        if (operator === "=" && itemVal !== refVal) {
          errors.push({
            field: String(field),
            message: `Row ${item.idx}: ${String(field)} does not match with ${doctype} ${refValue}`,
          });
        }
      }
    }
  }

  return errors;
}

export function validateAgainstStockReservationEntries(
  dn: DeliveryNote,
  reservedWarehousesFetcher: (
    soName: string,
    soDetail: string
  ) => string[] | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (dn.is_return) return errors;

  for (const item of dn.items) {
    if (!item.against_sales_order || !item.so_detail) continue;
    const reservedWarehouses = reservedWarehousesFetcher(
      item.against_sales_order,
      item.so_detail
    );
    if (!reservedWarehouses || reservedWarehouses.length === 0) continue;

    if (!item.warehouse) {
      // Caller should set warehouse from SRE[0]
      continue;
    }

    if (!reservedWarehouses.includes(item.warehouse)) {
      const whText =
        reservedWarehouses.length === 1
          ? reservedWarehouses[0]
          : `${reservedWarehouses.slice(0, -1).join(", ")} and ${reservedWarehouses[reservedWarehouses.length - 1]}`;
      errors.push({
        field: "warehouse",
        message: `Row #${item.idx}: Stock is reserved for item ${item.item_code} in warehouse ${whText}.`,
        title: "Stock Reservation Warehouse Mismatch",
      });
    }
  }
  return errors;
}

export function validatePackedQty(
  dn: DeliveryNote,
  hasSubmittedPackingSlip: boolean,
  productBundleList: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!hasSubmittedPackingSlip) return errors;

  const allItems = [...dn.items, ...(dn.packed_items || [])];
  for (const item of allItems) {
    if (productBundleList.includes(item.item_code)) continue;
    const packedQty = flt(item.packed_qty);
    const qty = flt(item.qty);
    if (packedQty && packedQty !== qty) {
      errors.push({
        field: "packed_qty",
        message: `Row ${item.idx}: Packed Qty must be equal to Qty.`,
      });
    }
  }
  return errors;
}

export function soRequired(
  dn: DeliveryNote,
  soRequiredSetting: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!soRequiredSetting) return errors;
  for (const item of dn.items) {
    if (!item.against_sales_order) {
      errors.push({
        field: "against_sales_order",
        message: `Sales Order required for Item ${item.item_code}`,
      });
    }
  }
  return errors;
}

export function checkCreditLimit(
  dn: DeliveryNote,
  bypassCreditLimit: boolean,
  itemsLinkedToInvoice: boolean
): boolean {
  if (dn.per_billed === 100) return false;
  if (bypassCreditLimit) {
    return itemsLinkedToInvoice;
  }
  // If not bypassed, check if items are not linked to SO or SI
  for (const item of dn.items) {
    if (!item.against_sales_order && !item.against_sales_invoice) {
      return true;
    }
  }
  return false;
}

export function checkNextDocstatus(
  dn: DeliveryNote,
  submittedSalesInvoices: string[],
  submittedInstallationNotes: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (submittedSalesInvoices.length > 0) {
    errors.push({
      message: `Sales Invoice ${submittedSalesInvoices[0]} has already been submitted`,
    });
  }
  if (submittedInstallationNotes.length > 0) {
    errors.push({
      message: `Installation Note ${submittedInstallationNotes[0]} has already been submitted`,
    });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Status & Billing
// ---------------------------------------------------------------------------

export interface DnDetailBilledAmount {
  dnDetail: string;
  billedAmt: number;
}

export function updateBilledAmountBasedOnSo(
  soDetail: string,
  // injected lookup data from caller
  billedAgainstSo: number,
  dnDetails: Array<{
    name: string;
    amount: number;
    si_detail?: string;
    parent: string;
  }>,
  billedAmtAgainstDnFetcher: (dnDetail: string) => number
): { updatedDn: string[]; dnDetailBilledMap: Record<string, number> } {
  const updatedDn: string[] = [];
  const dnDetailBilledMap: Record<string, number> = {};
  let remainingBilledAgainstSo = billedAgainstSo;

  for (const dnd of dnDetails) {
    let billedAmtAgainstDn = 0;

    if (dnd.si_detail) {
      billedAmtAgainstDn = flt(dnd.amount);
      remainingBilledAgainstSo -= billedAmtAgainstDn;
    } else {
      billedAmtAgainstDn = billedAmtAgainstDnFetcher(dnd.name);
    }

    // Distribute billed amount directly against SO between DNs based on FIFO
    if (remainingBilledAgainstSo > 0 && billedAmtAgainstDn < dnd.amount) {
      const pendingToBill = flt(dnd.amount) - billedAmtAgainstDn;
      if (pendingToBill <= remainingBilledAgainstSo) {
        billedAmtAgainstDn += pendingToBill;
        remainingBilledAgainstSo -= pendingToBill;
      } else {
        billedAmtAgainstDn += remainingBilledAgainstSo;
        remainingBilledAgainstSo = 0;
      }
    }

    dnDetailBilledMap[dnd.name] = billedAmtAgainstDn;
    updatedDn.push(dnd.parent);
  }

  return { updatedDn, dnDetailBilledMap };
}

export function updateBillingPercentage(
  dn: DeliveryNote,
  itemBilledAmtMap: Record<string, number>
): { perBilled: number; status: DeliveryNoteStatus } {
  let totalAmount = 0;
  let totalBilledAmount = 0;

  for (const item of dn.items) {
    const amount = flt(item.amount);
    const billedAmt = flt(itemBilledAmtMap[item.id || item.idx.toString()] ?? item.billed_amt ?? 0);
    totalAmount += Math.abs(amount);
    totalBilledAmount += Math.abs(billedAmt);
  }

  if (dn.is_return && totalAmount === 0 && totalBilledAmount > 0) {
    totalAmount = totalBilledAmount;
  }

  const perBilled = roundToPrecision(
    100 * (totalBilledAmount / (totalAmount || 1)),
    6
  );

  let status: DeliveryNoteStatus = dn.status;
  if (perBilled >= 99.99) {
    status = "Completed";
  } else if (perBilled > 0) {
    status = "Partially Billed";
  } else {
    status = "To Bill";
  }

  return { perBilled, status };
}

export function updateBillingStatus(
  dn: DeliveryNote,
  itemBilledAmtMap: Record<string, number>
): { perBilled: number; status: DeliveryNoteStatus; updatedItems: Record<string, number> } {
  const { perBilled, status } = updateBillingPercentage(dn, itemBilledAmtMap);
  const updatedItems: Record<string, number> = {};
  for (const item of dn.items) {
    if (item.si_detail && !item.so_detail) {
      updatedItems[item.id || item.idx.toString()] = flt(item.amount);
    }
  }
  return { perBilled, status, updatedItems };
}

// ---------------------------------------------------------------------------
// Packing / Unpacked
// ---------------------------------------------------------------------------

export function hasUnpackedItems(
  dn: DeliveryNote,
  productBundleList: string[]
): boolean {
  const allItems = [...dn.items, ...(dn.packed_items || [])];
  for (const item of allItems) {
    if (productBundleList.includes(item.item_code)) continue;
    if (flt(item.packed_qty) < flt(item.qty)) {
      return true;
    }
  }
  return false;
}

export function getPendingPackingQty(item: DeliveryNoteItem | PackedItem): number {
  return flt(item.qty) - flt(item.packed_qty);
}

// ---------------------------------------------------------------------------
// Qty Maps (pure computation from injected data)
// ---------------------------------------------------------------------------

export function getInvoicedQtyMap(
  salesInvoiceItems: Array<{ dn_detail: string; qty: number }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of salesInvoiceItems) {
    if (!map[row.dn_detail]) map[row.dn_detail] = 0;
    map[row.dn_detail] += flt(row.qty);
  }
  return map;
}

export function getReturnedQtyMap(
  returnItems: Array<{ dn_detail: string; qty: number }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of returnItems) {
    if (!map[row.dn_detail]) map[row.dn_detail] = 0;
    map[row.dn_detail] += Math.abs(flt(row.qty));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Make Sales Invoice logic (pure qty / filter computation)
// ---------------------------------------------------------------------------

export interface PendingQtyResult {
  pendingQty: number;
  returnedQty: number;
}

export function getPendingInvoiceQty(
  itemRow: DeliveryNoteItem,
  invoicedQtyMap: Record<string, number>,
  returnedQtyMap: Record<string, number>,
  isReturn: boolean
): PendingQtyResult {
  let pendingQty = flt(itemRow.qty) - (invoicedQtyMap[itemRow.id || itemRow.idx.toString()] || 0);
  let returnedQty = returnedQtyMap[itemRow.id || itemRow.idx.toString()] || 0;

  if (returnedQty > 0) {
    if (returnedQty >= pendingQty) {
      returnedQty -= pendingQty;
      pendingQty = 0;
    } else {
      pendingQty -= returnedQty;
      returnedQty = 0;
    }
  }

  return { pendingQty: Math.max(0, pendingQty), returnedQty: Math.max(0, returnedQty) };
}

export function filterItemsForInvoice(
  items: DeliveryNoteItem[],
  invoicedQtyMap: Record<string, number>,
  returnedQtyMap: Record<string, number>,
  isReturn: boolean,
  filteredChildren?: string[]
): Array<DeliveryNoteItem & { _pendingQty: number }> {
  const result: Array<DeliveryNoteItem & { _pendingQty: number }> = [];

  for (const item of items) {
    const childFilter =
      filteredChildren && filteredChildren.length > 0
        ? filteredChildren.includes(item.id || item.idx.toString())
        : true;
    if (!childFilter) continue;

    const { pendingQty } = getPendingInvoiceQty(
      item,
      invoicedQtyMap,
      returnedQtyMap,
      isReturn
    );

    const include = isReturn ? pendingQty > 0 : pendingQty <= 0;
    if (!include) {
      result.push({ ...item, _pendingQty: pendingQty });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Make Packing Slip logic
// ---------------------------------------------------------------------------

export function getItemsForPackingSlip(
  dn: DeliveryNote,
  productBundleList: string[]
): Array<DeliveryNoteItem | PackedItem> {
  const result: Array<DeliveryNoteItem | PackedItem> = [];

  for (const item of dn.items) {
    if (
      !productBundleList.includes(item.item_code) &&
      flt(item.packed_qty) < flt(item.qty)
    ) {
      result.push(item);
    }
  }

  for (const item of dn.packed_items || []) {
    if (flt(item.packed_qty) < flt(item.qty)) {
      result.push(item);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Make Installation Note logic
// ---------------------------------------------------------------------------

export function getItemsForInstallationNote(
  dn: DeliveryNote
): Array<DeliveryNoteItem & { pending_install_qty: number }> {
  return dn.items
    .filter((item) => flt(item.installed_qty) < flt(item.qty))
    .map((item) => ({
      ...item,
      pending_install_qty: flt(item.qty) - flt(item.installed_qty),
    }));
}

// ---------------------------------------------------------------------------
// Make Shipment logic
// ---------------------------------------------------------------------------

export interface ShipmentContactInfo {
  email?: string;
  full_name?: string;
  phone?: string;
  mobile_no?: string;
}

export interface ShipmentAddressInfo {
  address_name?: string;
  address_display?: string;
}

export function buildPickupContactDisplay(user: ShipmentContactInfo): string {
  let display = user.full_name || "";
  if (user.email) display += (display ? "<br>" : "") + user.email;
  if (user.phone) display += (display ? "<br>" : "") + user.phone;
  else if (user.mobile_no) display += (display ? "<br>" : "") + user.mobile_no;
  return display;
}

export function buildDeliveryContactDisplay(
  contactDisplay?: string,
  contactPerson?: string,
  contact?: ShipmentContactInfo
): string {
  let display = contactDisplay || contactPerson || "";
  if (contact && !contactDisplay) {
    if (contact.email) display += (display ? "<br>" : "") + contact.email;
    if (contact.phone) display += (display ? "<br>" : "") + contact.phone;
    else if (contact.mobile_no) display += (display ? "<br>" : "") + contact.mobile_no;
  }
  return display;
}

export function resolveShipmentDeliveryAddress(
  dn: DeliveryNote
): ShipmentAddressInfo {
  if (dn.shipping_address_name) {
    return {
      address_name: dn.shipping_address_name,
      address_display: dn.shipping_address,
    };
  }
  if (dn.customer_address) {
    return {
      address_name: dn.customer_address,
      address_display: dn.address_display,
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Make Sales Return logic
// ---------------------------------------------------------------------------

export function computeReturnItems(
  dn: DeliveryNote,
  returnedQtyMap: Record<string, number>
): Array<DeliveryNoteItem & { return_qty: number }> {
  return dn.items.map((item) => {
    const alreadyReturned = returnedQtyMap[item.id || item.idx.toString()] || 0;
    const returnQty = flt(item.qty) - alreadyReturned;
    return { ...item, return_qty: Math.max(0, returnQty) };
  });
}

// ---------------------------------------------------------------------------
// Inter-company transaction helpers
// ---------------------------------------------------------------------------

export interface InterCompanyDetails {
  company: string;
  party: string;
}

export function mapDeliveryNoteToPurchaseReceiptFields(
  dn: DeliveryNote,
  details: InterCompanyDetails
): Record<string, unknown> {
  return {
    company: details.company,
    supplier: details.party,
    buying_price_list: dn.selling_price_list,
    is_internal_supplier: true,
    inter_company_reference: dn.name,
  };
}

export function mapPurchaseReceiptToDeliveryNoteFields(
  pr: Record<string, unknown>,
  details: InterCompanyDetails
): Record<string, unknown> {
  return {
    company: details.company,
    customer: details.party,
    selling_price_list: pr.buying_price_list,
    is_internal_customer: true,
    inter_company_reference: pr.name,
  };
}

// ---------------------------------------------------------------------------
// Orchestration: run all validations
// ---------------------------------------------------------------------------

export interface DeliveryNoteValidationInput {
  dn: DeliveryNote;
  soRequiredSetting: boolean;
  projectCustomer?: string;
  stockItemChecker: (itemCode: string) => boolean;
  uomMustBeInteger: (uom: string) => boolean;
  referenceDocFetcher: (doctype: string, name: string) => Record<string, unknown> | undefined;
  reservedWarehousesFetcher: (soName: string, soDetail: string) => string[] | undefined;
  hasSubmittedPackingSlip: boolean;
  productBundleList: string[];
  bypassCreditLimit: boolean;
  itemsLinkedToInvoice: boolean;
  submittedSalesInvoices: string[];
  submittedInstallationNotes: string[];
}

export function validateDeliveryNote(input: DeliveryNoteValidationInput): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };

  const { dn } = input;

  result.errors.push(...validatePostingTime(dn));
  result.errors.push(...validateReferences(dn));
  result.errors.push(...soRequired(dn, input.soRequiredSetting));
  result.errors.push(...validateProjCust(dn, input.projectCustomer));
  result.errors.push(...validateWarehouse(dn, input.stockItemChecker));
  result.errors.push(
    ...validateUomIsInteger("stock_uom", "stock_qty", dn.items, input.uomMustBeInteger)
  );
  result.errors.push(...validateUomIsInteger("uom", "qty", dn.items, input.uomMustBeInteger));
  result.errors.push(
    ...validateAgainstStockReservationEntries(dn, input.reservedWarehousesFetcher)
  );

  if (dn._action === "submit") {
    result.errors.push(
      ...validatePackedQty(dn, input.hasSubmittedPackingSlip, input.productBundleList)
    );
    result.errors.push(
      ...checkNextDocstatus(
        dn,
        input.submittedSalesInvoices,
        input.submittedInstallationNotes
      )
    );
  }

  if (!dn.installation_status) {
    result.warnings.push({
      field: "installation_status",
      message: "Installation status defaulted to Not Installed",
    });
  }

  result.valid = result.errors.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Status determination
// ---------------------------------------------------------------------------

export function determineDeliveryNoteStatus(
  dn: DeliveryNote,
  perBilled: number
): DeliveryNoteStatus {
  if (dn.docstatus === 0) return "Draft";
  if (dn.docstatus === 2) return "Cancelled";
  if (dn.is_return) return dn.issue_credit_note ? "Return Issued" : "Return";
  if (perBilled >= 99.99) return "Completed";
  if (perBilled > 0) return "Partially Billed";
  return "To Bill";
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export function calculateTotals(dn: DeliveryNote): {
  totalQty: number;
  totalNetWeight?: number;
} {
  let totalQty = 0;
  let totalNetWeight = 0;
  for (const item of dn.items) {
    totalQty += flt(item.qty);
    // net_weight not in our trimmed interface; caller can extend
  }
  return { totalQty, totalNetWeight };
}
