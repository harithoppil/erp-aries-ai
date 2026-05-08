// =============================================================================
// stock-purchase-receipt.ts
// Ported from ERPNext: stock/doctype/purchase_receipt/purchase_receipt.py
// Pure business logic — NO database / Prisma / Frappe calls.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseReceiptStatus =
  | ""
  | "Draft"
  | "Partly Billed"
  | "To Bill"
  | "Completed"
  | "Return"
  | "Return Issued"
  | "Cancelled"
  | "Closed";

export interface PurchaseReceiptItem {
  id?: string;
  idx: number;
  item_code: string;
  item_name?: string;
  description?: string;
  qty: number;
  received_qty: number;
  stock_qty: number;
  received_stock_qty: number;
  rate: number;
  amount: number;
  base_amount?: number;
  base_net_amount?: number;
  net_amount?: number;
  net_rate?: number;
  uom: string;
  stock_uom: string;
  conversion_factor: number;
  warehouse?: string;
  rejected_warehouse?: string;
  from_warehouse?: string;
  purchase_order?: string;
  purchase_order_item?: string;
  purchase_invoice?: string;
  purchase_invoice_item?: string;
  material_request?: string;
  material_request_item?: string;
  delivery_note_item?: string;
  billed_amt?: number;
  valuation_rate?: number;
  serial_and_batch_bundle?: string;
  use_serial_batch_fields?: boolean;
  batch_no?: string;
  serial_no?: string;
  cost_center?: string;
  is_fixed_asset: boolean;
  asset_category?: string;
  asset_location?: string;
  wip_composite_asset?: string;
  expense_account?: string;
  provisional_expense_account?: string;
  landed_cost_voucher_amount?: number;
  rm_supp_cost?: number;
  item_tax_amount?: number;
  amount_difference_with_purchase_invoice?: number;
  quality_inspection?: string;
  production_plan_sub_assembly_item?: string;
  fg_item_qty?: number;
  rejected_qty?: number;
  return_qty_from_rejected_warehouse?: boolean;
  pr_detail?: string;
  sales_order?: string;
  sales_order_item?: string;
}

export interface PurchaseReceiptSuppliedItem {
  id?: string;
  idx: number;
  item_code: string;
  qty: number;
  rate?: number;
  amount?: number;
  warehouse?: string;
}

