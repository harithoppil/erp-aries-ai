/**
 * accounts-pos-invoice.ts
 * Ported business logic from ERPNext accounts/doctype/pos_invoice/pos_invoice.py
 * Pure validation & calculation functions — NO database calls.
 */

export type POSInvoiceStatus =
  | "Draft"
  | "Return"
  | "Credit Note Issued"
  | "Consolidated"
  | "Submitted"
  | "Paid"
  | "Partly Paid"
  | "Unpaid"
  | "Overdue"
  | "Partly Paid and Discounted"
  | "Unpaid and Discounted"
  | "Overdue and Discounted"
  | "Cancelled";

export interface POSInvoicePayment {
  idx: number;
  mode_of_payment: string;
  amount: number;
  base_amount?: number;
  account?: string;
  type?: string;
  default?: boolean;
}

export interface POSInvoiceItem {
  idx: number;
  item_code: string;
  warehouse?: string;
  qty: number;
  stock_qty: number;
  stock_uom?: string;
  uom?: string;
  has_serial_no?: boolean;
  has_batch_no?: boolean;
  use_serial_batch_fields?: boolean;
  serial_no?: string;
  batch_no?: string;
  serial_and_batch_bundle?: string;
  pos_invoice_item?: string;
  cost_center?: string;
  rate?: number;
  amount?: number;
}

export interface POSInvoiceTax {
  idx: number;
  account_head: string;
  tax_amount_after_discount_amount?: number;
}

export interface POSInvoicePackedItem {
  idx: number;
  item_code: string;
  warehouse?: string;
  qty: number;
  serial_and_batch_bundle?: string;
}

export interface POSInvoice {
  name?: string;
  customer?: string;
  company: string;
  is_pos: boolean;
  is_return: boolean;
  docstatus: number;
  status?: POSInvoiceStatus;
  pos_profile?: string;
  posting_date: string;
  due_date?: string;
  currency?: string;
  conversion_rate?: number;
  grand_total: number;
  rounded_total?: number;
  net_total?: number;
  base_grand_total?: number;
  base_rounded_total?: number;
  base_net_total?: number;
  total_taxes_and_charges?: number;
  paid_amount: number;
  base_paid_amount?: number;
  change_amount?: number;
  base_change_amount?: number;
  outstanding_amount?: number;
  write_off_amount?: number;
  base_write_off_amount?: number;
  account_for_change_amount?: string;
  debit_to?: string;
  write_off_account?: string;
  consolidated_invoice?: string;
  return_against?: string;
  loyalty_program?: string;
  loyalty_points?: number;
  loyalty_amount?: number;
  redeem_loyalty_points?: boolean;
  loyalty_redemption_account?: string;
  loyalty_redemption_cost_center?: string;
  coupon_code?: string;
  is_discounted?: boolean;
  invoice_type_in_pos?: string;
  items: POSInvoiceItem[];
  payments: POSInvoicePayment[];
  taxes?: POSInvoiceTax[];
  packed_items?: POSInvoicePackedItem[];
  update_stock?: boolean;
  set_warehouse?: string;
  contact_mobile?: string;
  payment_terms_template?: string;
}

export interface POSProfile {
  name?: string;
  company: string;
  warehouse?: string;
  account_for_change_amount?: string;
  currency?: string;
  letter_head?: string;
  tc_name?: string;
  select_print_heading?: string;
  write_off_account?: string;
  taxes_and_charges?: string;
  write_off_cost_center?: string;
  apply_discount_on?: string;
  cost_center?: string;
  tax_category?: string;
  ignore_pricing_rule?: boolean;
  company_address?: string;
  update_stock?: boolean;
  selling_price_list?: string;
  customer?: string;
  validate_stock_on_save?: boolean;
  payments?: Array<{
    mode_of_payment: string;
    default_account?: string;
    type?: string;
    allow_in_returns?: boolean;
    default?: boolean;
  }>;
}

export interface StockAvailabilityResult {
  availability: number | Array<{ item_code: string; required: number; available: number }>;
  is_stock_item: boolean;
  is_negative_stock_allowed: boolean;
}

export interface BinRecord {
  item_code: string;
  warehouse: string;
  actual_qty: number;
}

