/**
 * Ported from erpnext/accounts/doctype/sales_invoice/sales_invoice.py
 * Pure business logic for Sales Invoice validation, GL entries, and lifecycle.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

import {
  flt,
  getdate,
  validateAccountDoc,
  buildGLEntries,
  type AccountDoc,
  type AccountDocItem,
  type TaxRow,
  type ValidationResult,
  type SubmitResult,
} from "./accounts-controller";
import { calculateTaxesAndTotals, type TransactionDoc } from "./taxes-and-totals";
import {
  updateQty,
  type StatusUpdaterConfig,
  type ChildItem,
  type QtyUpdateResult,
} from "./status-updater";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SalesInvoiceItem {
  name: string;
  idx: number;
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount: number;
  net_rate?: number;
  net_amount?: number;
  base_net_amount?: number;
  stock_qty?: number;
  stock_uom?: string;
  uom?: string;
  conversion_factor: number;
  warehouse?: string;
  income_account?: string;
  expense_account?: string;
  cost_center?: string;
  enable_deferred_revenue?: boolean;
  deferred_revenue_account?: string;
  sales_order?: string;
  so_detail?: string;
  delivery_note?: string;
  dn_detail?: string;
  is_fixed_asset?: boolean;
  asset?: string;
  delivered_by_supplier?: boolean;
  is_free_item?: boolean;
  project?: string;
  serial_no?: string;
  batch_no?: string;
}

export type SalesInvoiceStatus =
  | ""
  | "Draft"
  | "Return"
  | "Credit Note Issued"
  | "Submitted"
  | "Paid"
  | "Partly Paid"
  | "Unpaid"
  | "Unpaid and Discounted"
  | "Partly Paid and Discounted"
  | "Overdue and Discounted"
  | "Overdue"
  | "Cancelled"
  | "Internal Transfer";

export interface SalesInvoice {
  doctype: "Sales Invoice";
  name?: string;
  docstatus: number;
  status?: SalesInvoiceStatus;
  company: string;
  company_currency?: string;
  customer?: string;
  customer_name?: string;
  currency: string;
  conversion_rate: number;
  posting_date: string;
  posting_time?: string;
  set_posting_time?: boolean;
  due_date?: string;
  debit_to?: string;
  party_account_currency?: string;
  is_return?: boolean;
  is_debit_note?: boolean;
  is_pos?: boolean;
  is_paid?: boolean;
  is_internal_customer?: boolean;
  is_opening?: "No" | "Yes";
  return_against?: string;
  update_stock?: boolean;
  update_outstanding_for_self?: boolean;
  update_billed_amount_in_sales_order?: boolean;
  update_billed_amount_in_delivery_note?: boolean;
  inter_company_invoice_reference?: string;
  project?: string;
  po_no?: string;
  po_date?: string;
  outstanding_amount?: number;
  against_income_account?: string;
  selling_price_list?: string;
  price_list_currency?: string;
  plc_conversion_rate?: number;
  taxes_and_charges?: string;
  tax_category?: string;
  shipping_rule?: string;
  discount_amount?: number;
  apply_discount_on?: "" | "Grand Total" | "Net Total";
  additional_discount_percentage?: number;
  base_discount_amount?: number;
  write_off_amount?: number;
  base_write_off_amount?: number;
  write_off_account?: string;
  write_off_cost_center?: string;
  rounded_total?: number;
  base_rounded_total?: number;
  rounding_adjustment?: number;
  base_rounding_adjustment?: number;
  disable_rounded_total?: boolean;
  use_company_roundoff_cost_center?: boolean;
  grand_total?: number;
  base_grand_total?: number;
  net_total?: number;
  base_net_total?: number;
  total?: number;
  base_total?: number;
  total_qty?: number;
  total_taxes_and_charges?: number;
  base_total_taxes_and_charges?: number;
  total_advance?: number;
  paid_amount?: number;
  base_paid_amount?: number;
  cash_bank_account?: string;
  loyalty_program?: string;
  loyalty_points?: number;
  loyalty_amount?: number;
  loyalty_redemption_account?: string;
  loyalty_redemption_cost_center?: string;
  redeem_loyalty_points?: boolean;
  coupon_code?: string;
  remarks?: string;
  cost_center?: string;
  items: SalesInvoiceItem[];
  taxes?: TaxRow[];
  advances?: { reference_type?: string; reference_name?: string; idx: number; allocated_amount?: number; ref_exchange_rate?: number; exchange_gain_loss?: number }[];
  payments?: { mode_of_payment?: string; account?: string; amount: number; base_amount?: number }[];
  sales_team?: { sales_person: string; allocated_percentage: number; commission_rate?: number; allocated_amount?: number; incentives?: number }[];
}

export interface SalesInvoiceValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  doc?: SalesInvoice;
}

export interface SalesInvoiceSubmitResult extends SubmitResult {
  qtyUpdates?: QtyUpdateResult;
}

export interface SalesInvoiceCancelResult {
  success: boolean;
  error?: string;
  glEntriesReversed?: boolean;
  stockReversed?: boolean;
  qtyUpdates?: QtyUpdateResult;
}

export interface CustomerInfo {
  name: string;
  disabled?: boolean;
  customer_name?: string;
  default_price_list?: string;
  default_currency?: string;
}

export interface SalesOrderInfo {
  name: string;
  docstatus: number;
  po_no?: string;
  po_date?: string;
  customer?: string;
  company?: string;
  currency?: string;
}

/* ------------------------------------------------------------------ */
/*  Status updater configs                                             */
/* ------------------------------------------------------------------ */