export interface PurchaseReceiptTax {
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

export interface PurchaseReceipt {
  id?: string;
  name: string;
  docstatus: number;
  company: string;
  supplier: string;
  supplier_name?: string;
  currency: string;
  conversion_rate: number;
  buying_price_list?: string;
  price_list_currency?: string;
  plc_conversion_rate: number;
  posting_date: string; // ISO date
  posting_time: string; // HH:MM:SS
  set_posting_time: boolean;
  project?: string;
  cost_center?: string;
  is_return: boolean;
  is_internal_supplier: boolean;
  return_against?: string;
  inter_company_reference?: string;
  per_billed: number;
  per_returned: number;
  status: PurchaseReceiptStatus;
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
  taxes_and_charges_added?: number;
  taxes_and_charges_deducted?: number;
  base_taxes_and_charges_added?: number;
  base_taxes_and_charges_deducted?: number;
  discount_amount?: number;
  base_discount_amount?: number;
  additional_discount_percentage?: number;
  apply_discount_on?: string;
  total_qty: number;
  total_net_weight?: number;
  set_warehouse?: string;
  set_from_warehouse?: string;
  rejected_warehouse?: string;
  shipping_address?: string;
  shipping_address_display?: string;
  supplier_address?: string;
  address_display?: string;
  billing_address?: string;
  billing_address_display?: string;
  dispatch_address?: string;
  dispatch_address_display?: string;
  contact_person?: string;
  contact_display?: string;
  contact_email?: string;
  contact_mobile?: string;
  transporter_name?: string;
  lr_no?: string;
  lr_date?: string;
  incoterm?: string;
  named_place?: string;
  terms?: string;
  tc_name?: string;
  instructions?: string;
  letter_head?: string;
  group_same_items: boolean;
  ignore_pricing_rule: boolean;
  disable_rounded_total: boolean;
  scan_barcode?: string;
  tax_category?: string;
  tax_id?: string;
  taxes_and_charges?: string;
  is_subcontracted: boolean;
  supplier_warehouse?: string;
  supplier_delivery_note?: string;
  apply_putaway_rule: boolean;
  subcontracting_receipt?: string;
  remarks?: string;
  // child tables
  items: PurchaseReceiptItem[];
  supplied_items?: PurchaseReceiptSuppliedItem[];
  taxes?: PurchaseReceiptTax[];
  // transient
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
  validate_qty?: boolean;
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

function getdate(dateStr: string): Date {
  return new Date(dateStr);
}

function nowdate(): string {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Status Updater Configs
// ---------------------------------------------------------------------------

export const PURCHASE_RECEIPT_STATUS_UPDATER: StatusUpdaterConfig[] = [
  {
    target_dt: "Purchase Order Item",
    join_field: "purchase_order_item",
    target_field: "received_qty",
    target_parent_dt: "Purchase Order",
    target_parent_field: "per_received",
    target_ref_field: "qty",
    source_dt: "Purchase Receipt Item",
    source_field: "received_qty",
    second_source_dt: "Purchase Invoice Item",
    second_source_field: "received_qty",
    second_join_field: "po_detail",
    percent_join_field: "purchase_order",
    overflow_type: "receipt",
    second_source_extra_cond: `and exists(select name from \`tabPurchase Invoice\`
      where name=\`tabPurchase Invoice Item\`.parent and update_stock = 1)`,
  },
  {
    source_dt: "Purchase Receipt Item",
    target_dt: "Material Request Item",
    join_field: "material_request_item",
    target_field: "received_qty",
    target_parent_dt: "Material Request",
    target_parent_field: "per_received",
    target_ref_field: "stock_qty",
    source_field: "stock_qty",
    percent_join_field: "material_request",
    validate_qty: false,
  },
  {
    source_dt: "Purchase Receipt Item",
    target_dt: "Purchase Invoice Item",
    join_field: "purchase_invoice_item",
    target_field: "received_qty",
    target_parent_dt: "Purchase Invoice",
    target_parent_field: "per_received",
    target_ref_field: "qty",
    source_field: "received_qty",
    percent_join_field: "purchase_invoice",
    overflow_type: "receipt",
  },
  {
    source_dt: "Purchase Receipt Item",
    target_dt: "Delivery Note Item",
    join_field: "delivery_note_item",
    source_field: "received_qty",
    target_field: "received_qty",
    target_parent_dt: "Delivery Note",
    target_ref_field: "qty",
    overflow_type: "receipt",
  },
];

export function getReturnStatusUpdater(): StatusUpdaterConfig[] {
  return [
    {
      source_dt: "Purchase Receipt Item",
      target_dt: "Purchase Order Item",
      join_field: "purchase_order_item",
      target_field: "returned_qty",
      target_ref_field: "qty",
      source_field: "-1 * qty",
      second_source_dt: "Purchase Invoice Item",
      second_source_field: "-1 * qty",
      second_join_field: "po_detail",
      extra_cond: `and exists (select name from \`tabPurchase Receipt\`
        where name=\`tabPurchase Receipt Item\`.parent and is_return=1)`,
      second_source_extra_cond: `and exists (select name from \`tabPurchase Invoice\`
        where name=\`tabPurchase Invoice Item\`.parent and is_return=1 and update_stock=1)`,
    },
    {
      source_dt: "Purchase Receipt Item",
      target_dt: "Purchase Receipt Item",
      join_field: "purchase_receipt_item",
      target_field: "returned_qty",
      target_parent_dt: "Purchase Receipt",
      target_parent_field: "per_returned",
      target_ref_field: "received_stock_qty",
      source_field: "-1 * received_stock_qty",
      percent_join_field: "return_against",
    },
  ];
}

// ---------------------------------------------------------------------------
// Validations
// ---------------------------------------------------------------------------

export function validatePostingTime(pr: PurchaseReceipt): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!pr.posting_time) {
    errors.push({ field: "posting_time", message: "Posting Time is required" });
  }
  return errors;
}

export function validatePostingDateWithPo(
  pr: PurchaseReceipt,
  poPostingDates: Record<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of pr.items) {
    if (item.purchase_order && poPostingDates[item.purchase_order]) {
      const poDate = getdate(poPostingDates[item.purchase_order]);
      const prDate = getdate(pr.posting_date);
      if (prDate < poDate) {
        errors.push({
          field: "posting_date",
          message: `Row ${item.idx}: Posting Date cannot be before Purchase Order ${item.purchase_order} posting date`,
        });
      }
    }
  }
  return errors;
}

export function poRequired(
  pr: PurchaseReceipt,
  poRequiredSetting: boolean,
  isInternalTransfer: boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!poRequiredSetting || isInternalTransfer) return errors;
  for (const item of pr.items) {
    if (!item.purchase_order) {
      errors.push({
        field: "purchase_order",
        message: `Purchase Order number required for Item ${item.item_code}`,
      });
    }
  }
  return errors;
}