export interface POSReservedQtyResult {
  item_code: string;
  warehouse: string;
  reserved_qty: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface StatusResult {
  status: POSInvoiceStatus;
}

export interface ChangeAmountResult {
  change_amount: number;
  base_change_amount: number;
}

export interface OutstandingAmountResult {
  outstanding_amount: number;
}

/* ── Helpers ─────────────────────────────────────────────── */

function flt(value: number | string | undefined | null, precision?: number): number {
  const num = parseFloat(String(value ?? 0));
  if (precision !== undefined) {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }
  return num;
}

function cint(value: boolean | number | string | undefined | null): number {
  return parseInt(String(value ?? 0), 10) || 0;
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function nowdate(): string {
  return new Date().toISOString().split("T")[0];
}

/* ── Validation Functions ────────────────────────────────── */

export function validatePOSInvoice(
  invoice: POSInvoice,
  posProfile?: POSProfile,
  posSettingsInvoiceType?: string,
  binRecords: BinRecord[] = [],
  reservedQtyRecords: POSReservedQtyResult[] = [],
  returnAgainstSerialNos: string[] = [],
): ValidationResult {
  const errors: string[] = [];

  if (!invoice.customer) {
    errors.push("Please select Customer first");
  }

  if (!cint(invoice.is_pos)) {
    errors.push("POS Invoice should have the field Include Payment checked.");
  }

  // validate_is_pos_using_sales_invoice
  if (posSettingsInvoiceType === "Sales Invoice" && !invoice.is_return) {
    errors.push("Sales Invoice mode is activated in POS. Please create Sales Invoice instead.");
  }

  // validate_mode_of_payment
  if (invoice.payments.length === 0) {
    errors.push("At least one mode of payment is required for POS invoice.");
  }

  // validate_change_account
  if (
    invoice.change_amount &&
    invoice.account_for_change_amount &&
    posProfile &&
    posProfile.company !== invoice.company
  ) {
    // In pure logic, company mismatch should be caught by caller or passed in
    // We keep the structure but note that account company would need to be provided
  }

  // validate_change_amount
  const changeResult = calculateChangeAmount(invoice);
  if (changeResult.change_amount && !invoice.account_for_change_amount) {
    errors.push("Please enter Account for Change Amount");
  }

  // validate_payment_amount
  const paymentErrors = validatePaymentAmount(invoice);
  errors.push(...paymentErrors);

  // validate_company_with_pos_company
  if (posProfile && invoice.company !== posProfile.company) {
    errors.push(`Company ${invoice.company} does not match with POS Profile Company ${posProfile.company}`);
  }

  // validate_return_items_qty
  if (invoice.is_return) {
    const returnErrors = validateReturnItemsQty(invoice, returnAgainstSerialNos);
    errors.push(...returnErrors);
  }

  // validate_serialised_or_batched_item
  const serialBatchErrors = validateSerialisedOrBatchedItem(invoice);
  errors.push(...serialBatchErrors);

  // validate_stock_availablility
  if (!invoice.is_return) {
    const stockErrors = validateStockAvailability(invoice, posProfile, binRecords, reservedQtyRecords);
    errors.push(...stockErrors);
  }

  // validate_loyalty_transaction
  if (invoice.redeem_loyalty_points) {
    if (!invoice.loyalty_redemption_account || !invoice.loyalty_redemption_cost_center) {
      // auto-populate handled by caller; here we just ensure values exist or warn
      if (!invoice.loyalty_redemption_account) {
        errors.push("Loyalty Redemption Account is required when redeeming loyalty points.");
      }
      if (!invoice.loyalty_redemption_cost_center) {
        errors.push("Loyalty Redemption Cost Center is required when redeeming loyalty points.");
      }
    }
    if (invoice.loyalty_program && invoice.loyalty_points && invoice.loyalty_points <= 0) {
      errors.push("Loyalty points must be greater than zero.");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validatePaymentAmount(invoice: POSInvoice): string[] {
  const errors: string[] = [];
  let totalAmountInPayments = 0;

  for (const entry of invoice.payments) {
    totalAmountInPayments += flt(entry.amount);
    if (!invoice.is_return && entry.amount < 0) {
      errors.push(`Row #${entry.idx} (Payment Table): Amount must be positive`);
    }
    if (invoice.is_return && entry.amount > 0) {
      errors.push(`Row #${entry.idx} (Payment Table): Amount must be negative`);
    }
  }

  if (invoice.is_return && invoice.docstatus !== 0) {
    const invoiceTotal = flt(invoice.rounded_total) || flt(invoice.grand_total);
    totalAmountInPayments = flt(totalAmountInPayments);
    if (totalAmountInPayments && totalAmountInPayments < invoiceTotal) {
      errors.push(`Total payments amount can't be greater than ${-invoiceTotal}`);
    }
  }

  return errors;
}

export function validateReturnItemsQty(invoice: POSInvoice, returnAgainstSerialNos: string[]): string[] {
  const errors: string[] = [];

  for (const d of invoice.items) {
    if (flt(d.qty) > 0) {
      errors.push(
        `Row #${d.idx}: You cannot add positive quantities in a return invoice. Please remove item ${d.item_code} to complete the return.`,
      );
    }

    if (d.serial_no) {
      const serialNos = d.serial_no.split("\n").map((s) => s.trim()).filter(Boolean);
      for (const sr of serialNos) {
        if (!returnAgainstSerialNos.includes(sr)) {
          errors.push(
            `Row #${d.idx}: Serial No ${sr} cannot be returned since it was not transacted in original invoice ${invoice.return_against ?? ""}`,
          );
        }
      }
    }
  }

  return errors;
}

export function validateSerialisedOrBatchedItem(invoice: POSInvoice): string[] {
  const errors: string[] = [];

  for (const d of invoice.items) {
    let errorMsg = "";
    if (
      d.has_serial_no &&
      ((
        !d.use_serial_batch_fields && !d.serial_and_batch_bundle) ||
        (d.use_serial_batch_fields && !d.serial_no)
      )
    ) {
      errorMsg = `Row #${d.idx}: Please select Serial No. for item ${d.item_code}`;
    } else if (
      d.has_batch_no &&
      ((
        !d.use_serial_batch_fields && !d.serial_and_batch_bundle) ||
        (d.use_serial_batch_fields && !d.batch_no)
      )
    ) {
      errorMsg = `Row #${d.idx}: Please select Batch No. for item ${d.item_code}`;
    }

    if (errorMsg) {
      errors.push(errorMsg);
    }
  }

  return errors;
}

export function validateStockAvailability(
  invoice: POSInvoice,
  posProfile?: POSProfile,
  binRecords: BinRecord[] = [],
  reservedQtyRecords: POSReservedQtyResult[] = [],
): string[] {
  const errors: string[] = [];

  // Skip if draft and pos_profile doesn't validate stock on save
  if (invoice.docstatus === 0 && !posProfile?.validate_stock_on_save) {
    return errors;
  }

  for (const d of invoice.items) {
    if (d.serial_and_batch_bundle) {
      continue;
    }

    const result = getStockAvailability(
      d.item_code,
      d.warehouse ?? invoice.set_warehouse ?? "",
      binRecords,
      reservedQtyRecords,
    );

    if (result.is_negative_stock_allowed) {
      continue;
    }

    if (Array.isArray(result.availability)) {
      const errorMsgs: string[] = [];
      for (const item of result.availability) {
        if (flt(item.available) < flt(item.required)) {
          errorMsgs.push(
            `<li>Packed Item ${item.item_code}: Required ${item.required.toFixed(2)}, Available ${item.available.toFixed(2)}</li>`,
          );
        }
      }
      if (errorMsgs.length > 0) {
        errors.push(
          `<b>Row #${d.idx}:</b> Bundle ${d.item_code} in warehouse ${d.warehouse} has insufficient packed items:<br><div style='margin-top: 15px;'><ul style='line-height: 0.8;'>${errorMsgs.join("<br>")}</ul></div>`,
        );
      }
    } else {
      const availability = result.availability;
      if (result.is_stock_item && flt(availability) <= 0) {
        errors.push(
          `Row #${d.idx}: Item ${d.item_code} has no stock in warehouse ${d.warehouse}.`,
        );
      } else if (result.is_stock_item && flt(availability) < flt(d.stock_qty)) {
        errors.push(
          `Row #${d.idx}: Item ${d.item_code} in warehouse ${d.warehouse}: Available ${availability.toFixed(2)}, Needed ${d.stock_qty.toFixed(2)}.`,
        );
      }
    }
  }

  return errors;
}

export function calculateChangeAmount(invoice: POSInvoice): ChangeAmountResult {
  const grandTotal = flt(invoice.rounded_total) || flt(invoice.grand_total);
  const baseGrandTotal = flt(invoice.base_rounded_total) || flt(invoice.base_grand_total);

  let changeAmount = flt(invoice.change_amount);
  let baseChangeAmount = flt(invoice.base_change_amount);

  if (!changeAmount && grandTotal < flt(invoice.paid_amount)) {
    changeAmount = flt(invoice.paid_amount - grandTotal + flt(invoice.write_off_amount));
    baseChangeAmount = flt(
      flt(invoice.base_paid_amount) - baseGrandTotal + flt(invoice.base_write_off_amount),
    );
  }

  return { change_amount: changeAmount, base_change_amount: baseChangeAmount };
}

export function setOutstandingAmount(invoice: POSInvoice): OutstandingAmountResult {
  const total = flt(invoice.rounded_total) || flt(invoice.grand_total);
  const outstandingAmount = total > flt(invoice.paid_amount)
    ? total - flt(invoice.paid_amount)
    : 0;
  return { outstanding_amount: outstandingAmount };
}

export function determinePOSInvoiceStatus(
  invoice: POSInvoice,
  hasReturnInvoice?: boolean,
  discountingStatus?: string,
): StatusResult {
  let status: POSInvoiceStatus = "Draft";

  if (invoice.docstatus === 2) {
    status = "Cancelled";
  } else if (invoice.docstatus === 1) {
    if (invoice.consolidated_invoice) {
      status = "Consolidated";
    } else {
      const total = flt(invoice.rounded_total) || flt(invoice.grand_total);
      const outstanding = flt(invoice.outstanding_amount);
      const dueDate = invoice.due_date ? new Date(invoice.due_date) : new Date();
      const today = new Date();

      if (
        outstanding > 0 &&
        dueDate < today &&
        invoice.is_discounted &&
        discountingStatus === "Disbursed"
      ) {
        status = "Overdue and Discounted";
      } else if (outstanding > 0 && dueDate < today) {
        status = "Overdue";
      } else if (
        0 < outstanding &&
        outstanding < total &&
        invoice.is_discounted &&
        discountingStatus === "Disbursed"
      ) {
        status = "Partly Paid and Discounted";
      } else if (0 < outstanding && outstanding < total) {
        status = "Partly Paid";
      } else if (
        outstanding > 0 &&
        dueDate >= today &&
        invoice.is_discounted &&
        discountingStatus === "Disbursed"
      ) {
        status = "Unpaid and Discounted";
      } else if (outstanding > 0 && dueDate >= today) {
        status = "Unpaid";
      } else if (
        outstanding <= 0 &&
        !invoice.is_return &&
        hasReturnInvoice
      ) {
        status = "Credit Note Issued";
      } else if (invoice.is_return) {
        status = "Return";
      } else if (outstanding <= 0) {
        status = "Paid";
      } else {
        status = "Submitted";
      }
    }
  } else {
    status = "Draft";
  }

  return { status };
}

export function checkPhonePayments(
  invoice: POSInvoice,
  paymentRequests: Array<{ mode_of_payment: string; grand_total: number; status: string }>,
): ValidationResult {
  const errors: string[] = [];

  for (const pay of invoice.payments) {
    if (pay.type === "Phone" && pay.amount >= 0) {
      const paidAmt = paymentRequests.find(
        (pr) =>
          pr.mode_of_payment === pay.mode_of_payment &&
          pr.status === "Paid",
      )?.grand_total;

      if (paidAmt !== undefined && pay.amount !== paidAmt) {
        errors.push(`Payment related to ${pay.mode_of_payment} is not completed`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ── Stock Availability Functions ────────────────────────── */

export function getStockAvailability(
  itemCode: string,
  warehouse: string,
  binRecords: BinRecord[],
  reservedQtyRecords: POSReservedQtyResult[],
  isStockItem = false,
  isNegativeStockAllowed = false,
  productBundleItems?: Array<{ item_code: string; qty: number }>,
): StockAvailabilityResult {
  if (isStockItem) {
    const binQty = getBinQty(itemCode, warehouse, binRecords);
    const posSalesQty = getPOSReservedQty(itemCode, warehouse, reservedQtyRecords);
    return {
      availability: binQty - posSalesQty,
      is_stock_item: true,
      is_negative_stock_allowed: isNegativeStockAllowed,
    };
  }

  if (productBundleItems && productBundleItems.length > 0) {
    return getProductBundleStockAvailability(
      itemCode,
      warehouse,
      1,
      binRecords,
      reservedQtyRecords,
      isNegativeStockAllowed,
      productBundleItems,
    );
  }

  return {
    availability: 0,
    is_stock_item: false,
    is_negative_stock_allowed: false,
  };
}

export function getProductBundleStockAvailability(
  itemCode: string,
  warehouse: string,
  itemQty: number,
  binRecords: BinRecord[],
  reservedQtyRecords: POSReservedQtyResult[],
  isNegativeStockAllowed: boolean,
  productBundleItems: Array<{ item_code: string; qty: number }>,
): StockAvailabilityResult {
  const availabilities: Array<{ item_code: string; required: number; available: number }> = [];

  for (const bundleItem of productBundleItems) {
    const binQty = getBinQty(bundleItem.item_code, warehouse, binRecords);
    const reservedQty = getPOSReservedQty(bundleItem.item_code, warehouse, reservedQtyRecords);
    const available = binQty - reservedQty;
    availabilities.push({
      item_code: bundleItem.item_code,
      required: bundleItem.qty * itemQty,
      available,
    });
  }

  return {
    availability: availabilities,
    is_stock_item: true,
    is_negative_stock_allowed: isNegativeStockAllowed,
  };
}

export function getBundleAvailability(
  bundleItemCode: string,
  warehouse: string,
  binRecords: BinRecord[],
  reservedQtyRecords: POSReservedQtyResult[],
  productBundleItems: Array<{ item_code: string; qty: number; is_stock_item: boolean }>,
): number {
  let bundleBinQty = 1000000;

  for (const item of productBundleItems) {
    if (item.is_stock_item) {
      const itemBinQty = getBinQty(item.item_code, warehouse, binRecords);
      const maxAvailableBundles = itemBinQty / item.qty;
      if (bundleBinQty > maxAvailableBundles) {
        bundleBinQty = maxAvailableBundles;
      }
    }
  }

  const posSalesQty = getPOSReservedQty(bundleItemCode, warehouse, reservedQtyRecords);
  return bundleBinQty - posSalesQty;
}

export function getBinQty(
  itemCode: string,
  warehouse: string,
  binRecords: BinRecord[],
): number {
  const record = binRecords.find(
    (b) => b.item_code === itemCode && b.warehouse === warehouse,
  );
  return record ? flt(record.actual_qty) : 0;
}

export function getPOSReservedQty(
  itemCode: string,
  warehouse: string,
  reservedQtyRecords: POSReservedQtyResult[],
): number {
  const pinvReserved = getPOSReservedQtyFromTable(
    itemCode,
    warehouse,
    reservedQtyRecords,
    "POSInvoiceItem",
  );
  const packedReserved = getPOSReservedQtyFromTable(
    itemCode,
    warehouse,
    reservedQtyRecords,
    "PackedItem",
  );
  return pinvReserved + packedReserved;
}

export function getPOSReservedQtyFromTable(
  itemCode: string,
  warehouse: string,
  reservedQtyRecords: POSReservedQtyResult[],
  childTable: "POSInvoiceItem" | "PackedItem",
): number {
  const records = reservedQtyRecords.filter(
    (r) => r.item_code === itemCode && r.warehouse === warehouse,
  );
  return flt(records.reduce((sum, r) => sum + r.reserved_qty, 0));
}

/* ── POS Profile / Payment Setup ─────────────────────────── */

export interface SetPOSFieldsResult {
  pos_profile?: string;
  account_for_change_amount?: string;
  set_warehouse?: string;
  customer?: string;
  currency?: string;
  selling_price_list?: string;
  update_stock?: boolean;
  write_off_account?: string;
  write_off_cost_center?: string;
  apply_discount_on?: string;
  cost_center?: string;
  tax_category?: string;
  ignore_pricing_rule?: boolean;
  company_address?: string;
  letter_head?: string;
  tc_name?: string;
  select_print_heading?: string;
  taxes_and_charges?: string;
}

export function setPOSFields(
  invoice: POSInvoice,
  posProfile?: POSProfile,
  forValidate = false,
): SetPOSFieldsResult {
  const updates: SetPOSFieldsResult = {};

  if (!invoice.pos_profile && posProfile?.name) {
    updates.pos_profile = posProfile.name;
  }

  if (posProfile) {
    updates.account_for_change_amount =
      posProfile.account_for_change_amount || invoice.account_for_change_amount;
    updates.set_warehouse = posProfile.warehouse || invoice.set_warehouse;

    if (!forValidate) {
      updates.currency = posProfile.currency || invoice.currency;
      updates.letter_head = posProfile.letter_head || undefined;
      updates.tc_name = posProfile.tc_name || undefined;
      updates.company_address = posProfile.company_address || undefined;
      updates.select_print_heading = posProfile.select_print_heading || undefined;
      updates.write_off_account = posProfile.write_off_account || undefined;
      updates.taxes_and_charges = posProfile.taxes_and_charges || undefined;
      updates.write_off_cost_center = posProfile.write_off_cost_center || undefined;
      updates.apply_discount_on = posProfile.apply_discount_on || undefined;
      updates.cost_center = posProfile.cost_center || undefined;
      updates.tax_category = posProfile.tax_category || undefined;
      updates.ignore_pricing_rule = posProfile.ignore_pricing_rule ?? undefined;
      updates.update_stock = posProfile.update_stock ?? undefined;
    }

    if (!forValidate && !invoice.customer) {
      updates.customer = posProfile.customer;
    }

    if (invoice.customer) {
      // Customer price list / currency resolution handled by caller
      updates.selling_price_list = posProfile.selling_price_list;
    } else {
      updates.selling_price_list = posProfile.selling_price_list;
    }
  }

  if (!updates.account_for_change_amount) {
    // default_cash_account would be provided by caller
  }

  return updates;
}

export interface PaymentModeInfo {
  mode_of_payment: string;
  default_account?: string;
  type?: string;
  default?: boolean;
}

export function updateMultiModeOption(
  invoice: POSInvoice,
  posProfile?: POSProfile,
): POSInvoicePayment[] {
  if (!posProfile?.payments) return [];

  const payments: POSInvoicePayment[] = [];
  for (const method of posProfile.payments) {
    payments.push({
      idx: payments.length + 1,
      mode_of_payment: method.mode_of_payment,
      account: method.default_account,
      type: method.type,
      default: method.default,
      amount: 0,
    });
  }
  return payments;
}

export function addReturnModes(
  invoice: POSInvoice,
  posProfile?: POSProfile,
): POSInvoicePayment[] {
  if (!posProfile?.payments) return [];

  const existingModes = new Set(invoice.payments.map((p) => p.mode_of_payment));
  const newPayments: POSInvoicePayment[] = [];

  for (const posPaymentMethod of posProfile.payments) {
    if (
      posPaymentMethod.allow_in_returns &&
      !existingModes.has(posPaymentMethod.mode_of_payment)
    ) {
      newPayments.push({
        idx: invoice.payments.length + newPayments.length + 1,
        mode_of_payment: posPaymentMethod.mode_of_payment,
        account: posPaymentMethod.default_account,
        type: posPaymentMethod.type,
        default: posPaymentMethod.default,
        amount: 0,
      });
    }
  }

  return newPayments;
}

/* ── Update Payments on Invoice ──────────────────────────── */

export interface UpdatePaymentsInput {
  mode_of_payment: string;
  amount: number;
}

export interface UpdatePaymentsResult {
  payments: POSInvoicePayment[];
  paid_amount: number;
  base_paid_amount: number;
  outstanding_amount: number;
  change_amount: number;
}

export function updatePaymentsOnInvoice(
  invoice: POSInvoice,
  newPayments: UpdatePaymentsInput[],
): UpdatePaymentsResult {
  let paidAmount = flt(invoice.paid_amount);
  const total = flt(invoice.rounded_total) || flt(invoice.grand_total);

  let idx = invoice.payments.length > 0
    ? Math.max(...invoice.payments.map((p) => p.idx))
    : 0;

  const payments = [...invoice.payments];

  for (const d of newPayments) {
    idx += 1;
    const payment: POSInvoicePayment = {
      idx,
      mode_of_payment: d.mode_of_payment,
      amount: flt(d.amount),
      base_amount: flt(d.amount * (invoice.conversion_rate ?? 1)),
    };
    paidAmount += flt(payment.amount);
    payments.push(payment);
  }

  paidAmount = flt(paidAmount);
  const basePaidAmount = flt(paidAmount * (invoice.conversion_rate ?? 1));
  const outstandingAmount = total > paidAmount ? flt(total - paidAmount) : 0;
  const changeAmount = paidAmount > total ? flt(paidAmount - total) : 0;

  return {
    payments,
    paid_amount: paidAmount,
    base_paid_amount: basePaidAmount,
    outstanding_amount: outstandingAmount,
    change_amount: changeAmount,
  };
}

/* ── Consolidated Sales Invoice Helpers ──────────────────── */

export interface ConsolidatedSalesInvoiceInput {
  items: Array<{
    item_code: string;
    qty: number;
    rate?: number;
    amount?: number;
    pos_invoice?: string;
    pos_invoice_item?: string;
    sales_invoice_item?: string;
  }>;
  taxes?: Array<{
    account_head: string;
    tax_amount?: number;
  }>;
  payments?: Array<{
    mode_of_payment: string;
    amount: number;
  }>;
}

export function buildConsolidatedSalesInvoicePayload(
  invoice: POSInvoice,
  returnAgainstConsolidatedInvoice?: string,
): ConsolidatedSalesInvoiceInput {
  const items = invoice.items.map((d) => ({
    item_code: d.item_code,
    qty: d.qty,
    rate: d.rate,
    amount: d.amount,
    pos_invoice: invoice.name,
    pos_invoice_item: d.pos_invoice_item ?? undefined,
    sales_invoice_item: undefined as string | undefined,
  }));

  const taxes = (invoice.taxes ?? []).map((d) => ({
    account_head: d.account_head,
    tax_amount: d.tax_amount_after_discount_amount,
  }));

  const payments = invoice.payments.map((d) => ({
    mode_of_payment: d.mode_of_payment,
    amount: d.amount,
  }));

  return {
    items,
    taxes,
    payments,
  };
}

/* ── Loyalty helpers ─────────────────────────────────────── */

export interface LoyaltyValidationInput {
  loyalty_program?: string;
  loyalty_points?: number;
  redeem_loyalty_points?: boolean;
  loyalty_redemption_account?: string;
  loyalty_redemption_cost_center?: string;
  expense_account?: string;
  cost_center?: string;
}

export function validateLoyaltyTransaction(
  input: LoyaltyValidationInput,
): ValidationResult {
  const errors: string[] = [];

  if (input.redeem_loyalty_points) {
    if (!input.loyalty_redemption_account && !input.expense_account) {
      errors.push("Loyalty Redemption Account is required.");
    }
    if (!input.loyalty_redemption_cost_center && !input.cost_center) {
      errors.push("Loyalty Redemption Cost Center is required.");
    }
  }

  if (
    input.redeem_loyalty_points &&
    input.loyalty_program &&
    input.loyalty_points &&
    input.loyalty_points <= 0
  ) {
    errors.push("Loyalty points must be greater than zero.");
  }

  return { valid: errors.length === 0, errors };
}

/* ── Clear unallocated payments ──────────────────────────── */

export function clearUnallocatedPayments(
  payments: POSInvoicePayment[],
): POSInvoicePayment[] {
  return payments.filter((p) => flt(p.amount) !== 0);
}

/* ── Item query helpers ──────────────────────────────────── */

export function getItemGroupsForPOSProfile(
  posProfileItemGroups?: Array<{ item_group: string }>,
  itemGroupDescendants?: Record<string, string[]>,
): string[] {
  const itemGroups: string[] = [];
  if (!posProfileItemGroups) return itemGroups;

  for (const row of posProfileItemGroups) {
    itemGroups.push(row.item_group);
    const descendants = itemGroupDescendants?.[row.item_group] ?? [];
    itemGroups.push(...descendants);
  }

  return Array.from(new Set(itemGroups));
}
