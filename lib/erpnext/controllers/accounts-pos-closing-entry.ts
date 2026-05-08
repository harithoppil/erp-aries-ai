/**
 * accounts-pos-closing-entry.ts
 * Ported business logic from ERPNext accounts/doctype/pos_closing_entry/pos_closing_entry.py
 * Pure validation & calculation functions — NO database calls.
 */

export type POSClosingEntryStatus = "Draft" | "Submitted" | "Queued" | "Failed" | "Cancelled";
export type InvoiceType = "POS Invoice" | "Sales Invoice";

export interface POSInvoiceReference {
  idx: number;
  pos_invoice: string;
  posting_date?: string;
  grand_total?: number;
  customer?: string;
  is_return?: boolean;
  return_against?: string;
}

export interface SalesInvoiceReference {
  idx: number;
  sales_invoice: string;
  posting_date?: string;
  grand_total?: number;
  customer?: string;
  is_return?: boolean;
  return_against?: string;
}

export interface POSClosingEntryDetail {
  idx: number;
  mode_of_payment: string;
  opening_amount?: number;
  expected_amount?: number;
  closing_amount?: number;
  difference?: number;
}

export interface POSClosingEntryTax {
  idx: number;
  account_head: string;
  amount?: number;
  rate?: number;
}

export interface POSClosingEntry {
  name?: string;
  pos_opening_entry: string;
  pos_profile: string;
  company: string;
  user: string;
  posting_date?: string;
  posting_time?: string;
  period_start_date: string;
  period_end_date: string;
  status?: POSClosingEntryStatus;
  docstatus: number;
  grand_total?: number;
  net_total?: number;
  total_quantity?: number;
  total_taxes_and_charges?: number;
  pos_invoices: POSInvoiceReference[];
  sales_invoices: SalesInvoiceReference[];
  payment_reconciliation: POSClosingEntryDetail[];
  taxes: POSClosingEntryTax[];
  error_message?: string;
}

export interface POSOpeningEntry {
  name: string;
  status: "Open" | "Closed" | "Cancelled";
  pos_profile: string;
  user: string;
  company: string;
  period_start_date: string;
}

export interface InvoiceForClosing {
  name: string;
  doctype: "POS Invoice" | "Sales Invoice";
  customer?: string;
  posting_date?: string;
  grand_total: number;
  net_total?: number;
  total_qty?: number;
  total_taxes_and_charges?: number;
  change_amount?: number;
  account_for_change_amount?: string;
  is_return?: boolean;
  return_against?: string;
  owner?: string;
  pos_profile?: string;
  docstatus?: number;
  is_pos?: boolean;
  consolidated_invoice?: string;
  pos_closing_entry?: string;
  is_created_using_pos?: boolean;
}

export interface PaymentSummary {
  mode_of_payment: string;
  account?: string;
  amount: number;
}