export function validateItemsQualityInspection(
  pr: PurchaseReceipt,
  qiFetcher: (qiName: string) => {
    reference_type?: string;
    reference_name?: string;
    item_code?: string;
  } | null
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of pr.items) {
    if (!item.quality_inspection) continue;
    const qi = qiFetcher(item.quality_inspection);
    if (!qi) {
      errors.push({
        field: "quality_inspection",
        message: `Row ${item.idx}: Quality Inspection ${item.quality_inspection} not found`,
      });
      continue;
    }
    if (qi.reference_type !== "Purchase Receipt" || qi.reference_name !== pr.name) {
      errors.push({
        field: "quality_inspection",
        message: `Row ${item.idx}: Please select a valid Quality Inspection with Reference Type Purchase Receipt and Reference Name ${pr.name}.`,
      });
    }
    if (qi.item_code !== item.item_code) {
      errors.push({
        field: "quality_inspection",
        message: `Row ${item.idx}: Please select a valid Quality Inspection with Item Code ${item.item_code}.`,
      });
    }
  }
  return errors;
}

export interface PrevDocValidationRule {
  refDnField: keyof PurchaseReceiptItem;
  compareFields: [keyof PurchaseReceipt, string][];
  isChildTable?: boolean;
  allowDuplicatePrevRowId?: boolean;
}

export function validateWithPreviousDoc(
  pr: PurchaseReceipt,
  rules: Record<string, PrevDocValidationRule>,
  referenceDocFetcher: (doctype: string, name: string) => Record<string, unknown> | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];
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
    const refField = rule.refDnField as unknown as keyof PurchaseReceipt;
    const refValue = pr[refField] as string | undefined;
    if (!refValue) continue;
    const refDoc = referenceDocFetcher(doctype, refValue);
    if (!refDoc) {
      errors.push({ field: String(refField), message: `${doctype} ${refValue} not found` });
      continue;
    }
    for (const [field, operator] of rule.compareFields) {
      const prVal = pr[field as keyof PurchaseReceipt];
      const refVal = refDoc[field as string];
      if (operator === "=" && prVal !== refVal) {
        errors.push({
          field: String(field),
          message: `${String(field)} does not match with ${doctype} ${refValue}`,
        });
      }
    }
  }

  for (const [doctype, rule] of Object.entries(childRules)) {
    for (const item of pr.items) {
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
        const itemVal = item[field as keyof PurchaseReceiptItem];
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

export function validateUomIsInteger(
  uomField: "uom" | "stock_uom",
  qtyFields: ("qty" | "received_qty" | "stock_qty")[],
  items: PurchaseReceiptItem[],
  uomMustBeInteger: (uom: string) => boolean
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of items) {
    const uom = item[uomField];
    for (const qtyField of qtyFields) {
      const qty = item[qtyField];
      if (uomMustBeInteger(uom) && !Number.isInteger(qty)) {
        errors.push({
          field: qtyField,
          message: `Row ${item.idx}: Quantity (${qty}) must be a whole number for UOM ${uom}`,
        });
      }
    }
  }
  return errors;
}

export function validateCwipAccounts(
  pr: PurchaseReceipt,
  isCwipEnabled: (assetCategory: string) => boolean,
  companyDefaultFetcher: (key: string) => string | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const item of pr.items) {
    if (item.is_fixed_asset && item.asset_category && isCwipEnabled(item.asset_category)) {
      const arbnb = companyDefaultFetcher("asset_received_but_not_billed");
      if (!arbnb) {
        errors.push({
          field: "asset_received_but_not_billed",
          message: "Asset Received But Not Billed account not found",
        });
      }
      break;
    }
  }
  return errors;
}

export function validateProvisionalExpenseAccount(
  pr: PurchaseReceipt,
  provisionalAccountingEnabled: boolean,
  defaultProvisionalAccount: string | undefined
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!provisionalAccountingEnabled) return errors;
  if (!defaultProvisionalAccount) {
    errors.push({
      field: "default_provisional_account",
      message: "Default Provisional Account is required",
    });
  }
  return errors;
}

export function validateFuturePostingDate(pr: PurchaseReceipt): ValidationError[] {
  const errors: ValidationError[] = [];
  if (getdate(pr.posting_date) > getdate(nowdate())) {
    errors.push({ field: "posting_date", message: "Posting Date cannot be future date" });
  }
  return errors;
}