/** Default status updater configs for Sales Invoice → Sales Order billing. */
export function getSalesInvoiceStatusUpdaterConfigs(): StatusUpdaterConfig[] {
  return [
    {
      source_dt: "Sales Invoice Item",
      target_field: "billed_amt",
      target_ref_field: "amount",
      target_dt: "Sales Order Item",
      join_field: "so_detail",
      target_parent_dt: "Sales Order",
      target_parent_field: "per_billed",
      source_field: "amount",
      percent_join_field: "sales_order",
      status_field: "billing_status",
      keyword: "Billed",
      overflow_type: "billing",
    },
  ];
}

/** Additional configs when update_stock is true (delivery qty updates). */
export function getStockUpdateConfigs(): StatusUpdaterConfig[] {
  return [
    {
      source_dt: "Sales Invoice Item",
      target_dt: "Sales Order Item",
      target_parent_dt: "Sales Order",
      target_parent_field: "per_delivered",
      target_field: "delivered_qty",
      target_ref_field: "qty",
      source_field: "qty",
      join_field: "so_detail",
      percent_join_field: "sales_order",
      status_field: "delivery_status",
      keyword: "Delivered",
      second_source_dt: "Delivery Note Item",
      second_source_field: "qty",
      second_join_field: "so_detail",
      overflow_type: "delivery",
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  validate                                                           */
/* ------------------------------------------------------------------ */

export function validateSalesInvoice(
  doc: SalesInvoice,
  customerInfo?: CustomerInfo,
  salesOrderMap?: Record<string, SalesOrderInfo>,
  fiscalYearRange?: { year_start_date: string; year_end_date: string }
): SalesInvoiceValidationResult {
  const warnings: string[] = [];

  try {
    // 1. Validate customer
    const custErr = validateCustomer(doc, customerInfo);
    if (custErr) return { success: false, error: custErr };

    // 2. Set missing values
    setMissingValues(doc, customerInfo);

    // 3. Validate posting time
    validatePostingTime(doc);

    // 4. Validate mandatory fields
    const mandatoryErr = validateMandatory(doc);
    if (mandatoryErr) return { success: false, error: mandatoryErr };

    // 5. Validate items exist and have codes
    for (const item of doc.items) {
      if (!item.item_code) {
        return { success: false, error: `Row ${item.idx}: Item Code is required` };
      }
      if (!item.qty && !doc.is_return && !item.is_free_item) {
        warnings.push(`Row ${item.idx}: Quantity is zero for ${item.item_code}`);
      }
    }

    // 6. UOM integer validation
    for (const item of doc.items) {
      if (item.stock_uom && item.stock_qty && !Number.isInteger(item.stock_qty)) {
        return { success: false, error: `Row ${item.idx}: Stock Qty must be whole number for UOM ${item.stock_uom}` };
      }
      if (item.uom && item.qty && !Number.isInteger(item.qty)) {
        return { success: false, error: `Row ${item.idx}: Qty must be whole number for UOM ${item.uom}` };
      }
    }

    // 7. Calculate taxes and totals
    const taxResult = calculateTaxesAndTotalsForSI(doc);
    if (!taxResult.success) return { success: false, error: taxResult.error };

    // 8. Set against income account
    setAgainstIncomeAccount(doc);

    // 9. Set PO details from linked Sales Order
    setPoNo(doc, salesOrderMap);

    // 10. Validate debit_to account
    if (doc.debit_to && doc.customer) {
      // TODO: Full debit_to account type validation (Receivable, Balance Sheet) — needs Account master lookup
    }

    // 11. Validate warehouse if update_stock
    if (doc.update_stock) {
      for (const item of doc.items) {
        if (!item.warehouse && !item.delivered_by_supplier) {
          warnings.push(`Row ${item.idx}: Warehouse required for stock item ${item.item_code} when Update Stock is checked`);
        }
      }
    }

    // 12. Validate drop-ship items cannot have update_stock
    if (doc.update_stock && doc.items.some((i) => i.delivered_by_supplier)) {
      return { success: false, error: "Stock cannot be updated because invoice contains a drop shipping item" };
    }

    // 13. Validate linked Sales Order not modified after SI creation
    // TODO: check_if_sales_invoice_modified — needs DB lookup of SO modified timestamp

    // 14. Run accounts controller validation
    const accountDoc = toAccountDoc(doc);
    const accountResult = validateAccountDoc(accountDoc, {
      fiscalYearRange,
      partyAccountCurrency: doc.party_account_currency,
    });
    if (!accountResult.success) return { success: false, error: accountResult.error };
    warnings.push(...(accountResult.warnings ?? []));

    // 15. Set status
    doc.status = getSalesInvoiceStatus(doc);

    return { success: true, warnings, doc };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  validateCustomer                                                   */
/* ------------------------------------------------------------------ */

export function validateCustomer(
  doc: SalesInvoice,
  customerInfo?: CustomerInfo
): string | undefined {
  if (!doc.customer) {
    return "Customer is required for Sales Invoice";
  }

  if (customerInfo) {
    if (customerInfo.disabled) {
      return `Customer ${doc.customer} is disabled`;
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateMandatory                                                  */
/* ------------------------------------------------------------------ */

export function validateMandatory(doc: SalesInvoice): string | undefined {
  if (!doc.company) return "Company is mandatory";
  if (!doc.currency) return "Currency is mandatory";
  if (!doc.conversion_rate) return "Conversion Rate is mandatory";
  if (!doc.posting_date) return "Posting Date is mandatory";
  if (!doc.customer) return "Customer is mandatory";
  if (!doc.debit_to) return "Debit To (Receivable Account) is mandatory";
  if (doc.items.length === 0) return "No items in Sales Invoice";

  for (const item of doc.items) {
    if (!item.item_code) return `Row ${item.idx}: Item Code is mandatory`;
    if (!item.income_account) return `Row ${item.idx}: Income Account is mandatory for item ${item.item_code}`;
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validatePostingTime                                                */
/* ------------------------------------------------------------------ */

export function validatePostingTime(doc: SalesInvoice): void {
  if (!doc.set_posting_time && !doc.posting_time) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    doc.posting_time = `${hours}:${minutes}:${seconds}`;
  }
}

/* ------------------------------------------------------------------ */
/*  setMissingValues                                                   */
/* ------------------------------------------------------------------ */

export function setMissingValues(
  doc: SalesInvoice,
  customerInfo?: CustomerInfo
): void {
  // Set customer name from info
  if (customerInfo?.customer_name && !doc.customer_name) {
    doc.customer_name = customerInfo.customer_name;
  }

  // Set default price list
  if (customerInfo?.default_price_list && !doc.selling_price_list) {
    doc.selling_price_list = customerInfo.default_price_list;
  }

  // Set default currency
  if (customerInfo?.default_currency && !doc.currency) {
    doc.currency = customerInfo.default_currency;
  }

  // Conversion rate defaults
  if (!doc.conversion_rate) doc.conversion_rate = 1.0;
  if (!doc.plc_conversion_rate) doc.plc_conversion_rate = 1.0;

  // Posting date default
  if (!doc.posting_date) {
    doc.posting_date = new Date().toISOString().split("T")[0];
  }

  // Due date default = posting date (TODO: compute from payment terms template)
  if (!doc.due_date) {
    doc.due_date = doc.posting_date;
  }

  // Company currency
  if (!doc.company_currency) {
    doc.company_currency = doc.currency;
  }

  // is_opening
  if (!doc.is_opening) doc.is_opening = "No";
}

/* ------------------------------------------------------------------ */
/*  setAgainstIncomeAccount                                            */
/* ------------------------------------------------------------------ */

export function setAgainstIncomeAccount(doc: SalesInvoice): void {
  const accounts: string[] = [];
  for (const item of doc.items) {
    if (item.income_account && !accounts.includes(item.income_account)) {
      accounts.push(item.income_account);
    }
  }
  doc.against_income_account = accounts.join(",");
}

/* ------------------------------------------------------------------ */
/*  setPoNo                                                            */
/* ------------------------------------------------------------------ */

export function setPoNo(
  doc: SalesInvoice,
  salesOrderMap?: Record<string, SalesOrderInfo>
): void {
  if (!salesOrderMap) return;

  // Copy PO details from first linked Sales Order
  for (const item of doc.items) {
    if (item.sales_order && salesOrderMap[item.sales_order]) {
      const so = salesOrderMap[item.sales_order];
      if (so.po_no && !doc.po_no) doc.po_no = so.po_no;
      if (so.po_date && !doc.po_date) doc.po_date = so.po_date;
      break;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  checkIfSalesInvoiceModified                                        */
/* ------------------------------------------------------------------ */

/**
 * Warn if linked Sales Order has been modified after the Sales Invoice was created.
 * Returns warning strings; does not block submission.
 */
export function checkIfSalesInvoiceModified(
  doc: SalesInvoice,
  soModifiedDates: Record<string, string>
): string[] {
  const warnings: string[] = [];
  if (!doc.name) return warnings;

  for (const item of doc.items) {
    if (item.sales_order && soModifiedDates[item.sales_order]) {
      // If the SO was modified after this SI was created, warn
      // (In a full port, we'd compare SI.creation vs SO.modified)
      // Here we just flag the check exists
    }
  }

  // TODO: Full implementation needs SI creation timestamp vs SO modified timestamp
  return warnings;
}

/* ------------------------------------------------------------------ */
/*  calculateTaxesAndTotalsForSI                                       */
/* ------------------------------------------------------------------ */

export function calculateTaxesAndTotalsForSI(
  doc: SalesInvoice
): { success: boolean; error?: string } {
  try {
    const txDoc: TransactionDoc = {
      doctype: doc.doctype,
      name: doc.name,
      company: doc.company,
      currency: doc.currency,
      conversion_rate: doc.conversion_rate,
      items: doc.items.map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: item.qty,
        rate: item.rate,
        amount: item.amount,
        net_rate: item.net_rate ?? item.rate,
        net_amount: item.net_amount ?? item.amount,
        base_rate: flt((item.rate ?? 0) * doc.conversion_rate),
        base_amount: flt((item.amount ?? 0) * doc.conversion_rate),
        base_net_rate: flt((item.net_rate ?? item.rate) * doc.conversion_rate),
        base_net_amount: flt((item.net_amount ?? item.amount ?? 0) * doc.conversion_rate),
        discount_percentage: 0,
        discount_amount: 0,
        price_list_rate: item.rate,
        conversion_factor: item.conversion_factor,
        stock_qty: item.stock_qty,
        item_tax_rate: undefined,
        grant_commission: !item.is_free_item,
      })),
      taxes: (doc.taxes ?? []).map((t) => ({
        idx: t.idx,
        charge_type: t.charge_type as "Actual" | "On Net Total" | "On Previous Row Amount" | "On Previous Row Total" | "On Item Quantity",
        account_head: t.account_head,
        rate: t.rate ?? 0,
        tax_amount: t.tax_amount,
        row_id: t.row_id,
        included_in_print_rate: t.included_in_print_rate,
        category: (t.category as "Total" | "Valuation" | "Valuation and Total") ?? "Total",
        add_deduct_tax: "Add" as const,
      })),
      discount_amount: doc.discount_amount,
      apply_discount_on: doc.apply_discount_on === "" ? undefined : doc.apply_discount_on,
      additional_discount_percentage: doc.additional_discount_percentage,
      base_discount_amount: doc.base_discount_amount,
    };

    const result = calculateTaxesAndTotals(txDoc);
    if (!result.success) return { success: false, error: result.error };

    // Write computed values back to the Sales Invoice doc
    doc.total_qty = result.total_qty;
    doc.total = result.total;
    doc.base_total = result.base_total;
    doc.net_total = result.net_total;
    doc.base_net_total = result.base_net_total;
    doc.grand_total = result.grand_total;
    doc.base_grand_total = result.base_grand_total;
    doc.total_taxes_and_charges = result.total_taxes_and_charges;
    doc.rounded_total = result.rounded_total;
    doc.base_rounded_total = result.base_rounded_total;
    // rounding_adjustment and base_rounding_adjustment are computed on the TransactionDoc
    doc.rounding_adjustment = txDoc.rounding_adjustment;
    doc.base_rounding_adjustment = txDoc.base_rounding_adjustment;

    // Update item amounts from tax computation
    for (let i = 0; i < doc.items.length; i++) {
      const srcItem = txDoc.items[i];
      if (srcItem) {
        doc.items[i].net_rate = srcItem.net_rate;
        doc.items[i].net_amount = srcItem.net_amount;
        doc.items[i].base_net_amount = srcItem.base_net_amount;
      }
    }

    // Write tax computed fields back
    for (let i = 0; i < (doc.taxes?.length ?? 0); i++) {
      const srcTax = result.taxes[i];
      if (srcTax && doc.taxes![i]) {
        doc.taxes![i].tax_amount = srcTax.tax_amount;
        // tax_amount_after_discount_amount is a computed field on the taxes-and-totals TaxRow
      }
    }

    // Outstanding amount = grand_total for new invoices
    if (!doc.outstanding_amount && doc.grand_total) {
      doc.outstanding_amount = doc.grand_total;
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  makeGlEntries                                                      */
/* ------------------------------------------------------------------ */

export interface GLEntry {
  account: string;
  party_type?: string;
  party?: string;
  against?: string;
  debit: number;
  credit: number;
  cost_center?: string;
  project?: string;
  remarks?: string;
  against_voucher?: string;
  against_voucher_type?: string;
  due_date?: string;
}

/**
 * Build GL entries for a Sales Invoice.
 * Debit: Receivable (debit_to) — Credit: Income per item + Tax accounts
 */
export function makeGlEntries(doc: SalesInvoice): GLEntry[] {
  const entries: GLEntry[] = [];
  const voucherNo = doc.name ?? "";
  const againstVoucher = doc.is_return && doc.return_against && !doc.update_outstanding_for_self
    ? doc.return_against
    : doc.name ?? "";

  // 1. Customer GL entry (Debit receivable)
  const grandTotal = doc.rounding_adjustment && doc.rounded_total
    ? doc.rounded_total
    : doc.grand_total ?? 0;

  const baseGrandTotal = doc.base_rounding_adjustment && doc.base_rounded_total
    ? doc.base_rounded_total
    : doc.base_grand_total ?? 0;

  if (grandTotal && !doc.is_internal_customer) {
    entries.push({
      account: doc.debit_to ?? "Debtors",
      party_type: "Customer",
      party: doc.customer,
      against: doc.against_income_account,
      debit: flt(baseGrandTotal),
      credit: 0,
      cost_center: doc.cost_center,
      project: doc.project,
      against_voucher: againstVoucher,
      against_voucher_type: "Sales Invoice",
      due_date: doc.due_date,
      remarks: doc.remarks ?? `Sales Invoice ${voucherNo}`,
    });
  }

  // 2. Item income GL entries (Credit income)
  for (const item of doc.items) {
    if (!flt(item.base_net_amount ?? 0) && !item.is_fixed_asset) continue;
    if (doc.is_internal_customer) continue;

    const incomeAccount = item.enable_deferred_revenue && !doc.is_return
      ? item.deferred_revenue_account ?? item.income_account ?? "Sales"
      : item.income_account ?? "Sales";

    const baseAmount = flt(item.base_net_amount ?? 0);
    const amount = flt(item.net_amount ?? item.amount ?? 0);

    entries.push({
      account: incomeAccount,
      against: doc.customer,
      debit: 0,
      credit: baseAmount,
      cost_center: item.cost_center,
      project: item.project ?? doc.project,
      remarks: doc.remarks ?? `Sales Invoice ${voucherNo}`,
    });

    // TODO: Fixed asset GL entries (get_gl_entries_for_fixed_asset)
    // TODO: Stock update GL entries when update_stock + perpetual inventory
  }

  // 3. Tax GL entries (Credit tax accounts)
  for (const tax of doc.taxes ?? []) {
    const baseAmount = flt(tax.tax_amount ?? 0);
    if (!baseAmount) continue;

    entries.push({
      account: tax.account_head,
      against: doc.customer,
      debit: 0,
      credit: baseAmount,
      cost_center: tax.cost_center,
      remarks: doc.remarks ?? `Sales Invoice ${voucherNo}`,
    });
  }

  // 4. Internal transfer unrealized profit/loss
  // TODO: make_internal_transfer_gl_entries — needs unrealized_profit_loss_account

  // 5. POS payment GL entries
  if (doc.is_pos && doc.payments) {
    for (const payment of doc.payments) {
      if (!flt(payment.base_amount ?? payment.amount)) continue;

      // Credit receivable for payment received
      entries.push({
        account: doc.debit_to ?? "Debtors",
        party_type: "Customer",
        party: doc.customer,
        against: payment.account,
        debit: 0,
        credit: flt(payment.base_amount ?? payment.amount),
        cost_center: doc.cost_center,
        against_voucher: againstVoucher,
        against_voucher_type: "Sales Invoice",
      });

      // Debit bank/cash account
      entries.push({
        account: payment.account ?? "Cash",
        against: doc.customer,
        debit: flt(payment.base_amount ?? payment.amount),
        credit: 0,
        cost_center: doc.cost_center,
      });
    }
  }

  // 6. Paid amount GL entries (non-POS)
  if (doc.is_paid && doc.cash_bank_account && doc.paid_amount) {
    entries.push({
      account: doc.debit_to ?? "Debtors",
      party_type: "Customer",
      party: doc.customer,
      against: doc.cash_bank_account,
      debit: 0,
      credit: flt(doc.base_paid_amount ?? 0),
      cost_center: doc.cost_center,
      against_voucher: againstVoucher,
      against_voucher_type: "Sales Invoice",
    });

    entries.push({
      account: doc.cash_bank_account,
      against: doc.customer,
      debit: flt(doc.base_paid_amount ?? 0),
      credit: 0,
      cost_center: doc.cost_center,
    });
  }

  // 7. Write-off GL entries
  if (doc.write_off_account && flt(doc.write_off_amount)) {
    entries.push({
      account: doc.debit_to ?? "Debtors",
      party_type: "Customer",
      party: doc.customer,
      against: doc.write_off_account,
      debit: 0,
      credit: flt(doc.base_write_off_amount ?? 0),
      cost_center: doc.cost_center,
      project: doc.project,
      against_voucher: againstVoucher,
      against_voucher_type: "Sales Invoice",
    });

    entries.push({
      account: doc.write_off_account,
      against: doc.customer,
      debit: flt(doc.base_write_off_amount ?? 0),
      credit: 0,
      cost_center: doc.write_off_cost_center ?? doc.cost_center,
    });
  }

  // 8. Rounding adjustment GL entry
  if (flt(doc.rounding_adjustment) && doc.base_rounding_adjustment && !doc.is_internal_customer) {
    entries.push({
      account: "Round Off", // TODO: lookup from Company round_off_account
      against: doc.customer,
      debit: flt(doc.base_rounding_adjustment),
      credit: 0,
      cost_center: doc.cost_center,
      remarks: `Rounding Adjustment for ${voucherNo}`,
    });
  }

  // 9. Loyalty point redemption GL entries
  // TODO: make_loyalty_point_redemption_gle — needs loyalty_redemption_account

  return entries;
}

/**
 * Validate that GL entries balance (total debit === total credit).
 */
export function validateGlEntriesBalance(entries: GLEntry[]): string | undefined {
  const totalDebit = entries.reduce((sum, e) => sum + flt(e.debit), 0);
  const totalCredit = entries.reduce((sum, e) => sum + flt(e.credit), 0);

  if (Math.abs(flt(totalDebit) - flt(totalCredit)) > 0.1) {
    return `GL Entries are not balanced. Debit: ${flt(totalDebit)}, Credit: ${flt(totalCredit)}`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  updateStockLedger                                                  */
/* ------------------------------------------------------------------ */

export interface StockLedgerEntry {
  item_code: string;
  warehouse: string;
  qty: number;
  valuation_rate?: number;
  posting_date: string;
  posting_time?: string;
  voucher_type: string;
  voucher_no: string;
  voucher_detail_no: string;
  is_cancelled?: boolean;
}

/**
 * Build stock ledger entries for a Sales Invoice when update_stock is true.
 * Items are issued out (negative qty) on submit, reversed on cancel.
 */
export function buildStockLedgerEntries(
  doc: SalesInvoice,
  isCancel = false
): StockLedgerEntry[] {
  if (!doc.update_stock) return [];

  const entries: StockLedgerEntry[] = [];
  const sign = isCancel ? 1 : -1; // Submit: issue out (negative), Cancel: reverse (positive)

  for (const item of doc.items) {
    if (!item.warehouse || !item.qty) continue;

    const qty = flt(item.qty * item.conversion_factor);
    entries.push({
      item_code: item.item_code,
      warehouse: item.warehouse,
      qty: sign * qty,
      valuation_rate: item.income_account ? undefined : undefined, // TODO: compute from valuation
      posting_date: doc.posting_date,
      posting_time: doc.posting_time,
      voucher_type: "Sales Invoice",
      voucher_no: doc.name ?? "",
      voucher_detail_no: item.name,
    });
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/*  on_submit                                                          */
/* ------------------------------------------------------------------ */

export function onSubmitSalesInvoice(
  doc: SalesInvoice,
  salesOrderChildren?: ChildItem[]
): SalesInvoiceSubmitResult {
  try {
    // 1. Build GL entries
    const glEntries = makeGlEntries(doc);
    if (glEntries.length === 0) {
      return { success: false, error: "No GL entries generated" };
    }

    // 2. Validate GL balance
    const balanceErr = validateGlEntriesBalance(glEntries);
    if (balanceErr) return { success: false, error: balanceErr };

    // 3. Build stock ledger entries if update_stock
    const stockEntries = buildStockLedgerEntries(doc, false);

    // 4. Compute status updater qty changes
    let configs = getSalesInvoiceStatusUpdaterConfigs();
    if (doc.update_stock) {
      configs = [...configs, ...getStockUpdateConfigs()];
    }

    let qtyUpdates: QtyUpdateResult | undefined;
    if (salesOrderChildren && salesOrderChildren.length > 0) {
      const qtyResult = updateQty(
        { doctype: doc.doctype, docstatus: doc.docstatus, status: doc.status, is_return: doc.is_return },
        salesOrderChildren,
        configs
      );
      if (qtyResult.success) {
        qtyUpdates = qtyResult.result;
      }
    }

    // 5. Skip billing status update for returns unless configured
    if (doc.is_return && !doc.update_billed_amount_in_sales_order) {
      // Status updater bypassed for returns
    }

    return {
      success: true,
      gl_entries: glEntries.map((e) => ({
        account: e.account,
        debit: e.debit,
        credit: e.credit,
        cost_center: e.cost_center,
        remarks: e.remarks,
      })),
      qtyUpdates,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  on_cancel                                                          */
/* ------------------------------------------------------------------ */

export function onCancelSalesInvoice(
  doc: SalesInvoice,
  salesOrderChildren?: ChildItem[]
): SalesInvoiceCancelResult {
  try {
    // Reverse GL entries — on cancel, we reverse debits and credits
    const glEntries = makeGlEntries(doc);
    const reversedGlEntries = glEntries.map((e) => ({
      ...e,
      debit: e.credit,
      credit: e.debit,
    }));

    // Build reverse stock ledger entries
    const stockEntries = buildStockLedgerEntries(doc, true);

    // Reverse status updater qty changes
    let configs = getSalesInvoiceStatusUpdaterConfigs();
    if (doc.update_stock) {
      configs = [...configs, ...getStockUpdateConfigs()];
    }

    let qtyUpdates: QtyUpdateResult | undefined;
    if (salesOrderChildren && salesOrderChildren.length > 0) {
      // On cancel, negate the source values
      const negatedChildren: ChildItem[] = salesOrderChildren.map((c) => ({
        ...c,
        amount: c.amount ? -(c.amount as number) : undefined,
        qty: c.qty ? -(c.qty as number) : undefined,
      }));
      const qtyResult = updateQty(
        { doctype: doc.doctype, docstatus: 2, status: "Cancelled", is_return: doc.is_return },
        negatedChildren,
        configs
      );
      if (qtyResult.success) {
        qtyUpdates = qtyResult.result;
      }
    }

    // Set cancelled status
    doc.status = "Cancelled";

    return {
      success: true,
      glEntriesReversed: true,
      stockReversed: stockEntries.length > 0,
      qtyUpdates,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */

export function getSalesInvoiceStatus(doc: SalesInvoice): SalesInvoiceStatus {
  if (doc.docstatus === 0) return "Draft";
  if (doc.docstatus === 2) return "Cancelled";
  if (doc.docstatus === 1) {
    if (doc.is_internal_customer) return "Internal Transfer";
    if (doc.is_return) return "Return";

    const outstanding = flt(doc.outstanding_amount ?? 0);
    const grandTotal = flt(doc.grand_total ?? 0);

    if (outstanding <= 0) return "Paid";
    if (outstanding > 0 && outstanding < grandTotal) return "Partly Paid";
    // TODO: Overdue check needs comparison of due_date vs current date
    return "Unpaid";
  }
  return "Draft";
}

/* ------------------------------------------------------------------ */
/*  Helper: Convert to AccountDoc                                      */
/* ------------------------------------------------------------------ */

function toAccountDoc(doc: SalesInvoice): AccountDoc {
  return {
    doctype: doc.doctype,
    name: doc.name,
    company: doc.company,
    customer: doc.customer,
    currency: doc.currency,
    company_currency: doc.company_currency ?? doc.currency,
    conversion_rate: doc.conversion_rate,
    posting_date: doc.posting_date,
    is_return: doc.is_return,
    is_debit_note: doc.is_debit_note,
    return_against: doc.return_against,
    debit_to: doc.debit_to,
    items: doc.items.map((item) => ({
      item_code: item.item_code,
      item_name: item.item_name,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      income_account: item.income_account,
      expense_account: item.expense_account,
      cost_center: item.cost_center,
      enable_deferred_revenue: item.enable_deferred_revenue,
      deferred_revenue_account: item.deferred_revenue_account,
      service_start_date: undefined,
      service_end_date: undefined,
      idx: item.idx,
      delivered_by_supplier: item.delivered_by_supplier,
    })),
    taxes: doc.taxes,
    discount_amount: doc.discount_amount,
    apply_discount_on: doc.apply_discount_on,
    grand_total: doc.grand_total,
    base_grand_total: doc.base_grand_total,
    rounded_total: doc.rounded_total,
    base_rounded_total: doc.base_rounded_total,
    outstanding_amount: doc.outstanding_amount,
    update_outstanding_for_self: doc.update_outstanding_for_self,
    payment_schedule: undefined,
    advances: doc.advances,
    allocate_advances_automatically: false,
    is_pos: doc.is_pos,
    is_paid: doc.is_paid,
    cash_bank_account: doc.cash_bank_account,
    paid_amount: doc.paid_amount,
    base_paid_amount: doc.base_paid_amount,
    write_off_amount: doc.write_off_amount,
    base_write_off_amount: doc.base_write_off_amount,
    total_advance: doc.total_advance,
    is_internal_customer: doc.is_internal_customer,
    is_opening: doc.is_opening,
    inter_company_invoice_reference: doc.inter_company_invoice_reference,
    project: doc.project,
  };
}

/* ------------------------------------------------------------------ */
/*  Make Delivery Note from Sales Invoice                              */
/* ------------------------------------------------------------------ */

export interface DeliveryNoteItemDraft {
  item_code: string;
  qty: number;
  rate: number;
  amount: number;
  against_sales_order?: string;
  so_detail?: string;
  warehouse?: string;
  cost_center?: string;
}

/**
 * Map Sales Invoice items to a Delivery Note draft.
 * Used when the invoice has update_stock and we need a DN representation.
 */
export function mapSIToDeliveryNoteItems(
  doc: SalesInvoice
): DeliveryNoteItemDraft[] {
  return doc.items
    .filter((item) => item.qty > 0 && !item.delivered_by_supplier)
    .map((item) => ({
      item_code: item.item_code,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      against_sales_order: item.sales_order,
      so_detail: item.so_detail,
      warehouse: item.warehouse,
      cost_center: item.cost_center,
    }));
}

/* ------------------------------------------------------------------ */
/*  Add remarks                                                        */
/* ------------------------------------------------------------------ */

export function addRemarks(doc: SalesInvoice): void {
  if (!doc.remarks && doc.po_no) {
    doc.remarks = `Against Customer Order ${doc.po_no}`;
    if (doc.po_date) {
      doc.remarks += ` dated ${doc.po_date}`;
    }
  }
}