export interface TaxSummary {
  account_head: string;
  tax_amount: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ClosingEntryData {
  invoices: InvoiceForClosing[];
  payments: PaymentSummary[];
  taxes: TaxSummary[];
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

/* ── Validation Functions ────────────────────────────────── */

export function validatePOSClosingEntry(
  entry: POSClosingEntry,
  openingEntry: POSOpeningEntry,
  invoiceType: InvoiceType,
  posInvoiceMap: Record<string, InvoiceForClosing>,
  salesInvoiceMap: Record<string, InvoiceForClosing>,
): ValidationResult {
  const errors: string[] = [];

  // set_posting_date_and_time
  // In pure logic, we suggest current date/time but caller decides

  // validate_pos_opening_entry
  if (openingEntry.status !== "Open") {
    errors.push("Selected POS Opening Entry should be open.");
  }

  // validate_invoice_mode
  if (invoiceType === "POS Invoice") {
    const dupErrors = validateDuplicatePOSInvoices(entry.pos_invoices);
    errors.push(...dupErrors);

    const invErrors = validatePOSInvoices(
      entry.pos_invoices,
      entry.pos_profile,
      entry.user,
      posInvoiceMap,
    );
    errors.push(...invErrors);
  }

  if (invoiceType === "Sales Invoice" && entry.pos_invoices.length !== 0) {
    errors.push("POS Invoices can't be added when Sales Invoice is enabled");
  }

  const dupSalesErrors = validateDuplicateSalesInvoices(entry.sales_invoices);
  errors.push(...dupSalesErrors);

  const salesInvErrors = validateSalesInvoices(
    entry.sales_invoices,
    entry.pos_profile,
    entry.user,
    salesInvoiceMap,
  );
  errors.push(...salesInvErrors);

  return { valid: errors.length === 0, errors };
}

export function validateDuplicatePOSInvoices(
  posInvoices: POSInvoiceReference[],
): string[] {
  const errors: string[] = [];
  const occurrences: Record<string, number[]> = {};

  for (let idx = 0; idx < posInvoices.length; idx++) {
    const inv = posInvoices[idx];
    const rowNum = idx + 1;
    occurrences[inv.pos_invoice] = occurrences[inv.pos_invoice] || [];
    occurrences[inv.pos_invoice].push(rowNum);
  }

  for (const [key, value] of Object.entries(occurrences)) {
    if (value.length > 1) {
      errors.push(`${key} is added multiple times on rows: ${value.join(", ")}`);
    }
  }

  return errors;
}

export function validatePOSInvoices(
  posInvoices: POSInvoiceReference[],
  posProfile: string,
  user: string,
  posInvoiceMap: Record<string, InvoiceForClosing>,
): string[] {
  const errors: string[] = [];

  for (let idx = 0; idx < posInvoices.length; idx++) {
    const d = posInvoices[idx];
    const rowNum = idx + 1;
    const posInvoice = posInvoiceMap[d.pos_invoice];

    if (!posInvoice) {
      errors.push(`Row #${rowNum}: POS Invoice ${d.pos_invoice} not found`);
      continue;
    }

    if (posInvoice.consolidated_invoice) {
      errors.push(`Row #${rowNum}: POS Invoice is already consolidated`);
      continue;
    }
    if (posInvoice.pos_profile !== posProfile) {
      errors.push(`Row #${rowNum}: POS Profile doesn't match ${posProfile}`);
    }
    if (posInvoice.docstatus !== 1) {
      errors.push(`Row #${rowNum}: POS Invoice is not submitted`);
    }
    if (posInvoice.owner !== user) {
      errors.push(`Row #${rowNum}: POS Invoice isn't created by user ${user}`);
    }
  }

  return errors;
}

export function validateDuplicateSalesInvoices(
  salesInvoices: SalesInvoiceReference[],
): string[] {
  const errors: string[] = [];
  const occurrences: Record<string, number[]> = {};

  for (let idx = 0; idx < salesInvoices.length; idx++) {
    const inv = salesInvoices[idx];
    const rowNum = idx + 1;
    occurrences[inv.sales_invoice] = occurrences[inv.sales_invoice] || [];
    occurrences[inv.sales_invoice].push(rowNum);
  }

  for (const [key, value] of Object.entries(occurrences)) {
    if (value.length > 1) {
      errors.push(`${key} is added multiple times on rows: ${value.join(", ")}`);
    }
  }

  return errors;
}

export function validateSalesInvoices(
  salesInvoices: SalesInvoiceReference[],
  posProfile: string,
  user: string,
  salesInvoiceMap: Record<string, InvoiceForClosing>,
): string[] {
  const errors: string[] = [];

  for (let idx = 0; idx < salesInvoices.length; idx++) {
    const d = salesInvoices[idx];
    const rowNum = idx + 1;
    const salesInvoice = salesInvoiceMap[d.sales_invoice];

    if (!salesInvoice) {
      errors.push(`Row #${rowNum}: Sales Invoice ${d.sales_invoice} not found`);
      continue;
    }

    if (salesInvoice.pos_closing_entry) {
      errors.push(`Row #${rowNum}: Sales Invoice is already consolidated`);
      continue;
    }
    if (salesInvoice.is_pos === false) {
      errors.push(`Row #${rowNum}: Sales Invoice does not have Payments`);
    }
    if (salesInvoice.is_created_using_pos === false) {
      errors.push(`Row #${rowNum}: Sales Invoice is not created using POS`);
    }
    if (salesInvoice.pos_profile !== posProfile) {
      errors.push(`Row #${rowNum}: POS Profile doesn't match ${posProfile}`);
    }
    if (salesInvoice.docstatus !== 1) {
      errors.push(`Row #${rowNum}: Sales Invoice is not submitted`);
    }
    if (salesInvoice.owner !== user) {
      errors.push(`Row #${rowNum}: Sales Invoice isn't created by user ${user}`);
    }
  }

  return errors;
}

export function checkPCEIsCancellable(
  entry: POSClosingEntry,
  hasOpenPOSProfile: boolean,
): ValidationResult {
  const errors: string[] = [];
  if (hasOpenPOSProfile) {
    errors.push(
      `POS Profile - ${entry.pos_profile} is currently open. Please close the POS or cancel the existing POS Opening Entry before cancelling this POS Closing Entry.`,
    );
  }
  return { valid: errors.length === 0, errors };
}

/* ── Data aggregation helpers ────────────────────────────── */

export function getPayments(
  invoices: InvoiceForClosing[],
  paymentDetails: Array<{
    parent: string;
    mode_of_payment: string;
    account: string;
    amount: number;
  }>,
): PaymentSummary[] {
  if (invoices.length === 0) return [];

  const invoiceNames = new Set(invoices.map((d) => d.name));

  const aggregated: Record<string, { mode_of_payment: string; account: string; amount: number }> = {};

  for (const d of paymentDetails) {
    if (!invoiceNames.has(d.parent)) continue;
    const key = d.mode_of_payment;
    if (!aggregated[key]) {
      aggregated[key] = { mode_of_payment: d.mode_of_payment, account: d.account, amount: 0 };
    }
    aggregated[key].amount += flt(d.amount);
  }

  // Adjust for change amount by account
  const changeAmountByAccount: Record<string, number> = {};
  for (const d of invoices) {
    if (d.account_for_change_amount) {
      changeAmountByAccount[d.account_for_change_amount] =
        (changeAmountByAccount[d.account_for_change_amount] || 0) + flt(d.change_amount);
    }
  }

  const result: PaymentSummary[] = [];
  for (const d of Object.values(aggregated)) {
    let amount = d.amount;
    if (changeAmountByAccount[d.account]) {
      amount -= flt(changeAmountByAccount[d.account]);
    }
    result.push({ mode_of_payment: d.mode_of_payment, amount });
  }

  return result;
}

export function getTaxes(
  invoices: InvoiceForClosing[],
  taxDetails: Array<{
    parent: string;
    account_head: string;
    tax_amount_after_discount_amount?: number;
  }>,
): TaxSummary[] {
  if (invoices.length === 0) return [];

  const invoiceNames = new Set(invoices.map((d) => d.name));
  const aggregated: Record<string, number> = {};

  for (const d of taxDetails) {
    if (!invoiceNames.has(d.parent)) continue;
    aggregated[d.account_head] = (aggregated[d.account_head] || 0) + flt(d.tax_amount_after_discount_amount);
  }

  return Object.entries(aggregated).map(([account_head, tax_amount]) => ({
    account_head,
    tax_amount,
  }));
}

/* ── Build closing entry from opening ────────────────────── */

export interface ClosingEntryFromOpeningResult {
  pos_opening_entry: string;
  period_start_date: string;
  period_end_date: string;
  pos_profile: string;
  user: string;
  company: string;
  grand_total: number;
  net_total: number;
  total_quantity: number;
  total_taxes_and_charges: number;
  pos_invoices: POSInvoiceReference[];
  sales_invoices: SalesInvoiceReference[];
  payment_reconciliation: POSClosingEntryDetail[];
  taxes: POSClosingEntryTax[];
}

export function makeClosingEntryFromOpening(
  openingEntry: POSOpeningEntry,
  data: ClosingEntryData,
): ClosingEntryFromOpeningResult {
  const posInvoices: POSInvoiceReference[] = [];
  const salesInvoices: SalesInvoiceReference[] = [];
  const taxes: POSClosingEntryTax[] = data.taxes.map((tx, idx) => ({
    idx: idx + 1,
    account_head: tx.account_head,
    amount: tx.tax_amount,
  }));

  const payments: POSClosingEntryDetail[] = data.payments.map((p, idx) => ({
    idx: idx + 1,
    mode_of_payment: p.mode_of_payment,
    opening_amount: 0,
    expected_amount: p.amount,
  }));

  let grandTotal = 0;
  let netTotal = 0;
  let totalQuantity = 0;
  let totalTaxesAndCharges = 0;

  for (const d of data.invoices) {
    if (d.doctype === "POS Invoice") {
      const posRef: POSInvoiceReference = {
        idx: 0,
        pos_invoice: d.name,
        posting_date: d.posting_date,
        grand_total: d.grand_total,
        customer: d.customer,
        is_return: d.is_return,
        return_against: d.return_against,
      };
      posInvoices.push(posRef);
    } else {
      const salesRef: SalesInvoiceReference = {
        idx: 0,
        sales_invoice: d.name,
        posting_date: d.posting_date,
        grand_total: d.grand_total,
        customer: d.customer,
        is_return: d.is_return,
        return_against: d.return_against,
      };
      salesInvoices.push(salesRef);
    }

    grandTotal += flt(d.grand_total);
    netTotal += flt(d.net_total);
    totalQuantity += flt(d.total_qty);
    totalTaxesAndCharges += flt(d.total_taxes_and_charges);
  }

  // Assign idx values
  posInvoices.forEach((inv, idx) => { inv.idx = idx + 1; });
  salesInvoices.forEach((inv, idx) => { inv.idx = idx + 1; });

  return {
    pos_opening_entry: openingEntry.name,
    period_start_date: openingEntry.period_start_date,
    period_end_date: new Date().toISOString(),
    pos_profile: openingEntry.pos_profile,
    user: openingEntry.user,
    company: openingEntry.company,
    grand_total: grandTotal,
    net_total: netTotal,
    total_quantity: totalQuantity,
    total_taxes_and_charges: totalTaxesAndCharges,
    pos_invoices: posInvoices,
    sales_invoices: salesInvoices,
    payment_reconciliation: payments,
    taxes,
  };
}

/* ── Cashiers helper ─────────────────────────────────────── */

export function getCashiers(
  posProfileUsers: Array<{ user: string; pos_profile: string }>,
  posProfile?: string,
): string[] {
  const users = posProfileUsers
    .filter((u) => !posProfile || u.pos_profile === posProfile)
    .map((u) => u.user);
  return Array.from(new Set(users));
}