export function checkOnHoldOrClosedStatus(
  pr: PurchaseReceipt,
  poStatuses: Record<string, "Draft" | "To Receive" | "Partially Received" | "Completed" | "Closed" | "Cancelled" | "On Hold">
): ValidationError[] {
  const errors: ValidationError[] = [];
  const checked = new Set<string>();
  for (const item of pr.items) {
    if (item.purchase_order && !checked.has(item.purchase_order)) {
      checked.add(item.purchase_order);
      const status = poStatuses[item.purchase_order];
      if (status === "Closed" || status === "On Hold" || status === "Cancelled") {
        errors.push({
          field: "purchase_order",
          message: `Purchase Order ${item.purchase_order} is ${status}`,
        });
      }
    }
  }
  return errors;
}

export function checkNextDocstatus(
  pr: PurchaseReceipt,
  submittedPurchaseInvoices: string[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (submittedPurchaseInvoices.length > 0) {
    errors.push({
      message: `Purchase Invoice ${submittedPurchaseInvoices[0]} is already submitted`,
    });
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Billing Status
// ---------------------------------------------------------------------------

export interface PoBilledDetails {
  billed_amt: number;
  billed_qty: number;
}

export interface PrDetailRow {
  name: string;
  qty: number;
  parent: string;
  amount: number;
  billed_amt?: number;
  purchase_order_item: string;
}

export function updateBilledAmountBasedOnPo(
  poDetails: string[],
  prDetails: PrDetailRow[],
  poBilledAmtDetails: Record<string, PoBilledDetails>,
  prItemsBilledAmount: Record<string, number>
): { updatedPr: string[]; prItemBilledMap: Record<string, number> } {
  const updatedPr: string[] = [];
  const prItemBilledMap: Record<string, number> = {};

  for (const prItem of prDetails) {
    let billedAmtAgainstPo = 0;
    let billedQtyAgainstPo = 0;
    const billedDetails = poBilledAmtDetails[prItem.purchase_order_item];
    if (billedDetails) {
      billedAmtAgainstPo = flt(billedDetails.billed_amt);
      billedQtyAgainstPo = flt(billedDetails.billed_qty);
    }

    let billedAmtAgainstPr = flt(prItemsBilledAmount[prItem.name] || 0);

    // Distribute billed amount directly against PO between PRs based on FIFO
    if (billedAmtAgainstPo > 0 && billedAmtAgainstPr < prItem.amount) {
      if (!billedAmtAgainstPr && billedQtyAgainstPo && billedQtyAgainstPo > prItem.qty) {
        billedAmtAgainstPr = flt(flt(billedAmtAgainstPo) * flt(prItem.qty)) / flt(billedQtyAgainstPo);
      } else {
        const pendingToBill = flt(prItem.amount) - billedAmtAgainstPr;
        if (pendingToBill <= billedAmtAgainstPo) {
          billedAmtAgainstPr += pendingToBill;
          billedAmtAgainstPo -= pendingToBill;
        } else {
          billedAmtAgainstPr += billedAmtAgainstPo;
          billedAmtAgainstPo = 0;
        }
        if (poBilledAmtDetails[prItem.purchase_order_item]) {
          poBilledAmtDetails[prItem.purchase_order_item].billed_amt = billedAmtAgainstPo;
        }
      }
    }

    prItemBilledMap[prItem.name] = billedAmtAgainstPr;
    updatedPr.push(prItem.parent);
  }

  return { updatedPr, prItemBilledMap };
}

export interface BilledQtyAmt {
  amount: number;
  qty: number;
}

export function updateBillingPercentage(
  pr: PurchaseReceipt,
  itemBilledAmtMap: Record<string, number>,
  itemWiseReturnedQty: Record<string, number>,
  overBillingAllowance: number,
  billForRejectedQty: boolean,
  adjustIncomingRate: boolean,
  billedQtyAmt: Record<string, BilledQtyAmt>,
  billedQtyAmtBasedOnPo: Record<string, BilledQtyAmt>,
  userRoles: string[],
  roleAllowedToOverBill?: string
): {
  perBilled: number;
  status: PurchaseReceiptStatus;
  piLandedCostAmount: number;
  itemAdjustments: Record<string, number>;
  overBillingErrors: ValidationError[];
} {
  let totalAmount = 0;
  let totalBilledAmount = 0;
  let piLandedCostAmount = 0;
  const itemAdjustments: Record<string, number> = {};
  const overBillingErrors: ValidationError[] = [];

  for (const item of pr.items) {
    const returnedQty = flt(itemWiseReturnedQty[item.id || item.idx.toString()] || 0);
    const returnedAmount = flt(returnedQty) * flt(item.rate);
    let pendingAmount = flt(item.amount) - returnedAmount;
    if (billForRejectedQty) {
      pendingAmount = flt(item.amount);
    }

    let totalBillableAmount = Math.abs(flt(item.amount));
    if (pendingAmount > 0) {
      const billedAmt = flt(itemBilledAmtMap[item.id || item.idx.toString()] ?? item.billed_amt ?? 0);
      totalBillableAmount = billedAmt <= pendingAmount ? pendingAmount : billedAmt;
    }

    totalAmount += totalBillableAmount;
    totalBilledAmount += Math.abs(flt(itemBilledAmtMap[item.id || item.idx.toString()] ?? item.billed_amt ?? 0));

    if (pr.is_return && totalAmount === 0 && totalBilledAmount > 0) {
      totalAmount = totalBilledAmount;
    }

    let amount = item.amount;
    if (billForRejectedQty && item.rejected_qty) {
      amount += flt(item.rejected_qty * item.rate);
    }

    if (adjustIncomingRate) {
      let adjustedAmt = 0.0;
      const itemBilled = billedQtyAmt[item.id || item.idx.toString()];
      const poBilled = billedQtyAmtBasedOnPo[item.purchase_order_item || ""];

      if (
        item.billed_amt !== undefined &&
        item.amount !== undefined &&
        (itemBilled || poBilled)
      ) {
        let qty: number | null = null;
        if (itemBilled) {
          qty = itemBilled.qty;
        }
        if (qty === null && poBilled) {
          if (item.qty < poBilled.qty) {
            qty = item.qty;
          } else {
            qty = poBilled.qty;
          }
          billedQtyAmtBasedOnPo[item.purchase_order_item || ""].qty -= qty || 0;
        }

        let billedAmt = item.billed_amt || 0;
        if (itemBilled) {
          billedAmt = flt(itemBilled.amount);
        } else if (poBilled) {
          const totalBilledQty = (poBilled.qty || 0) + (qty || 0);
          if (totalBilledQty) {
            billedAmt = flt(flt(poBilled.amount) * ((qty || 0) / totalBilledQty));
          } else {
            billedAmt = 0;
          }
          billedQtyAmtBasedOnPo[item.purchase_order_item || ""].amount -= billedAmt;
        }

        if (qty) {
          adjustedAmt = (flt(billedAmt / qty) - flt(item.rate) * flt(pr.conversion_rate)) * item.qty;
        }
      }

      adjustedAmt = flt(adjustedAmt);
      piLandedCostAmount += adjustedAmt;
      itemAdjustments[item.id || item.idx.toString()] = adjustedAmt;
    } else if (amount && item.billed_amt && item.billed_amt > amount) {
      const perOverBilled = flt(flt(item.billed_amt / amount) * 100) - 100;
      if (
        perOverBilled > overBillingAllowance &&
        roleAllowedToOverBill &&
        !userRoles.includes(roleAllowedToOverBill)
      ) {
        overBillingErrors.push({
          field: "billed_amt",
          message: `Over Billing Allowance exceeded for Purchase Receipt Item ${item.item_code} by ${roundToPrecision(perOverBilled - overBillingAllowance, 2)}%`,
        });
      }
    }
  }

  if (piLandedCostAmount < 0) {
    totalBilledAmount += Math.abs(piLandedCostAmount);
  }

  const perBilled = roundToPrecision(100 * (totalBilledAmount / (totalAmount || 1)), 6);

  let status: PurchaseReceiptStatus = pr.status;
  if (perBilled >= 99.99) {
    status = "Completed";
  } else if (perBilled > 0) {
    status = "Partly Billed";
  } else {
    status = "To Bill";
  }

  return { perBilled, status, piLandedCostAmount, itemAdjustments, overBillingErrors };
}

export function updateBillingStatus(
  pr: PurchaseReceipt,
  itemBilledAmtMap: Record<string, number>
): { perBilled: number; status: PurchaseReceiptStatus; updatedItems: Record<string, number> } {
  const { perBilled, status } = updateBillingPercentage(
    pr,
    itemBilledAmtMap,
    {},
    0,
    false,
    false,
    {},
    {},
    [],
    undefined
  );
  const updatedItems: Record<string, number> = {};
  for (const item of pr.items) {
    if (item.purchase_invoice && item.purchase_invoice_item) {
      updatedItems[item.id || item.idx.toString()] = flt(item.amount);
    }
  }
  return { perBilled, status, updatedItems };
}

// ---------------------------------------------------------------------------
// Qty Maps
// ---------------------------------------------------------------------------

export function getInvoicedQtyMap(
  purchaseInvoiceItems: Array<{ pr_detail: string; qty: number }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of purchaseInvoiceItems) {
    if (!map[row.pr_detail]) map[row.pr_detail] = 0;
    map[row.pr_detail] += flt(row.qty);
  }
  return map;
}

export function getReturnedQtyMap(
  returnItems: Array<{ purchase_receipt_item: string; qty: number }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const row of returnItems) {
    if (!map[row.purchase_receipt_item]) map[row.purchase_receipt_item] = 0;
    map[row.purchase_receipt_item] += Math.abs(flt(row.qty));
  }
  return map;
}

export function getItemWiseReturnedQty(
  returnItems: Array<{ purchase_receipt_item: string; qty: number }>
): Record<string, number> {
  return getReturnedQtyMap(returnItems);
}

// ---------------------------------------------------------------------------
// Purchase Invoice creation logic (pure filter/qty computation)
// ---------------------------------------------------------------------------

export interface PendingPrQtyResult {
  pendingQty: number;
  returnedQty: number;
}

export function getPendingInvoiceQty(
  itemRow: PurchaseReceiptItem,
  invoicedQtyMap: Record<string, number>,
  returnedQtyMap: Record<string, number>,
  billForRejectedQty: boolean
): PendingPrQtyResult {
  let qty = itemRow.qty;
  if (billForRejectedQty) {
    qty = itemRow.received_qty;
  }

  let pendingQty = qty - (invoicedQtyMap[itemRow.id || itemRow.idx.toString()] || 0);

  if (billForRejectedQty) {
    return { pendingQty: Math.max(0, pendingQty), returnedQty: 0 };
  }

  let returnedQty = flt(returnedQtyMap[itemRow.id || itemRow.idx.toString()] || 0);
  if (itemRow.rejected_qty && returnedQty) {
    returnedQty -= itemRow.rejected_qty;
  }

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

export function filterItemsForPurchaseInvoice(
  items: PurchaseReceiptItem[],
  invoicedQtyMap: Record<string, number>,
  returnedQtyMap: Record<string, number>,
  isReturn: boolean,
  billForRejectedQty: boolean,
  filteredChildren?: string[]
): Array<PurchaseReceiptItem & { _pendingQty: number }> {
  const result: Array<PurchaseReceiptItem & { _pendingQty: number }> = [];

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
      billForRejectedQty
    );

    const include = isReturn ? pendingQty > 0 : pendingQty <= 0;
    if (!include) {
      result.push({ ...item, _pendingQty: pendingQty });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Stock Entry (Material Transfer) creation logic
// ---------------------------------------------------------------------------

export function buildStockEntryItemsFromPr(
  items: PurchaseReceiptItem[],
  bundleSerialNos: (bundleId: string) => string[] | undefined,
  bundleBatches: (bundleId: string) => string[] | undefined
): Array<
  PurchaseReceiptItem & {
    s_warehouse?: string;
    reference_purchase_receipt?: string;
    serial_no?: string;
    batch_no?: string;
    use_serial_batch_fields?: boolean;
    serial_and_batch_bundle?: string;
  }
> {
  return items.map((item) => {
    const result: ReturnType<typeof buildStockEntryItemsFromPr>[number] = {
      ...item,
      s_warehouse: item.warehouse,
      reference_purchase_receipt: item.id,
    };

    if (item.serial_and_batch_bundle) {
      const serialNos = bundleSerialNos(item.serial_and_batch_bundle);
      const batches = bundleBatches(item.serial_and_batch_bundle);

      if (serialNos && serialNos.length > 0) {
        result.serial_no = serialNos.join("\n");
        result.use_serial_batch_fields = true;
      }

      if (batches && batches.length === 1) {
        result.use_serial_batch_fields = true;
        result.batch_no = batches[0];
      }
    }

    return result;
  });
}

// ---------------------------------------------------------------------------
// Inter-company transaction helpers
// ---------------------------------------------------------------------------

export interface InterCompanyDetails {
  company: string;
  party: string;
}

export function mapPurchaseReceiptToDeliveryNoteFields(
  pr: PurchaseReceipt,
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

export function mapDeliveryNoteToPurchaseReceiptFields(
  dn: Record<string, unknown>,
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

// ---------------------------------------------------------------------------
// Landed Cost Voucher helper
// ---------------------------------------------------------------------------

export interface LandedCostVoucherReceipt {
  receipt_document_type: string;
  receipt_document: string;
  grand_total: number;
  supplier: string;
}

export function buildLandedCostVoucherReceipt(
  doctype: string,
  docname: string,
  supplier: string,
  baseGrandTotal: number
): LandedCostVoucherReceipt {
  return {
    receipt_document_type: doctype,
    receipt_document: docname,
    grand_total: baseGrandTotal,
    supplier,
  };
}

// ---------------------------------------------------------------------------
// GL Entry helpers (pure calculation)
// ---------------------------------------------------------------------------

export interface GlEntryInput {
  account: string;
  cost_center?: string;
  debit: number;
  credit: number;
  remarks?: string;
  against_account?: string;
  account_currency?: string;
  project?: string;
  voucher_detail_no?: string;
  posting_date?: string;
}

export function calculateOutgoingAmount(
  item: PurchaseReceiptItem,
  accountCurrency: string,
  companyCurrency: string,
  isReturn: boolean,
  billForRejectedQty: boolean,
  isInternalTransfer: boolean,
  stockValueDiff?: number
): number {
  if (
    isReturn &&
    item.return_qty_from_rejected_warehouse &&
    !billForRejectedQty
  ) {
    return 0;
  }

  let creditAmount =
    accountCurrency === companyCurrency
      ? flt(item.base_net_amount)
      : flt(item.net_amount);

  let outgoingAmount = item.base_net_amount || 0;
  if (
    item.received_qty &&
    billForRejectedQty
  ) {
    outgoingAmount = flt(
      ((item.base_net_amount || 0) / item.received_qty) * item.qty
    );
  }

  if (isInternalTransfer && item.valuation_rate && stockValueDiff !== undefined) {
    outgoingAmount = Math.abs(stockValueDiff);
    creditAmount = outgoingAmount;
  }

  if (
    item.rejected_qty &&
    billForRejectedQty
  ) {
    // rejected_warehouse stock_value_diff should be injected by caller
    outgoingAmount += stockValueDiff || 0;
    creditAmount = outgoingAmount;
  }

  return outgoingAmount;
}

export function calculateDivisionalLoss(
  item: PurchaseReceiptItem,
  outgoingAmount: number,
  stockValueDiff: number,
  rejectedItemCost: number,
  billForRejectedQty: boolean
): number {
  if (item.is_fixed_asset) return 0;

  const valuationAmountAsPerDoc =
    flt(outgoingAmount) +
    flt(item.landed_cost_voucher_amount) +
    flt(item.rm_supp_cost) +
    flt(item.item_tax_amount) +
    flt(item.amount_difference_with_purchase_invoice);

  let divisionalLoss = flt(valuationAmountAsPerDoc - flt(stockValueDiff));

  if (item.rejected_qty && billForRejectedQty) {
    divisionalLoss -= rejectedItemCost;
  }

  return divisionalLoss;
}

// ---------------------------------------------------------------------------
// Stock reservation helpers
// ---------------------------------------------------------------------------

export interface StockReservationItemDetails {
  sales_order_item: string;
  item_code: string;
  warehouse?: string;
  qty_to_reserve: number;
  from_voucher_no: string;
  from_voucher_detail_no: string;
  serial_and_batch_bundle?: string;
}

export function collectSoItemsForStockReservation(
  pr: PurchaseReceipt
): Record<string, StockReservationItemDetails[]> {
  const map: Record<string, StockReservationItemDetails[]> = {};
  for (const item of pr.items) {
    if (item.sales_order && item.sales_order_item) {
      const details: StockReservationItemDetails = {
        sales_order_item: item.sales_order_item,
        item_code: item.item_code,
        warehouse: item.warehouse,
        qty_to_reserve: item.stock_qty,
        from_voucher_no: pr.name,
        from_voucher_detail_no: item.id || item.idx.toString(),
        serial_and_batch_bundle: item.serial_and_batch_bundle,
      };
      map[item.sales_order] = map[item.sales_order] || [];
      map[item.sales_order].push(details);
    }
  }
  return map;
}

export interface ProductionPlanReference {
  production_plan: string;
  material_request_plan_item: string;
}

export function getProductionPlanReferences(
  pr: PurchaseReceipt,
  materialRequestItems: Array<{
    material_request_plan_item?: string;
    production_plan?: string;
    name: string;
  }>
): Record<string, ProductionPlanReference> {
  const references: Record<string, ProductionPlanReference> = {};
  for (const item of materialRequestItems) {
    if (item.production_plan) {
      references[item.name] = {
        production_plan: item.production_plan,
        material_request_plan_item: item.material_request_plan_item || "",
      };
    }
  }
  return references;
}

// ---------------------------------------------------------------------------
// Production Plan Sub-Assembly helper
// ---------------------------------------------------------------------------

export function computeSubAssemblyReceivedQty(
  poItems: Array<{
    production_plan_sub_assembly_item?: string;
    received_qty: number;
    qty: number;
    fg_item_qty: number;
  }>
): Record<string, number> {
  const result: Record<string, number> = {};
  const grouped: Record<string, typeof poItems> = {};

  for (const item of poItems) {
    if (item.production_plan_sub_assembly_item) {
      grouped[item.production_plan_sub_assembly_item] =
        grouped[item.production_plan_sub_assembly_item] || [];
      grouped[item.production_plan_sub_assembly_item].push(item);
    }
  }

  for (const [key, items] of Object.entries(grouped)) {
    let total = 0;
    for (const item of items) {
      const ratio = item.qty / (item.fg_item_qty || 1);
      total += item.received_qty / ratio;
    }
    result[key] = total;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Orchestration: run all validations
// ---------------------------------------------------------------------------

export interface PurchaseReceiptValidationInput {
  pr: PurchaseReceipt;
  poRequiredSetting: boolean;
  isInternalTransfer: boolean;
  poPostingDates: Record<string, string>;
  stockItemChecker: (itemCode: string) => boolean;
  uomMustBeInteger: (uom: string) => boolean;
  referenceDocFetcher: (doctype: string, name: string) => Record<string, unknown> | undefined;
  qiFetcher: (qiName: string) => {
    reference_type?: string;
    reference_name?: string;
    item_code?: string;
  } | null;
  poStatuses: Record<string, "Draft" | "To Receive" | "Partially Received" | "Completed" | "Closed" | "Cancelled" | "On Hold">;
  isCwipEnabled: (assetCategory: string) => boolean;
  companyDefaultFetcher: (key: string) => string | undefined;
  provisionalAccountingEnabled: boolean;
  defaultProvisionalAccount: string | undefined;
  submittedPurchaseInvoices: string[];
}

export function validatePurchaseReceipt(input: PurchaseReceiptValidationInput): ValidationResult {
  const result: ValidationResult = { valid: true, errors: [], warnings: [] };
  const { pr } = input;

  result.errors.push(...validatePostingTime(pr));
  result.errors.push(...validatePostingDateWithPo(pr, input.poPostingDates));
  result.errors.push(...poRequired(pr, input.poRequiredSetting, input.isInternalTransfer));
  result.errors.push(...validateItemsQualityInspection(pr, input.qiFetcher));
  result.errors.push(
    ...validateUomIsInteger("uom", ["qty", "received_qty"], pr.items, input.uomMustBeInteger)
  );
  result.errors.push(
    ...validateUomIsInteger("stock_uom", ["stock_qty"], pr.items, input.uomMustBeInteger)
  );
  result.errors.push(...validateCwipAccounts(pr, input.isCwipEnabled, input.companyDefaultFetcher));
  result.errors.push(
    ...validateProvisionalExpenseAccount(
      pr,
      input.provisionalAccountingEnabled,
      input.defaultProvisionalAccount
    )
  );
  result.errors.push(...validateFuturePostingDate(pr));
  result.errors.push(...checkOnHoldOrClosedStatus(pr, input.poStatuses));

  if (pr._action === "submit") {
    result.errors.push(...checkNextDocstatus(pr, input.submittedPurchaseInvoices));
  }

  result.valid = result.errors.length === 0;
  return result;
}

// ---------------------------------------------------------------------------
// Status determination
// ---------------------------------------------------------------------------

export function determinePurchaseReceiptStatus(
  pr: PurchaseReceipt,
  perBilled: number
): PurchaseReceiptStatus {
  if (pr.docstatus === 0) return "Draft";
  if (pr.docstatus === 2) return "Cancelled";
  if (pr.is_return) return pr.per_returned >= 99.99 ? "Return Issued" : "Return";
  if (perBilled >= 99.99) return "Completed";
  if (perBilled > 0) return "Partly Billed";
  return "To Bill";
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export function calculateTotals(pr: PurchaseReceipt): {
  totalQty: number;
  totalNetWeight?: number;
} {
  let totalQty = 0;
  for (const item of pr.items) {
    totalQty += flt(item.qty);
  }
  return { totalQty };
}
