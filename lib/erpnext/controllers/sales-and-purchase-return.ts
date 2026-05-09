/**
 * Ported from erpnext/controllers/sales_and_purchase_return.py
 * Pure business logic for sales & purchase return validation and creation.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

import { TransactionDoc, TransactionItem, TaxRow } from "./taxes-and-totals";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReturnItem extends TransactionItem {
  idx: number;
  item_name?: string;
  stock_qty?: number;
  received_qty?: number;
  rejected_qty?: number;
  conversion_factor?: number;
  warehouse?: string;
  rejected_warehouse?: string;
  serial_no?: string;
  batch_no?: string;
  serial_and_batch_bundle?: string;
  use_serial_batch_fields?: boolean;
  incoming_rate?: number;
  allow_zero_valuation_rate?: boolean;
  // Link fields to original doc
  dn_detail?: string;
  sales_invoice_item?: string;
  purchase_invoice_item?: string;
  purchase_receipt_item?: string;
  subcontracting_receipt_item?: string;
  pos_invoice_item?: string;
  return_qty_from_rejected_warehouse?: boolean;
  // Sales references
  against_sales_order?: string;
  against_sales_invoice?: string;
  so_detail?: string;
  expense_account?: string;
  // Purchase references
  purchase_order?: string;
  purchase_order_item?: string;
  purchase_receipt?: string;
  po_detail?: string;
  pr_detail?: string;
  tax_withholding_category?: string;
  apply_tds?: boolean;
  // Delivery / Sales Order
  delivery_note?: string;
  sales_order?: string;
  // Subcontracting
  subcontracting_order?: string;
  subcontracting_order_item?: string;
  // Name (detail row id)
  name?: string;
  doctype?: string;
}

export interface PaymentRow {
  mode_of_payment?: string;
  type?: string;
  amount?: number;
  base_amount?: number;
  account?: string;
  default?: boolean;
}

export interface ReturnDoc extends TransactionDoc {
  is_return?: boolean;
  return_against?: string;
  customer?: string;
  supplier?: string;
  posting_date?: string;
  posting_time?: string;
  update_stock?: boolean;
  docstatus?: number;
  set_warehouse?: string;
  is_pos?: boolean;
  consolidated_invoice?: string;
  pos_closing_entry?: string;
  party_account_currency?: string;
  payments?: PaymentRow[];
  tax_withholding_group?: string;
  ignore_tax_withholding_threshold?: boolean;
  ignore_pricing_rule?: boolean;
  pricing_rules?: string[];
  is_internal_customer?: boolean;
  is_internal_supplier?: boolean;
  paid_amount?: number;
  base_paid_amount?: number;
  payment_terms_template?: string;
  payment_schedule?: Array<{ payment_amount: number; due_date?: string }>;
  items: ReturnItem[];
  taxes: TaxRow[];
}

export interface RefItemDict {
  qty: number;
  rate: number;
  stock_qty: number;
  rejected_qty: number;
  received_qty: number;
  serial_no: string[];
  conversion_factor: number;
  batch_no: string[];
}

export interface AlreadyReturnedData {
  qty?: number;
  stock_qty?: number;
  received_qty?: number;
  rejected_qty?: number;
}

export interface MakeReturnDocResult {
  success: boolean;
  doc?: ReturnDoc;
  error?: string;
}

export interface RateForReturnInput {
  voucherType: string;
  voucherNo: string;
  itemCode: string;
  returnAgainst?: string;
  itemRow?: ReturnItem;
  voucherDetailNo?: string;
  sle?: {
    item_code: string;
    warehouse: string;
    posting_date?: string;
    posting_time?: string;
    actual_qty?: number;
    stock_value_difference?: number;
    serial_and_batch_bundle?: string;
    company?: string;
    voucher_type?: string;
    voucher_no?: string;
  };
  itemDetails?: { has_batch_no?: boolean; has_expiry_date?: boolean };
  setZeroRateForExpiredBatch?: boolean;
  batchNo?: string;
  postingDate?: string;
  rate?: number;
  allowZeroValuationRate?: boolean;
  incomingRate?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | null | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: unknown): number {
  const v =
    typeof value === "string"
      ? parseInt(value, 10)
      : typeof value === "number"
        ? value
        : 0;
  return Number.isNaN(v) ? 0 : v;
}

function scrub(doctype: string): string {
  return doctype.toLowerCase().replace(/\s+/g, "_");
}

function getDatetime(dt: string): Date {
  return new Date(dt);
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function formatDatetime(dt: string): string {
  return dt;
}

/* ------------------------------------------------------------------ */
/*  validateReturn                                                     */
/* ------------------------------------------------------------------ */

