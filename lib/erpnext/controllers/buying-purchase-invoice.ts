/**
 * Ported from erpnext/accounts/doctype/purchase_invoice/purchase_invoice.py
 * Pure business logic for Purchase Invoice validation, GL entries, and lifecycle.
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

export interface PurchaseInvoiceItem {
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
  from_warehouse?: string;
  rejected_warehouse?: string;
  expense_account?: string;
  income_account?: string;
  cost_center?: string;
  enable_deferred_expense?: boolean;
  deferred_expense_account?: string;
  purchase_order?: string;
  po_detail?: string;
  purchase_receipt?: string;
  pr_detail?: string;
  is_fixed_asset?: boolean;
  asset?: string;
  asset_category?: string;
  received_qty?: number;
  rejected_qty?: number;
  valuation_rate?: number;
  rm_supp_cost?: number;
  landed_cost_voucher_amount?: number;
  item_tax_amount?: number;
  project?: string;
  is_free_item?: boolean;
  serial_no?: string;
  batch_no?: string;
}

export type PurchaseInvoiceStatus =
  | ""
  | "Draft"
  | "Return"
  | "Debit Note Issued"
  | "Submitted"
  | "Paid"
  | "Partly Paid"
  | "Unpaid"
  | "Overdue"
  | "Cancelled"
  | "Internal Transfer";

export interface PurchaseInvoice {
  doctype: "Purchase Invoice";
  name?: string;
  docstatus: number;
  status?: PurchaseInvoiceStatus;
  company: string;
  company_currency?: string;
  supplier?: string;
  supplier_name?: string;
  currency: string;
  conversion_rate: number;
  posting_date: string;
  posting_time?: string;
  set_posting_time?: boolean;
  bill_no?: string;
  bill_date?: string;
  due_date?: string;
  credit_to?: string;
  party_account_currency?: string;
  is_return?: boolean;
  is_paid?: boolean;
  is_internal_supplier?: boolean;
  is_opening?: "No" | "Yes";
  is_subcontracted?: boolean;
  return_against?: string;
  update_stock?: boolean;
  update_outstanding_for_self?: boolean;
  update_billed_amount_in_purchase_order?: boolean;
  update_billed_amount_in_purchase_receipt?: boolean;
  inter_company_invoice_reference?: string;
  project?: string;
  against_expense_account?: string;
  buying_price_list?: string;
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
  taxes_and_charges_added?: number;
  taxes_and_charges_deducted?: number;
  total_advance?: number;
  paid_amount?: number;
  base_paid_amount?: number;
  cash_bank_account?: string;
  outstanding_amount?: number;
  per_received?: number;
  on_hold?: boolean;
  hold_type?: string;
  release_date?: string;
  remarks?: string;
  cost_center?: string;
  supplier_warehouse?: string;
  items: PurchaseInvoiceItem[];
  taxes?: TaxRow[];
  advances?: { reference_type?: string; reference_name?: string; idx: number; allocated_amount?: number; ref_exchange_rate?: number; exchange_gain_loss?: number }[];
  supplied_items?: { rm_item_code?: string; qty?: number; warehouse?: string }[];
}

export interface PurchaseInvoiceValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  doc?: PurchaseInvoice;
}

export interface PurchaseInvoiceSubmitResult extends SubmitResult {
  qtyUpdates?: QtyUpdateResult;
}

export interface PurchaseInvoiceCancelResult {
  success: boolean;
  error?: string;
  glEntriesReversed?: boolean;
  stockReversed?: boolean;
  qtyUpdates?: QtyUpdateResult;
}

export interface SupplierInfo {
  name: string;
  disabled?: boolean;
  supplier_name?: string;
  default_price_list?: string;
  default_currency?: string;
  on_hold?: boolean;
  hold_type?: string;
  release_date?: string;
  allow_purchase_invoice_creation_without_purchase_order?: boolean;
  allow_purchase_invoice_creation_without_purchase_receipt?: boolean;
}

export interface PurchaseOrderInfo {
  name: string;
  docstatus: number;
  supplier?: string;
  company?: string;
  currency?: string;
}

/* ------------------------------------------------------------------ */
/*  Status updater configs                                             */
/* ------------------------------------------------------------------ */