export function validateReturn(
  doc: ReturnDoc,
  refDoc?: ReturnDoc
): { success: true } | { success: false; error: string } {
  if (!doc.is_return) {
    return { success: true };
  }

  if (doc.return_against) {
    if (!refDoc) {
      return {
        success: false,
        error: `Reference document required for return against ${doc.return_against}`,
      };
    }
    const againstResult = validateReturnAgainst(doc, refDoc);
    if (!againstResult.success) return againstResult;

    const validItems = buildRefItemDict(refDoc.items, doc.doctype);
    const alreadyReturned = getAlreadyReturnedItems(doc.doctype, doc.return_against, []);
    const itemsResult = validateReturnedItems(doc, validItems, alreadyReturned);
    if (!itemsResult.success) return itemsResult;
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  validateReturnAgainst                                              */
/* ------------------------------------------------------------------ */

export function validateReturnAgainst(
  doc: ReturnDoc,
  refDoc: ReturnDoc
): { success: true } | { success: false; error: string } {
  const partyType =
    doc.doctype === "Sales Invoice" ||
    doc.doctype === "Delivery Note" ||
    doc.doctype === "POS Invoice"
      ? "customer"
      : "supplier";

  const docParty = doc[partyType];
  const refParty = refDoc[partyType];

  if (docParty !== refParty) {
    return {
      success: false,
      error: `The ${partyType} ${String(docParty)} does not match with the ${partyType} ${String(refParty)} in the ${refDoc.doctype} ${refDoc.name ?? ""}`,
    };
  }

  if (
    refDoc.company === doc.company &&
    refParty === docParty &&
    (refDoc.docstatus ?? 0) === 1
  ) {
    const returnPostingDatetime = `${doc.posting_date ?? ""} ${doc.posting_time ?? "00:00:00"}`;
    const refPostingDatetime = `${refDoc.posting_date ?? ""} ${refDoc.posting_time ?? "00:00:00"}`;

    if (getDatetime(returnPostingDatetime) < getDatetime(refPostingDatetime)) {
      return {
        success: false,
        error: `Posting timestamp must be after ${formatDatetime(refPostingDatetime)}`,
      };
    }

    if (flt(doc.conversion_rate) !== flt(refDoc.conversion_rate)) {
      return {
        success: false,
        error: `Exchange Rate must be same as ${doc.doctype} ${doc.return_against ?? ""} (${refDoc.conversion_rate})`,
      };
    }

    if (doc.doctype === "Sales Invoice" && doc.update_stock && !refDoc.update_stock) {
      return {
        success: false,
        error: `'Update Stock' can not be checked because items are not delivered via ${doc.return_against ?? ""}`,
      };
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  validateReturnedItems                                              */
/* ------------------------------------------------------------------ */

export function validateReturnedItems(
  doc: ReturnDoc,
  validItems: Record<string, RefItemDict>,
  alreadyReturnedItems: Record<string, AlreadyReturnedData>
): { success: true } | { success: false; error: string } {
  const warehouseMandatory = !(
    (doc.doctype === "Purchase Invoice" || doc.doctype === "Sales Invoice") &&
    !doc.update_stock
  );

  let itemsReturned = false;

  for (const d of doc.items) {
    let key = d.item_code;
    let raiseException = false;

    if (
      ["Purchase Receipt", "Purchase Invoice", "Sales Invoice", "POS Invoice"].includes(
        doc.doctype
      )
    ) {
      const field = scrub(doc.doctype) + "_item";
      const refFieldValue = d[field as keyof ReturnItem] as string | undefined;
      if (refFieldValue) {
        key = `${d.item_code}::${refFieldValue}`;
        raiseException = true;
      }
    } else if (doc.doctype === "Delivery Note") {
      const dnDetail = d.dn_detail;
      if (dnDetail) {
        key = `${d.item_code}::${dnDetail}`;
      }
    }

    if (d.item_code && (flt(d.qty) <= 0 || flt(d.received_qty) <= 0)) {
      const ref = validItems[key];
      if (!ref) {
        if (raiseException) {
          return {
            success: false,
            error: `Row # ${d.idx}: Returned Item ${d.item_code} does not exist in ${doc.doctype} ${doc.return_against ?? ""}`,
          };
        }
        // Non-raising: original shows a message; pure version continues.
      } else {
        const qtyResult = validateQuantity(
          doc,
          key,
          d,
          ref,
          validItems,
          alreadyReturnedItems
        );
        if (!qtyResult.success) return qtyResult;

        if (
          ref.rate &&
          flt(d.rate) > ref.rate &&
          (doc.doctype === "Delivery Note" || doc.doctype === "Sales Invoice")
        ) {
          return {
            success: false,
            error: `Row # ${d.idx}: Rate cannot be greater than the rate used in ${doc.doctype} ${doc.return_against ?? ""}`,
          };
        }

        if (warehouseMandatory && !d.warehouse) {
          return {
            success: false,
            error: `Row # ${d.idx}: Warehouse is mandatory for Item ${d.item_code}`,
          };
        }
      }

      itemsReturned = true;
    } else if (d.item_name) {
      itemsReturned = true;
    }
  }

  if (!itemsReturned) {
    return {
      success: false,
      error: "At least one item should be entered with negative quantity in return document",
    };
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  validateQuantity                                                   */
/* ------------------------------------------------------------------ */

export function validateQuantity(
  doc: ReturnDoc,
  key: string,
  args: ReturnItem,
  ref: RefItemDict,
  _validItems: Record<string, RefItemDict>,
  alreadyReturnedItems: Record<string, AlreadyReturnedData>
): { success: true } | { success: false; error: string } {
  let fields: Array<"stock_qty" | "qty" | "received_qty" | "rejected_qty"> = ["stock_qty"];
  if (
    (doc.doctype === "Purchase Invoice" || doc.doctype === "Sales Invoice") &&
    !doc.update_stock
  ) {
    fields = ["qty"];
  }

  if (
    ["Purchase Receipt", "Purchase Invoice", "Subcontracting Receipt"].includes(doc.doctype)
  ) {
    if (!args.return_qty_from_rejected_warehouse) {
      fields = [...fields, "received_qty", "rejected_qty"];
    } else {
      fields = [...fields, "received_qty"];
    }
  }

  const alreadyReturnedData = alreadyReturnedItems[key] ?? {};
  const fieldPrecision = 2;

  for (const column of fields) {
    const returnedQty =
      Object.keys(alreadyReturnedData).length > 0
        ? flt(alreadyReturnedData[column] ?? 0, fieldPrecision)
        : 0;

    let referenceQty: number;
    let currentStockQty: number;

    if (column === "stock_qty" && !args.return_qty_from_rejected_warehouse) {
      referenceQty = ref.stock_qty;
      currentStockQty = args.stock_qty ?? 0;
    } else if (args.return_qty_from_rejected_warehouse) {
      referenceQty = ref.rejected_qty * ref.conversion_factor;
      const argVal = (args[column] ?? 0) as number;
      currentStockQty =
        column !== "stock_qty"
          ? argVal * (args.conversion_factor ?? 1.0)
          : argVal;
    } else {
      const refVal = (ref[column] ?? 0) as number;
      referenceQty = refVal * ref.conversion_factor;
      const argVal = (args[column] ?? 0) as number;
      currentStockQty = argVal * (args.conversion_factor ?? 1.0);
    }

    const maxReturnableQty = flt(
      flt(referenceQty, fieldPrecision) - returnedQty,
      fieldPrecision
    );
    const label = column
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const argColumnValue = (args[column] ?? 0) as number;

    if (referenceQty) {
      if (flt(argColumnValue) > 0) {
        return {
          success: false,
          error: `${label} must be negative in return document`,
        };
      } else if (returnedQty >= referenceQty && argColumnValue >= 0) {
        return {
          success: false,
          error: `Item ${args.item_code} has already been returned`,
        };
      } else if (Math.abs(flt(currentStockQty, fieldPrecision)) > maxReturnableQty) {
        return {
          success: false,
          error: `Row # ${args.idx}: Cannot return more than ${maxReturnableQty} for Item ${args.item_code}`,
        };
      }
    }
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  getAlreadyReturnedItems                                            */
/* ------------------------------------------------------------------ */

export function getAlreadyReturnedItems(
  doctype: string,
  _returnAgainst: string,
  returnedRows: Array<{
    item_code: string;
    qty: number;
    stock_qty?: number;
    rejected_qty?: number;
    received_qty?: number;
    conversion_factor?: number;
    dn_detail?: string;
    sales_invoice_item?: string;
    purchase_invoice_item?: string;
    purchase_receipt_item?: string;
    subcontracting_receipt_item?: string;
    pos_invoice_item?: string;
  }>
): Record<string, AlreadyReturnedData> {
  const items: Record<string, AlreadyReturnedData> = {};

  const field =
    doctype === "Purchase Receipt" ||
    doctype === "Purchase Invoice" ||
    doctype === "Sales Invoice" ||
    doctype === "POS Invoice"
      ? scrub(doctype) + "_item"
      : "dn_detail";

  for (const d of returnedRows) {
    const refKey = d[field as keyof typeof d] as string | undefined;
    const key = refKey ? `${d.item_code}::${refKey}` : d.item_code;

    if (!items[key]) {
      items[key] = {
        qty: 0,
        stock_qty: 0,
        received_qty: 0,
        rejected_qty: 0,
      };
    }

    items[key].qty = flt(items[key].qty) + Math.abs(flt(d.qty));
    items[key].stock_qty = flt(items[key].stock_qty) + Math.abs(flt(d.stock_qty));

    if (
      doctype === "Purchase Receipt" ||
      doctype === "Purchase Invoice" ||
      doctype === "Subcontracting Receipt"
    ) {
      const cf = flt(d.conversion_factor ?? 1);
      items[key].rejected_qty =
        flt(items[key].rejected_qty) + Math.abs(flt(d.rejected_qty)) * cf;
      items[key].received_qty =
        flt(items[key].received_qty) + Math.abs(flt(d.received_qty)) * cf;
    }
  }

  return items;
}

/* ------------------------------------------------------------------ */
/*  makeReturnDoc                                                      */
/* ------------------------------------------------------------------ */

export function makeReturnDoc(
  doctype: string,
  sourceDoc: ReturnDoc,
  returnAgainstRejectedQty = false
): MakeReturnDocResult {
  try {
    const doc: ReturnDoc = JSON.parse(JSON.stringify(sourceDoc));
    doc.is_return = true;
    doc.ignore_pricing_rule = true;
    doc.pricing_rules = [];
    doc.return_against = sourceDoc.name;
    doc.set_warehouse = "";

    if (doctype === "Sales Invoice" || doctype === "POS Invoice") {
      doc.is_pos = sourceDoc.is_pos;
    } else if (doctype === "Delivery Note") {
      // default_warehouse_for_sales_return is applied by caller
    }

    if (doctype === "Sales Invoice" || doctype === "Purchase Invoice") {
      doc.tax_withholding_group = sourceDoc.tax_withholding_group;
      doc.ignore_tax_withholding_threshold = sourceDoc.ignore_tax_withholding_threshold;
    }

    if (doc.taxes) {
      for (const tax of doc.taxes) {
        if (tax.charge_type === "Actual") {
          tax.tax_amount = -1 * (tax.tax_amount ?? 0);
        }
      }
    }

    if (doc.is_return) {
      if (doctype === "Sales Invoice" || doctype === "POS Invoice") {
        doc.consolidated_invoice = "";
        if (doctype === "Sales Invoice") {
          doc.pos_closing_entry = "";
        }
        doc.party_account_currency = sourceDoc.party_account_currency;
        doc.payments = [];
        if (sourceDoc.payments) {
          let paidAmount = 0.0;
          let basePaidAmount = 0.0;
          for (const data of sourceDoc.payments) {
            const baseAmt = flt((data.amount ?? 0) * sourceDoc.conversion_rate);
            paidAmount += data.amount ?? 0;
            basePaidAmount += baseAmt;
            doc.payments.push({
              mode_of_payment: data.mode_of_payment,
              type: data.type,
              amount: -1 * paidAmount,
              base_amount: -1 * basePaidAmount,
              account: data.account,
              default: data.default,
            });
          }
          if (doc.is_pos) {
            doc.paid_amount = -1 * (sourceDoc.paid_amount ?? 0);
          }
        }
      } else if (doctype === "Purchase Invoice") {
        doc.paid_amount = -1 * (sourceDoc.paid_amount ?? 0);
        doc.base_paid_amount = -1 * (sourceDoc.base_paid_amount ?? 0);
        doc.payment_terms_template = "";
        doc.payment_schedule = [];
      }
    }

    for (const item of doc.items) {
      item.qty = -1 * item.qty;
      item.pricing_rules = undefined;

      if (doctype === "Purchase Receipt" || doctype === "Subcontracting Receipt") {
        const whMap = { qty: 0, stock_qty: 0 };
        const rejectedWhMap = { qty: 0, stock_qty: 0 };

        if (doctype === "Subcontracting Receipt") {
          item.received_qty = -1 * flt(item.qty);
        } else {
          item.rejected_qty = -1 * flt((item.rejected_qty ?? 0) - (rejectedWhMap.qty || 0));
        }

        item.qty = -1 * flt(item.qty - (whMap.qty || 0));

        if (!returnAgainstRejectedQty) {
          item.stock_qty = -1 * flt((item.stock_qty ?? 0) - (flt(whMap.stock_qty) || 0));
        }

        if (doctype === "Subcontracting Receipt") {
          item.subcontracting_receipt_item = item.name;
          if (returnAgainstRejectedQty) {
            item.qty = -1 * flt((item.rejected_qty ?? 0) - (rejectedWhMap.qty || 0));
            item.rejected_qty = 0.0;
            item.rejected_warehouse = "";
            item.warehouse = item.rejected_warehouse;
            item.received_qty = item.qty;
            item.return_qty_from_rejected_warehouse = true;
          }
        } else {
          item.purchase_receipt_item = item.name;
          if (returnAgainstRejectedQty) {
            item.qty = -1 * flt((item.rejected_qty ?? 0) - (rejectedWhMap.qty || 0));
            item.rejected_qty = 0.0;
            item.rejected_warehouse = "";
            item.warehouse = item.rejected_warehouse;
            item.received_qty = item.qty;
            item.return_qty_from_rejected_warehouse = true;
          }
        }
      } else if (doctype === "Purchase Invoice") {
        const returnedQtyMap = { qty: 0, stock_qty: 0, received_qty: 0, rejected_qty: 0 };
        item.received_qty = -1 * flt((item.received_qty ?? 0) - (returnedQtyMap.received_qty || 0));
        item.rejected_qty = -1 * flt((item.rejected_qty ?? 0) - (returnedQtyMap.rejected_qty || 0));
        item.qty = -1 * flt(item.qty - (returnedQtyMap.qty || 0));
        item.stock_qty = -1 * flt((item.stock_qty ?? 0) - (returnedQtyMap.stock_qty || 0));
        item.purchase_invoice_item = item.name;
      } else if (doctype === "Delivery Note") {
        const returnedQtyMap = { qty: 0, stock_qty: 0 };
        item.qty = -1 * flt(item.qty - (returnedQtyMap.qty || 0));
        item.stock_qty = -1 * flt((item.stock_qty ?? 0) - (returnedQtyMap.stock_qty || 0));
        item.dn_detail = item.name;
      } else if (doctype === "Sales Invoice" || doctype === "POS Invoice") {
        const returnedQtyMap = { qty: 0, stock_qty: 0 };
        item.qty = -1 * flt(item.qty - (returnedQtyMap.qty || 0));
        item.stock_qty = -1 * flt((item.stock_qty ?? 0) - (returnedQtyMap.stock_qty || 0));
        if (doctype === "Sales Invoice") {
          item.sales_invoice_item = item.name;
        } else {
          item.pos_invoice_item = item.name;
        }
      }

      if (!item.use_serial_batch_fields && item.serial_and_batch_bundle) {
        item.serial_no = undefined;
        item.batch_no = undefined;
      }

      if ((item.serial_no || item.batch_no) && !item.serial_and_batch_bundle && !item.use_serial_batch_fields) {
        item.use_serial_batch_fields = true;
      }

      if (!item.serial_no && !item.batch_no && item.serial_and_batch_bundle && item.use_serial_batch_fields) {
        item.use_serial_batch_fields = false;
      }
    }

    if (doc.discount_amount !== undefined) {
      doc.discount_amount = -1 * (sourceDoc.discount_amount ?? 0);
    }

    return { success: true, doc };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  getRateForReturn                                                   */
/* ------------------------------------------------------------------ */

export function getRateForReturn(input: RateForReturnInput): number {
  const {
    voucherType,
    returnAgainst,
    sle,
    itemDetails,
    setZeroRateForExpiredBatch,
    batchNo,
    postingDate,
    rate: itemRate,
    allowZeroValuationRate,
    incomingRate,
  } = input;

  let rate = 0;

  if (
    voucherType === "Purchase Receipt" ||
    voucherType === "Purchase Invoice" ||
    voucherType === "Subcontracting Receipt"
  ) {
    rate = flt(incomingRate);
  } else {
    if (sle && sle.stock_value_difference !== undefined && sle.actual_qty) {
      rate = Math.abs(flt(sle.stock_value_difference) / flt(sle.actual_qty));
    }
  }

  if (
    setZeroRateForExpiredBatch &&
    itemDetails?.has_batch_no &&
    itemDetails?.has_expiry_date &&
    !returnAgainst &&
    (voucherType === "Sales Invoice" || voucherType === "Delivery Note")
  ) {
    if (batchNo && postingDate && isBatchExpired(batchNo, postingDate)) {
      return 0;
    }
  }

  if (!rate && !returnAgainst && (voucherType === "Sales Invoice" || voucherType === "Delivery Note")) {
    rate = flt(incomingRate);
  }

  if (!rate && (voucherType === "Sales Invoice" || voucherType === "Delivery Note")) {
    if (!allowZeroValuationRate) {
      rate = flt(itemRate);
    }
  }

  return flt(rate);
}

/* ------------------------------------------------------------------ */
/*  getAvailableSerialNos                                              */
/* ------------------------------------------------------------------ */

export function getAvailableSerialNos(
  serialNos: string[],
  warehouse: string,
  serialWarehouseMap: Record<string, string>
): string[] {
  return serialNos.filter((sn) => serialWarehouseMap[sn] === warehouse);
}

/* ------------------------------------------------------------------ */
/*  getAvailableBatchQty                                               */
/* ------------------------------------------------------------------ */

export function getAvailableBatchQty(
  _parentDoc: ReturnDoc,
  batchNo: string,
  _warehouse: string,
  batchQtyMap: Record<string, number>
): number {
  return flt(batchQtyMap[batchNo] ?? 0);
}

/* ------------------------------------------------------------------ */
/*  Internal helpers                                                   */
/* ------------------------------------------------------------------ */

function buildRefItemDict(
  items: ReturnItem[],
  doctype: string
): Record<string, RefItemDict> {
  const validItems: Record<string, RefItemDict> = {};

  for (const refItemRow of items) {
    let key = refItemRow.item_code;
    if (refItemRow.name) {
      key = `${refItemRow.item_code}::${refItemRow.name}`;
    }

    if (!validItems[key]) {
      validItems[key] = {
        qty: 0,
        rate: 0,
        stock_qty: 0,
        rejected_qty: 0,
        received_qty: 0,
        serial_no: [],
        conversion_factor: refItemRow.conversion_factor ?? 1,
        batch_no: [],
      };
    }

    const itemDict = validItems[key];
    itemDict.qty += flt(refItemRow.qty);
    itemDict.stock_qty += flt(refItemRow.stock_qty);
    if ((refItemRow.rate ?? 0) > itemDict.rate) {
      itemDict.rate = refItemRow.rate ?? 0;
    }

    if (
      ["Purchase Invoice", "Purchase Receipt", "Subcontracting Receipt"].includes(
        refItemRow.doctype ?? doctype
      )
    ) {
      itemDict.received_qty += flt(refItemRow.received_qty);
      itemDict.rejected_qty += flt(refItemRow.rejected_qty);
    }

    if (refItemRow.serial_no) {
      itemDict.serial_no.push(...refItemRow.serial_no.split("\n").filter(Boolean));
    }

    if (refItemRow.batch_no) {
      itemDict.batch_no.push(refItemRow.batch_no);
    }
  }

  return validItems;
}

function isBatchExpired(batchNo: string, postingDate: string, batchExpiryMap?: Record<string, string>): boolean {
  const expiryDate = batchExpiryMap?.[batchNo];
  if (!expiryDate) return false;
  return getdate(postingDate) > getdate(expiryDate);
}