/** Default status updater configs for Purchase Invoice → Purchase Order billing. */
export function getPurchaseInvoiceStatusUpdaterConfigs(): StatusUpdaterConfig[] {
  return [
    {
      source_dt: "Purchase Invoice Item",
      target_dt: "Purchase Order Item",
      join_field: "po_detail",
      target_field: "billed_amt",
      target_parent_dt: "Purchase Order",
      target_parent_field: "per_billed",
      target_ref_field: "amount",
      source_field: "amount",
      percent_join_field: "purchase_order",
      overflow_type: "billing",
    },
  ];
}

/** Additional configs when update_stock is true (received qty updates). */
export function getPurchaseInvoiceStockUpdateConfigs(): StatusUpdaterConfig[] {
  return [
    {
      source_dt: "Purchase Invoice Item",
      target_dt: "Purchase Order Item",
      join_field: "po_detail",
      target_field: "received_qty",
      target_parent_dt: "Purchase Order",
      target_parent_field: "per_received",
      target_ref_field: "qty",
      source_field: "received_qty",
      second_source_dt: "Purchase Receipt Item",
      second_source_field: "received_qty",
      second_join_field: "purchase_order_item",
      percent_join_field: "purchase_order",
      overflow_type: "receipt",
    },
    {
      source_dt: "Purchase Invoice Item",
      target_dt: "Material Request Item",
      join_field: "material_request_item",
      target_field: "received_qty",
      target_parent_dt: "Material Request",
      target_parent_field: "per_received",
      target_ref_field: "stock_qty",
      source_field: "stock_qty",
      percent_join_field: "material_request",
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  validate                                                           */
/* ------------------------------------------------------------------ */

export function validatePurchaseInvoice(
  doc: PurchaseInvoice,
  supplierInfo?: SupplierInfo,
  purchaseOrderMap?: Record<string, PurchaseOrderInfo>,
  fiscalYearRange?: { year_start_date: string; year_end_date: string },
  stockItemCodes?: string[]
): PurchaseInvoiceValidationResult {
  const warnings: string[] = [];

  try {
    // 1. Validate supplier
    const supplierErr = validateSupplier(doc, supplierInfo);
    if (supplierErr) return { success: false, error: supplierErr };

    // 2. Set missing values
    setMissingValues(doc, supplierInfo);

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

    // 7. Validate warehouse if update_stock
    if (doc.update_stock && stockItemCodes) {
      const warehouseErr = validateWarehouse(doc, stockItemCodes);
      if (warehouseErr) return { success: false, error: warehouseErr };
    }

    // 8. Validate purchase receipt cannot be linked when update_stock
    if (doc.update_stock) {
      for (const item of doc.items) {
        if (item.purchase_receipt) {
          return {
            success: false,
            error: `Stock cannot be updated for Purchase Invoice because a Purchase Receipt ${item.purchase_receipt} has already been created for item ${item.item_code}`,
          };
        }
      }
    }

    // 9. Calculate taxes and totals
    const taxResult = calculateTaxesAndTotalsForPI(doc);
    if (!taxResult.success) return { success: false, error: taxResult.error };

    // 10. Set expense account defaults
    setExpenseAccountDefaults(doc, stockItemCodes);

    // 11. Set against_expense_account
    setAgainstExpenseAccount(doc);

    // 12. Validate cash purchase
    if (doc.is_paid) {
      const cashErr = validateCashPurchase(doc);
      if (cashErr) return { success: false, error: cashErr };
    }

    // 13. Validate supplier invoice uniqueness (bill_no)
    // TODO: validate_supplier_invoice — needs fiscal year lookup for uniqueness check

    // 14. Validate credit_to account
    if (doc.credit_to && doc.supplier) {
      // TODO: Full credit_to account type validation (Payable, Balance Sheet) — needs Account master lookup
    }

    // 15. Set percentage received
    setPercentageReceived(doc);

    // 16. Run accounts controller validation
    const accountDoc = toAccountDoc(doc);
    const accountResult = validateAccountDoc(accountDoc, {
      fiscalYearRange,
      partyAccountCurrency: doc.party_account_currency,
      supplierBlockStatus: supplierInfo?.on_hold
        ? { onHold: true, holdType: supplierInfo.hold_type ?? "All", releaseDate: supplierInfo.release_date }
        : undefined,
      currentDate: new Date().toISOString().split("T")[0],
    });
    if (!accountResult.success) return { success: false, error: accountResult.error };
    warnings.push(...(accountResult.warnings ?? []));

    // 17. Set status
    doc.status = getPurchaseInvoiceStatus(doc);

    return { success: true, warnings, doc };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  validateSupplier                                                   */
/* ------------------------------------------------------------------ */

export function validateSupplier(
  doc: PurchaseInvoice,
  supplierInfo?: SupplierInfo
): string | undefined {
  if (!doc.supplier) {
    return "Supplier is required for Purchase Invoice";
  }

  if (supplierInfo) {
    if (supplierInfo.disabled) {
      return `Supplier ${doc.supplier} is disabled`;
    }

    // Check on-hold status
    if (supplierInfo.on_hold) {
      const holdType = supplierInfo.hold_type ?? "All";
      const blocksInvoices = ["All", "Invoices"].includes(holdType);
      if (blocksInvoices) {
        const today = new Date().toISOString().split("T")[0];
        if (!supplierInfo.release_date || getdate(supplierInfo.release_date) > getdate(today)) {
          return `Supplier ${doc.supplier} is blocked so this transaction cannot proceed`;
        }
      }
    }
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateMandatory                                                  */
/* ------------------------------------------------------------------ */

export function validateMandatory(doc: PurchaseInvoice): string | undefined {
  if (!doc.company) return "Company is mandatory";
  if (!doc.currency) return "Currency is mandatory";
  if (!doc.conversion_rate) return "Conversion Rate is mandatory";
  if (!doc.posting_date) return "Posting Date is mandatory";
  if (!doc.supplier) return "Supplier is mandatory";
  if (!doc.credit_to) return "Credit To (Payable Account) is mandatory";
  if (doc.items.length === 0) return "No items in Purchase Invoice";

  for (const item of doc.items) {
    if (!item.item_code) return `Row ${item.idx}: Item Code is mandatory`;
    if (!item.expense_account) return `Row ${item.idx}: Expense Account is mandatory for item ${item.item_code}`;
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validatePostingTime                                                */
/* ------------------------------------------------------------------ */

export function validatePostingTime(doc: PurchaseInvoice): void {
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
  doc: PurchaseInvoice,
  supplierInfo?: SupplierInfo
): void {
  // Set supplier name from info
  if (supplierInfo?.supplier_name && !doc.supplier_name) {
    doc.supplier_name = supplierInfo.supplier_name;
  }

  // Set default price list
  if (supplierInfo?.default_price_list && !doc.buying_price_list) {
    doc.buying_price_list = supplierInfo.default_price_list;
  }

  // Set default currency
  if (supplierInfo?.default_currency && !doc.currency) {
    doc.currency = supplierInfo.default_currency;
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
    doc.due_date = doc.bill_date ?? doc.posting_date;
  }

  // Company currency
  if (!doc.company_currency) {
    doc.company_currency = doc.currency;
  }

  // is_opening
  if (!doc.is_opening) doc.is_opening = "No";
}

/* ------------------------------------------------------------------ */
/*  setExpenseAccountDefaults                                          */
/* ------------------------------------------------------------------ */

/**
 * Set default expense account for stock items when auto-accounting is enabled.
 * For stock items without a Purchase Receipt, use "Stock Received But Not Billed".
 * For items with a Purchase Receipt, use the account from the PR.
 * For fixed assets, use the asset category account.
 */
export function setExpenseAccountDefaults(
  doc: PurchaseInvoice,
  stockItemCodes?: string[]
): void {
  if (!stockItemCodes) return;

  for (const item of doc.items) {
    // Skip if expense account is already set and not a stock item
    const isStockItem = stockItemCodes.includes(item.item_code);

    if (isStockItem && !item.is_fixed_asset && doc.is_opening === "No") {
      if (doc.update_stock && item.warehouse && !item.from_warehouse) {
        // When update_stock, expense account should be the inventory account for the warehouse
        // TODO: Full inventory_account_map lookup — for now, leave as-is
      } else if (item.purchase_receipt) {
        // If purchase receipt exists, use "Stock Received But Not Billed"
        // TODO: Lookup from PR GL entries
      } else {
        // No purchase receipt — book in "Stock Received But Not Billed"
        // TODO: Set item.expense_account = company default stock_received_but_not_billed
      }
    }

    if (item.is_fixed_asset && !item.expense_account) {
      // TODO: Get from asset category: capital_work_in_progress_account or fixed_asset_account
    }
  }
}

/* ------------------------------------------------------------------ */
/*  setAgainstExpenseAccount                                           */
/* ------------------------------------------------------------------ */

export function setAgainstExpenseAccount(doc: PurchaseInvoice): void {
  const accounts: string[] = [];
  for (const item of doc.items) {
    if (item.expense_account && !accounts.includes(item.expense_account)) {
      accounts.push(item.expense_account);
    }
  }
  doc.against_expense_account = accounts.join(",");
}

/* ------------------------------------------------------------------ */
/*  validateWarehouse                                                  */
/* ------------------------------------------------------------------ */

export function validateWarehouse(
  doc: PurchaseInvoice,
  stockItemCodes: string[]
): string | undefined {
  if (!doc.update_stock) return undefined;

  for (const item of doc.items) {
    if (stockItemCodes.includes(item.item_code) && !item.warehouse) {
      return `Row ${item.idx}: Warehouse is required for stock item ${item.item_code} when Update Stock is checked`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateCashPurchase                                               */
/* ------------------------------------------------------------------ */

export function validateCashPurchase(doc: PurchaseInvoice): string | undefined {
  if (!doc.cash_bank_account && flt(doc.paid_amount)) {
    return "Cash or Bank Account is mandatory for making payment entry";
  }

  if (
    flt(doc.paid_amount) + flt(doc.write_off_amount ?? 0) -
      flt(doc.rounded_total ?? doc.grand_total ?? 0) >
    0.01
  ) {
    return "Paid amount + Write Off Amount cannot be greater than Grand Total";
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  setPercentageReceived                                              */
/* ------------------------------------------------------------------ */

export function setPercentageReceived(doc: PurchaseInvoice): void {
  let totalBilledQty = 0;
  let totalReceivedQty = 0;

  for (const item of doc.items) {
    if (item.purchase_receipt && item.pr_detail && item.received_qty) {
      totalBilledQty += item.qty;
      totalReceivedQty += item.received_qty;
    }
  }

  if (totalBilledQty && totalReceivedQty) {
    doc.per_received = flt((totalReceivedQty / totalBilledQty) * 100);
  }
}

/* ------------------------------------------------------------------ */
/*  calculateTaxesAndTotalsForPI                                       */
/* ------------------------------------------------------------------ */

export function calculateTaxesAndTotalsForPI(
  doc: PurchaseInvoice
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
        rejected_qty: item.rejected_qty,
        grant_commission: !item.is_free_item,
        item_tax_rate: undefined,
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

    // Write computed values back to the Purchase Invoice doc
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
 * Build GL entries for a Purchase Invoice.
 * Credit: Payable (credit_to) — Debit: Expense per item + Tax accounts
 */
export function makeGlEntries(doc: PurchaseInvoice): GLEntry[] {
  const entries: GLEntry[] = [];
  const voucherNo = doc.name ?? "";
  const againstVoucher =
    doc.is_return && doc.return_against && !doc.update_outstanding_for_self
      ? doc.return_against
      : doc.name ?? "";

  // 1. Supplier GL entry (Credit payable)
  const grandTotal = doc.rounding_adjustment && doc.rounded_total
    ? doc.rounded_total
    : doc.grand_total ?? 0;

  const baseGrandTotal = doc.base_rounding_adjustment && doc.base_rounded_total
    ? doc.base_rounded_total
    : doc.base_grand_total ?? 0;

  if (grandTotal && !doc.is_internal_supplier) {
    entries.push({
      account: doc.credit_to ?? "Creditors",
      party_type: "Supplier",
      party: doc.supplier,
      against: doc.against_expense_account,
      debit: 0,
      credit: flt(baseGrandTotal),
      cost_center: doc.cost_center,
      project: doc.project,
      against_voucher: againstVoucher,
      against_voucher_type: "Purchase Invoice",
      due_date: doc.due_date,
      remarks: doc.remarks ?? `Purchase Invoice ${voucherNo}`,
    });
  }

  // 2. Item expense GL entries (Debit expense)
  for (const item of doc.items) {
    if (!flt(item.base_net_amount ?? 0) && !item.is_fixed_asset) continue;
    if (doc.is_internal_supplier) continue;

    const expenseAccount = item.enable_deferred_expense && !doc.is_return
      ? item.deferred_expense_account ?? item.expense_account ?? "Purchase"
      : item.expense_account ?? "Purchase";

    const baseAmount = flt(item.base_net_amount ?? 0);
    const amount = flt(item.net_amount ?? item.amount ?? 0);

    entries.push({
      account: expenseAccount,
      against: doc.supplier,
      debit: baseAmount,
      credit: 0,
      cost_center: item.cost_center,
      project: item.project ?? doc.project,
      remarks: doc.remarks ?? `Purchase Invoice ${voucherNo}`,
    });

    // TODO: Stock adjustment entries when update_stock + perpetual inventory
    // TODO: Fixed asset GL entries (get_gl_entries_for_fixed_asset)
    // TODO: Sub-contracting warehouse entries (rm_supp_cost)
    // TODO: Landed cost voucher entries
    // TODO: Valuation tax entries (item_tax_amount)
  }

  // 3. Tax GL entries (Debit/credit tax accounts)
  for (const tax of doc.taxes ?? []) {
    const baseAmount = flt(tax.tax_amount ?? 0);
    if (!baseAmount) continue;

    // For "Total" and "Valuation and Total" categories, debit the tax account
    // TODO: Full add_deduct_tax support when TaxRow type is extended
    const category = tax.category ?? "Total";
    if (category === "Total" || category === "Valuation and Total") {
      entries.push({
        account: tax.account_head,
        against: doc.supplier,
        debit: baseAmount,
        credit: 0,
        cost_center: tax.cost_center,
        remarks: doc.remarks ?? `Purchase Invoice ${voucherNo}`,
      });
    }

    // TODO: Valuation-only tax entries need special handling (accumulate then book later)
  }

  // 4. Internal transfer unrealized profit/loss
  // TODO: make_internal_transfer_gl_entries — needs unrealized_profit_loss_account

  // 5. Paid amount GL entries
  if (doc.is_paid && doc.cash_bank_account && doc.paid_amount) {
    // Debit payable (reduce outstanding)
    entries.push({
      account: doc.credit_to ?? "Creditors",
      party_type: "Supplier",
      party: doc.supplier,
      against: doc.cash_bank_account,
      debit: flt(doc.base_paid_amount ?? 0),
      credit: 0,
      cost_center: doc.cost_center,
      project: doc.project,
      against_voucher: againstVoucher,
      against_voucher_type: "Purchase Invoice",
    });

    // Credit bank/cash
    entries.push({
      account: doc.cash_bank_account,
      against: doc.supplier,
      debit: 0,
      credit: flt(doc.base_paid_amount ?? 0),
      cost_center: doc.cost_center,
    });
  }

  // 6. Write-off GL entries
  if (doc.write_off_account && flt(doc.write_off_amount)) {
    entries.push({
      account: doc.credit_to ?? "Creditors",
      party_type: "Supplier",
      party: doc.supplier,
      against: doc.write_off_account,
      debit: flt(doc.base_write_off_amount ?? 0),
      credit: 0,
      cost_center: doc.cost_center,
      project: doc.project,
      against_voucher: againstVoucher,
      against_voucher_type: "Purchase Invoice",
    });

    entries.push({
      account: doc.write_off_account,
      against: doc.supplier,
      debit: 0,
      credit: flt(doc.base_write_off_amount ?? 0),
      cost_center: doc.write_off_cost_center ?? doc.cost_center,
    });
  }

  // 7. Rounding adjustment GL entry
  if (flt(doc.rounding_adjustment) && doc.base_rounding_adjustment && !doc.is_internal_supplier) {
    entries.push({
      account: "Round Off", // TODO: lookup from Company round_off_account
      against: doc.supplier,
      debit: 0,
      credit: flt(doc.base_rounding_adjustment),
      cost_center: doc.cost_center,
      remarks: `Rounding Adjustment for ${voucherNo}`,
    });
  }

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
 * Build stock ledger entries for a Purchase Invoice when update_stock is true.
 * Items are received in (positive qty) on submit, reversed on cancel.
 */
export function buildStockLedgerEntries(
  doc: PurchaseInvoice,
  isCancel = false
): StockLedgerEntry[] {
  if (!doc.update_stock) return [];

  const entries: StockLedgerEntry[] = [];
  const sign = isCancel ? -1 : 1; // Submit: receive in (positive), Cancel: reverse (negative)

  for (const item of doc.items) {
    if (!item.warehouse || !item.qty) continue;

    const qty = flt(item.qty * item.conversion_factor);
    entries.push({
      item_code: item.item_code,
      warehouse: item.warehouse,
      qty: sign * qty,
      valuation_rate: item.valuation_rate,
      posting_date: doc.posting_date,
      posting_time: doc.posting_time,
      voucher_type: "Purchase Invoice",
      voucher_no: doc.name ?? "",
      voucher_detail_no: item.name,
    });

    // If from_warehouse, also post a transfer-out entry
    if (item.from_warehouse) {
      entries.push({
        item_code: item.item_code,
        warehouse: item.from_warehouse,
        qty: -sign * qty,
        valuation_rate: item.valuation_rate,
        posting_date: doc.posting_date,
        posting_time: doc.posting_time,
        voucher_type: "Purchase Invoice",
        voucher_no: doc.name ?? "",
        voucher_detail_no: item.name,
      });
    }
  }

  return entries;
}

/* ------------------------------------------------------------------ */
/*  on_submit                                                          */
/* ------------------------------------------------------------------ */

export function onSubmitPurchaseInvoice(
  doc: PurchaseInvoice,
  purchaseOrderChildren?: ChildItem[]
): PurchaseInvoiceSubmitResult {
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
    let configs = getPurchaseInvoiceStatusUpdaterConfigs();
    if (doc.update_stock) {
      configs = [...configs, ...getPurchaseInvoiceStockUpdateConfigs()];
    }

    let qtyUpdates: QtyUpdateResult | undefined;
    if (purchaseOrderChildren && purchaseOrderChildren.length > 0) {
      const qtyResult = updateQty(
        {
          doctype: doc.doctype,
          docstatus: doc.docstatus,
          status: doc.status,
          is_return: doc.is_return,
        },
        purchaseOrderChildren,
        configs
      );
      if (qtyResult.success) {
        qtyUpdates = qtyResult.result;
      }
    }

    // 5. Skip billing status update for returns unless configured
    if (doc.is_return && !doc.update_billed_amount_in_purchase_order) {
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

export function onCancelPurchaseInvoice(
  doc: PurchaseInvoice,
  purchaseOrderChildren?: ChildItem[]
): PurchaseInvoiceCancelResult {
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
    let configs = getPurchaseInvoiceStatusUpdaterConfigs();
    if (doc.update_stock) {
      configs = [...configs, ...getPurchaseInvoiceStockUpdateConfigs()];
    }

    let qtyUpdates: QtyUpdateResult | undefined;
    if (purchaseOrderChildren && purchaseOrderChildren.length > 0) {
      // On cancel, negate the source values
      const negatedChildren: ChildItem[] = purchaseOrderChildren.map((c) => ({
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

export function getPurchaseInvoiceStatus(doc: PurchaseInvoice): PurchaseInvoiceStatus {
  if (doc.docstatus === 0) return "Draft";
  if (doc.docstatus === 2) return "Cancelled";
  if (doc.docstatus === 1) {
    if (doc.is_internal_supplier) return "Internal Transfer";
    if (doc.is_return) return "Return";

    const outstanding = flt(doc.outstanding_amount ?? 0);
    const grandTotal = flt(doc.grand_total ?? 0);

    if (outstanding <= 0) return "Paid";
    if (outstanding > 0 && outstanding < grandTotal) return "Partly Paid";
    // TODO: Overdue check needs comparison of due_date vs current date
    // TODO: Debit Note Issued check needs DB lookup for return invoices
    return "Unpaid";
  }
  return "Draft";
}

/* ------------------------------------------------------------------ */
/*  Remarks                                                            */
/* ------------------------------------------------------------------ */

export function createRemarks(doc: PurchaseInvoice): void {
  if (!doc.remarks && doc.bill_no) {
    doc.remarks = `Against Supplier Invoice ${doc.bill_no}`;
    if (doc.bill_date) {
      doc.remarks += ` dated ${doc.bill_date}`;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Make Purchase Receipt from Purchase Invoice                        */
/* ------------------------------------------------------------------ */

export interface PurchaseReceiptItemDraft {
  item_code: string;
  qty: number;
  received_qty?: number;
  rate: number;
  amount: number;
  purchase_order?: string;
  purchase_order_item?: string;
  warehouse?: string;
  cost_center?: string;
  purchase_invoice_item?: string;
  purchase_invoice?: string;
}

/**
 * Map Purchase Invoice items to a Purchase Receipt draft.
 * Used when the invoice has update_stock and we need a PR representation.
 */
export function mapPIToPurchaseReceiptItems(
  doc: PurchaseInvoice
): PurchaseReceiptItemDraft[] {
  return doc.items
    .filter((item) => item.qty > 0)
    .map((item) => ({
      item_code: item.item_code,
      qty: item.qty - flt(item.received_qty ?? 0),
      received_qty: item.qty - flt(item.received_qty ?? 0),
      rate: item.rate,
      amount: (item.qty - flt(item.received_qty ?? 0)) * item.rate,
      purchase_order: item.purchase_order,
      purchase_order_item: item.po_detail,
      warehouse: item.warehouse,
      cost_center: item.cost_center,
      purchase_invoice_item: item.name,
      purchase_invoice: doc.name,
    }));
}

/* ------------------------------------------------------------------ */
/*  Helper: Convert to AccountDoc                                      */
/* ------------------------------------------------------------------ */

function toAccountDoc(doc: PurchaseInvoice): AccountDoc {
  return {
    doctype: doc.doctype,
    name: doc.name,
    company: doc.company,
    supplier: doc.supplier,
    currency: doc.currency,
    company_currency: doc.company_currency ?? doc.currency,
    conversion_rate: doc.conversion_rate,
    posting_date: doc.posting_date,
    is_return: doc.is_return,
    return_against: doc.return_against,
    credit_to: doc.credit_to,
    items: doc.items.map((item) => ({
      item_code: item.item_code,
      item_name: item.item_name,
      qty: item.qty,
      rate: item.rate,
      amount: item.amount,
      income_account: item.income_account,
      expense_account: item.expense_account,
      cost_center: item.cost_center,
      enable_deferred_expense: item.enable_deferred_expense,
      deferred_expense_account: item.deferred_expense_account,
      service_start_date: undefined,
      service_end_date: undefined,
      idx: item.idx,
      delivered_by_supplier: undefined,
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
    is_paid: doc.is_paid,
    cash_bank_account: doc.cash_bank_account,
    paid_amount: doc.paid_amount,
    base_paid_amount: doc.base_paid_amount,
    write_off_amount: doc.write_off_amount,
    base_write_off_amount: doc.base_write_off_amount,
    total_advance: doc.total_advance,
    is_internal_supplier: doc.is_internal_supplier,
    is_opening: doc.is_opening,
    inter_company_invoice_reference: doc.inter_company_invoice_reference,
    project: doc.project,
  };
}
