import { errorMessage } from '@/lib/utils';
/**
 * Ported from erpnext/controllers/accounts_controller.py
 * Pure validation logic for accounting documents (Invoices, Orders, etc.)
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AccountDocItem {
  item_code: string;
  item_name?: string;
  qty: number;
  rate: number;
  amount: number;
  income_account?: string;
  expense_account?: string;
  cost_center?: string;
  enable_deferred_revenue?: boolean;
  enable_deferred_expense?: boolean;
  deferred_revenue_account?: string;
  deferred_expense_account?: string;
  service_start_date?: string;
  service_end_date?: string;
  idx: number;
  delivered_by_supplier?: boolean;
}

export interface TaxRow {
  idx: number;
  account_head: string;
  rate?: number;
  charge_type: string;
  row_id?: number;
  included_in_print_rate?: boolean;
  category?: string;
  cost_center?: string;
  tax_amount?: number;
}

export interface PaymentScheduleRow {
  idx?: number;
  payment_term?: string;
  due_date: string;
  invoice_portion: number;
  payment_amount: number;
  base_payment_amount?: number;
  discount_date?: string;
}

export interface AdvanceRow {
  reference_type?: string;
  reference_name?: string;
  idx: number;
  allocated_amount?: number;
  ref_exchange_rate?: number;
  exchange_gain_loss?: number;
}

export interface AccountDoc {
  doctype: string;
  name?: string;
  company: string;
  customer?: string;
  supplier?: string;
  currency: string;
  company_currency?: string;
  conversion_rate: number;
  posting_date?: string;
  transaction_date?: string;
  fiscal_year?: string;
  is_return?: boolean;
  is_debit_note?: boolean;
  return_against?: string;
  debit_to?: string;
  credit_to?: string;
  items: AccountDocItem[];
  taxes?: TaxRow[];
  discount_amount?: number;
  apply_discount_on?: string;
  grand_total?: number;
  base_grand_total?: number;
  rounded_total?: number;
  base_rounded_total?: number;
  outstanding_amount?: number;
  update_outstanding_for_self?: boolean;
  payment_terms_template?: string;
  payment_schedule?: PaymentScheduleRow[];
  advances?: AdvanceRow[];
  allocate_advances_automatically?: boolean;
  is_pos?: boolean;
  is_paid?: boolean;
  cash_bank_account?: string;
  paid_amount?: number;
  base_paid_amount?: number;
  letter_head?: string;
  billing_address?: string;
  shipping_address?: string;
  customer_address?: string;
  shipping_address_name?: string;
  company_address?: string;
  dispatch_address_name?: string;
  contact_person?: string;
  supplier_address?: string;
  is_opening?: string;
  write_off_amount?: number;
  base_write_off_amount?: number;
  total_advance?: number;
  is_internal_customer?: boolean;
  is_internal_supplier?: boolean;
  represents_company?: string;
  inter_company_reference?: string;
  inter_company_invoice_reference?: string;
  inter_company_order_reference?: string;
  ignore_pricing_rule?: boolean;
  project?: string;
}

export interface FiscalYearRange {
  year_start_date: string;
  year_end_date: string;
}

export interface AddressLink {
  address: string;
  link_doctype: string;
  link_name: string;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface SubmitResult {
  success: boolean;
  gl_entries?: { account: string; debit: number; credit: number; cost_center?: string; remarks?: string }[];
  error?: string;
}

export interface RefBilledAmount {
  item_code: string;
  ref_amt: number;
  billed_amt: number;
  rows: number[];
  max_allowed_amt?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

export function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

export function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function cint(value: unknown): number {
  return Number(value) || 0;
}

/* ------------------------------------------------------------------ */
/*  Individual Validations (pure functions)                            */
/* ------------------------------------------------------------------ */

/** Validate that qty is not zero for non-return documents. */
export function validateQtyIsNotZero(
  items: AccountDocItem[],
  allowZeroQty = false,
  isReturn = false,
  doctype?: string
): string | null {
  if (allowZeroQty || isReturn) return null;

  const zeroRows: number[] = [];
  for (const item of items) {
    if (doctype === "Purchase Receipt" && item.qty === 0) {
      // Purchase Receipt allows rejected_qty, but here we check qty itself
      // Original Python allows rejected_qty to bypass check
      // We'll keep simple: if qty is 0, flag it
      zeroRows.push(item.idx);
      continue;
    }
    if (flt(item.qty) === 0) {
      zeroRows.push(item.idx);
    }
  }

  if (zeroRows.length > 0) {
    return `Row #${zeroRows.join(", ")}: Quantity cannot be zero.`;
  }
  return null;
}

/** For return invoices with stock update, zero-qty items are not allowed. */
export function validateZeroQtyForReturnInvoicesWithStock(
  items: AccountDocItem[],
  isReturn: boolean,
  updateStock?: boolean
): string | null {
  if (!isReturn || !updateStock) return null;

  const zeroRows = items.filter((item) => flt(item.qty) === 0);
  if (zeroRows.length > 0) {
    return `For Return Invoices with Stock effect, '0' qty Items are not allowed. Affected rows: ${zeroRows
      .map((x) => "#" + x.idx)
      .join(", ")}`;
  }
  return null;
}

/** Validate posting/transaction date falls within the fiscal year. */
export function validateDateWithFiscalYear(
  dateStr: string | undefined,
  fiscalYear: string | undefined,
  fiscalYearRange: FiscalYearRange | undefined
): string | null {
  if (!dateStr || !fiscalYear || !fiscalYearRange) return null;

  const d = getdate(dateStr);
  const start = getdate(fiscalYearRange.year_start_date);
  const end = getdate(fiscalYearRange.year_end_date);

  if (d < start || d > end) {
    return `Date ${dateStr} does not belong to Fiscal Year ${fiscalYear}`;
  }
  return null;
}

/** Validate that item income/expense account is not the same as party account. */
export function validatePartyAccounts(doc: AccountDoc): string | null {
  if (doc.doctype !== "Sales Invoice" && doc.doctype !== "Purchase Invoice") {
    return null;
  }

  const partyAccountField = doc.doctype === "Sales Invoice" ? "debit_to" : "credit_to";
  const itemField = doc.doctype === "Sales Invoice" ? "income_account" : "expense_account";
  const partyAccount = doc[partyAccountField as keyof AccountDoc] as string | undefined;

  for (const item of doc.items) {
    const itemAccount = item[itemField as keyof AccountDocItem] as string | undefined;
    if (itemAccount && itemAccount === partyAccount) {
      return `Row ${item.idx}: ${itemField} ${itemAccount} cannot be same as ${partyAccountField} ${partyAccount}`;
    }
  }
  return null;
}

/** Validate return invoice uses the same party account as the original invoice. */
export function validateReturnAgainstAccount(
  doctype: string,
  isReturn: boolean | undefined,
  returnAgainst: string | undefined,
  currentAccount: string | undefined,
  originalAccount: string | undefined
): string | null {
  if ((doctype !== "Sales Invoice" && doctype !== "Purchase Invoice") || !isReturn || !returnAgainst) {
    return null;
  }

  const crDrField = doctype === "Sales Invoice" ? "debit_to" : "credit_to";
  if (originalAccount && currentAccount && originalAccount !== currentAccount) {
    return `Please set ${crDrField} to ${originalAccount}, the same account used in the original invoice ${returnAgainst}`;
  }
  return null;
}

/** Validate deferred revenue / expense start and end dates. */
export function validateDeferredDates(
  items: AccountDocItem[],
  postingDate?: string,
  transactionDate?: string
): string | null {
  const referenceDate = postingDate ?? transactionDate;

  for (const item of items) {
    if (!item.enable_deferred_revenue && !item.enable_deferred_expense) continue;

    if (!item.service_start_date || !item.service_end_date) {
      return `Row ${item.idx}: Service Start and End Date is required for deferred accounting`;
    }

    if (getdate(item.service_start_date) > getdate(item.service_end_date)) {
      return `Row ${item.idx}: Service Start Date cannot be greater than Service End Date`;
    }

    if (referenceDate && getdate(referenceDate) > getdate(item.service_end_date)) {
      return `Row ${item.idx}: Service End Date cannot be before Invoice Posting Date`;
    }
  }
  return null;
}

/** Validate that a deferred account is provided (or a default exists). */
export function validateDeferredIncomeExpenseAccount(
  doctype: string,
  items: AccountDocItem[],
  defaultDeferredRevenueAccount?: string,
  defaultDeferredExpenseAccount?: string
): string | null {
  const fieldMap: Record<string, keyof AccountDocItem> = {
    "Sales Invoice": "deferred_revenue_account",
    "Purchase Invoice": "deferred_expense_account",
  };
  const field = fieldMap[doctype];
  if (!field) return null;

  const defaultAccount = doctype === "Sales Invoice" ? defaultDeferredRevenueAccount : defaultDeferredExpenseAccount;

  for (const item of items) {
    const hasDeferred = item.enable_deferred_revenue || item.enable_deferred_expense;
    if (!hasDeferred) continue;

    const account = item[field];
    if (!account && !defaultAccount) {
      return `Row ${item.idx}: Please update deferred revenue/expense account in item row or default account in company master`;
    }
  }
  return null;
}

/** Validate company-linked addresses belong to the company. */
export function validateCompanyLinkedAddresses(
  doctype: string,
  company: string,
  items: AccountDocItem[],
  dispatchAddressName?: string,
  companyAddress?: string,
  billingAddress?: string,
  shippingAddress?: string,
  addressCompanyLinks?: AddressLink[]
): string | null {
  const salesDoctypes = ["Quotation", "Sales Order", "Delivery Note", "Sales Invoice"];
  const purchaseDoctypes = [
    "Purchase Order",
    "Purchase Receipt",
    "Purchase Invoice",
    "Supplier Quotation",
  ];

  let addressFields: string[] = [];
  if (salesDoctypes.includes(doctype)) {
    addressFields = ["dispatch_address_name", "company_address"];
  } else if (purchaseDoctypes.includes(doctype)) {
    addressFields = ["billing_address", "shipping_address"];
  }

  if (addressFields.length === 0) return null;

  const isDropShip = ["Purchase Order", "Sales Order", "Sales Invoice"].includes(doctype)
    ? items.some((item) => item.delivered_by_supplier)
    : false;

  const fieldToValue: Record<string, string | undefined> = {
    dispatch_address_name: dispatchAddressName,
    company_address: companyAddress,
    billing_address: billingAddress,
    shipping_address: shippingAddress,
  };

  for (const field of addressFields) {
    const address = fieldToValue[field];
    if (!address) continue;

    if ((field === "dispatch_address_name" || field === "shipping_address") && isDropShip) {
      continue;
    }

    const belongsToCompany = addressCompanyLinks?.some(
      (link) =>
        link.address === address && link.link_doctype === "Company" && link.link_name === company
    );

    if (!belongsToCompany) {
      return `${field} does not belong to the Company ${company}`;
    }
  }

  return null;
}

/** Validate payment schedule due dates (no duplicates, not before transaction date). */
export function validatePaymentScheduleDates(
  doctype: string,
  isPos: boolean | undefined,
  transactionDate: string | undefined,
  paymentSchedule: PaymentScheduleRow[] | undefined
): string | null {
  if (!paymentSchedule || paymentSchedule.length === 0) return null;
  if (doctype === "Sales Invoice" && isPos) return null;

  const dates: string[] = [];
  const duplicates: string[] = [];

  for (const row of paymentSchedule) {
    if (row.discount_date && row.due_date && getdate(row.discount_date) > getdate(row.due_date)) {
      return `Row ${row.idx ?? ""}: Discount Date cannot be after Due Date`;
    }

    if (
      doctype in ["Sales Order", "Quotation"] &&
      transactionDate &&
      row.due_date &&
      getdate(row.due_date) < getdate(transactionDate)
    ) {
      return `Row ${row.idx ?? ""}: Due Date in the Payment Terms table cannot be before Transaction Date`;
    }

    if (dates.includes(row.due_date)) {
      duplicates.push(`${row.due_date} in row ${row.idx ?? ""}`);
    }
    dates.push(row.due_date);
  }

  if (duplicates.length > 0) {
    return `Rows with duplicate due dates found: ${duplicates.join("; ")}`;
  }

  return null;
}

/** Validate payment schedule amounts match the grand total. */
export function validatePaymentScheduleAmount(
  doctype: string,
  isPos: boolean | undefined,
  isOpening: string | undefined,
  grandTotal: number | undefined,
  baseGrandTotal: number | undefined,
  roundedTotal: number | undefined,
  baseRoundedTotal: number | undefined,
  writeOffAmount: number | undefined,
  baseWriteOffAmount: number | undefined,
  totalAdvance: number | undefined,
  conversionRate: number,
  partyAccountCurrency: string | undefined,
  companyCurrency: string | undefined,
  paymentSchedule: PaymentScheduleRow[] | undefined
): string | null {
  if (!paymentSchedule || paymentSchedule.length === 0) return null;
  if (doctype === "Sales Invoice" && isPos) return null;
  if (isOpening === "Yes") return null;

  let total = 0;
  let baseTotal = 0;

  for (const row of paymentSchedule) {
    total += flt(row.payment_amount);
    baseTotal += flt(row.base_payment_amount ?? row.payment_amount * conversionRate);
  }

  let baseGt = flt(baseRoundedTotal ?? baseGrandTotal ?? 0);
  let gt = flt(roundedTotal ?? grandTotal ?? 0);

  if (doctype === "Sales Invoice" || doctype === "Purchase Invoice") {
    baseGt -= flt(baseWriteOffAmount ?? 0);
    gt -= flt(writeOffAmount ?? 0);
  }

  if (totalAdvance && totalAdvance > 0) {
    if (partyAccountCurrency === companyCurrency) {
      baseGt -= totalAdvance;
      gt = flt(baseGt / conversionRate);
    } else {
      gt -= totalAdvance;
      baseGt = flt(gt * conversionRate);
    }
  }

  if (
    Math.abs(flt(total) - flt(gt)) > 0.1 ||
    Math.abs(flt(baseTotal) - flt(baseGt)) > 0.1
  ) {
    return `Total Payment Amount in Payment Schedule must be equal to Grand / Rounded Total`;
  }

  return null;
}

/** Validate invoice document schedule (return, pos, opening rules). */
export function validateInvoiceDocumentsSchedule(
  doc: AccountDoc,
  partyAccountCurrency?: string
): string | null {
  if (
    doc.is_return ||
    (doc.doctype === "Purchase Invoice" && doc.is_paid) ||
    (doc.doctype === "Sales Invoice" && doc.is_pos) ||
    doc.is_opening === "Yes"
  ) {
    // These cases clear the schedule — nothing further to validate
    return null;
  }

  const dateErr = validatePaymentScheduleDates(
    doc.doctype,
    doc.is_pos,
    doc.transaction_date,
    doc.payment_schedule
  );
  if (dateErr) return dateErr;

  const amountErr = validatePaymentScheduleAmount(
    doc.doctype,
    doc.is_pos,
    doc.is_opening,
    doc.grand_total,
    doc.base_grand_total,
    doc.rounded_total,
    doc.base_rounded_total,
    doc.write_off_amount,
    doc.base_write_off_amount,
    doc.total_advance,
    doc.conversion_rate,
    partyAccountCurrency ?? doc.company_currency,
    doc.company_currency,
    doc.payment_schedule
  );
  if (amountErr) return amountErr;

  return null;
}

/** Validate non-invoice document schedule (Orders, Quotations). */
export function validateNonInvoiceDocumentsSchedule(
  doc: AccountDoc,
  partyAccountCurrency?: string
): string | null {
  const dateErr = validatePaymentScheduleDates(
    doc.doctype,
    doc.is_pos,
    doc.transaction_date,
    doc.payment_schedule
  );
  if (dateErr) return dateErr;

  const amountErr = validatePaymentScheduleAmount(
    doc.doctype,
    doc.is_pos,
    doc.is_opening,
    doc.grand_total,
    doc.base_grand_total,
    doc.rounded_total,
    doc.base_rounded_total,
    doc.write_off_amount,
    doc.base_write_off_amount,
    doc.total_advance,
    doc.conversion_rate,
    partyAccountCurrency ?? doc.company_currency,
    doc.company_currency,
    doc.payment_schedule
  );
  if (amountErr) return amountErr;

  return null;
}

/** Dispatch schedule validation based on doctype. */
export function validateAllDocumentsSchedule(
  doc: AccountDoc,
  partyAccountCurrency?: string
): string | null {
  if (doc.doctype === "Sales Invoice" || doc.doctype === "Purchase Invoice") {
    return validateInvoiceDocumentsSchedule(doc, partyAccountCurrency);
  }
  if (doc.doctype === "Quotation" || doc.doctype === "Purchase Order" || doc.doctype === "Sales Order") {
    return validateNonInvoiceDocumentsSchedule(doc, partyAccountCurrency);
  }
  return null;
}

/** Validate tax account belongs to the document company. */
export function validateTaxAccountCompany(
  taxes: TaxRow[] | undefined,
  company: string,
  accountCompanyMap: Record<string, string>
): string | null {
  if (!taxes) return null;

  for (const tax of taxes) {
    if (!tax.account_head) continue;
    const taxAccountCompany = accountCompanyMap[tax.account_head];
    if (taxAccountCompany && taxAccountCompany !== company) {
      return `Row #${tax.idx}: Account ${tax.account_head} does not belong to company ${company}`;
    }
  }
  return null;
}

/** Validate taxes_and_charges template is not disabled. */
export function validateEnabledTaxesAndCharges(
  taxesAndCharges: string | undefined,
  disabledStatusMap: Record<string, boolean>
): string | null {
  if (!taxesAndCharges) return null;
  if (disabledStatusMap[taxesAndCharges]) {
    return `Taxes and Charges Template '${taxesAndCharges}' is disabled`;
  }
  return null;
}

/** Validate account currency is valid for the document. */
export function validateAccountCurrency(
  account: string,
  accountCurrency: string | undefined,
  docCurrency: string,
  companyCurrency: string
): string | null {
  const validCurrencies = [companyCurrency];
  if (docCurrency !== companyCurrency) {
    validCurrencies.push(docCurrency);
  }

  if (accountCurrency && !validCurrencies.includes(accountCurrency)) {
    return `Account ${account} is invalid. Account Currency must be ${validCurrencies.join(" or ")}`;
  }
  return null;
}

/** Validate conversion rate rules. */
export function validateConversionRate(
  currency: string,
  conversionRate: number | undefined,
  companyCurrency: string
): string | null {
  if (!conversionRate) {
    return `Conversion Rate is mandatory`;
  }

  if (currency === companyCurrency && flt(conversionRate) !== 1.0) {
    return `Conversion rate must be 1.00 if document currency is same as company currency`;
  }

  if (currency !== companyCurrency && flt(conversionRate) === 1.0) {
    return `Conversion rate is 1.00, but document currency is different from company currency`;
  }

  return null;
}

/** Validate individual tax row charge_type and row_id consistency. */
export function validateTaxesAndCharges(tax: TaxRow): string | null {
  if (tax.charge_type in ["Actual", "On Net Total", "On Paid Amount"] && tax.row_id) {
    return `Row ${tax.idx}: Can refer row only if the charge type is 'On Previous Row Amount' or 'Previous Row Total'`;
  }

  if (tax.charge_type in ["On Previous Row Amount", "On Previous Row Total"]) {
    if (tax.idx === 1) {
      return `Row ${tax.idx}: Cannot select charge type as 'On Previous Row Amount' or 'On Previous Row Total' for first row`;
    }
    if (!tax.row_id) {
      return `Row ${tax.idx}: Please specify a valid Row ID`;
    }
    if (tax.row_id >= tax.idx) {
      return `Row ${tax.idx}: Cannot refer row number greater than or equal to current row number for this Charge type`;
    }
  }

  if (tax.charge_type === "Actual") {
    // rate should be ignored / set to null in backend
    // no error here, just a logic note
  }

  return null;
}

/** Validate account head belongs to company and is not a group account. */
export function validateAccountHead(
  idx: number,
  account: string,
  company: string,
  accountCompany: string,
  isGroup: boolean,
  context?: string
): string | null {
  if (accountCompany !== company) {
    return `Row ${idx}: The ${context ?? ""} Account ${account} does not belong to the company ${company}`;
  }
  if (isGroup) {
    return `Row ${idx}: You selected the account group ${account} as ${context ?? ""} Account. Please select a single account.`;
  }
  return null;
}

/** Validate cost center belongs to company. */
export function validateCostCenter(
  idx: number,
  costCenter: string | undefined,
  company: string,
  costCenterCompanyMap: Record<string, string>
): string | null {
  if (!costCenter) return null;
  const ccCompany = costCenterCompanyMap[costCenter];
  if (ccCompany && ccCompany !== company) {
    return `Row ${idx}: Cost Center ${costCenter} does not belong to Company ${company}`;
  }
  return null;
}

/** Validate inclusive tax rules. */
export function validateInclusiveTax(
  tax: TaxRow,
  allTaxes: TaxRow[]
): string | null {
  if (!tax.included_in_print_rate) return null;

  if (tax.charge_type === "Actual") {
    return `Charge of type 'Actual' in row ${tax.idx} cannot be included in Item Rate or Paid Amount`;
  }

  if (tax.charge_type === "On Previous Row Amount") {
    const prevTax = allTaxes.find((t) => t.idx === (tax.row_id ?? 0));
    if (prevTax && !prevTax.included_in_print_rate) {
      return `To include tax in row ${tax.idx}, tax in row ${tax.row_id} must also be included`;
    }
  }

  if (tax.charge_type === "On Previous Row Total") {
    const prevTaxes = allTaxes.filter((t) => t.idx < (tax.row_id ?? 0));
    const allPrevIncluded = prevTaxes.every((t) => t.included_in_print_rate);
    if (!allPrevIncluded) {
      return `To include tax in row ${tax.idx}, taxes in rows 1 - ${tax.row_id} must also be included`;
    }
  }

  if (tax.category === "Valuation") {
    return `Valuation type charges can not be marked as Inclusive`;
  }

  return null;
}

/** Validate currency matches party account currency. */
export function validateCurrency(
  docCurrency: string,
  partyAccountCurrency: string | undefined,
  companyCurrency: string
): string | null {
  if (
    partyAccountCurrency &&
    partyAccountCurrency !== companyCurrency &&
    docCurrency !== partyAccountCurrency
  ) {
    return `Accounting Entry can only be made in currency: ${partyAccountCurrency}`;
  }
  return null;
}

/** Validate party account currency matches document currency. */
export function validatePartyAccountCurrency(
  doctype: string,
  isOpening: string | undefined,
  partyAccountCurrency: string | undefined,
  docCurrency: string,
  allowMultiCurrencyAgainstSinglePartyAccount: boolean
): string | null {
  if (doctype !== "Sales Invoice" && doctype !== "Purchase Invoice") return null;
  if (isOpening === "Yes") return null;

  if (
    partyAccountCurrency &&
    partyAccountCurrency !== docCurrency &&
    !allowMultiCurrencyAgainstSinglePartyAccount
  ) {
    return `Party Account currency (${partyAccountCurrency}) and document currency (${docCurrency}) should be same`;
  }
  return null;
}

/** Validate inter-company reference for internal transfers. */
export function validateInterCompanyReference(
  doctype: string,
  isReturn: boolean | undefined,
  isInternalTransfer: boolean,
  interCompanyReference?: string,
  interCompanyInvoiceReference?: string,
  interCompanyOrderReference?: string,
  items?: { idx: number; sales_invoice_item?: string; purchase_invoice_item?: string; sales_order_item?: string; purchase_order_item?: string; delivery_note_item?: string }[]
): string | null {
  if (isReturn) return null;
  if (doctype !== "Purchase Invoice" && doctype !== "Purchase Receipt") return null;
  if (!isInternalTransfer) return null;

  if (
    !interCompanyReference &&
    !interCompanyInvoiceReference &&
    !interCompanyOrderReference
  ) {
    return `Internal Sale or Delivery Reference missing. Please create purchase from internal sale or delivery document itself`;
  }

  if (!items) return null;

  const refField =
    doctype === "Purchase Receipt" ? "delivery_note_item" : "sales_invoice_item";

  for (const item of items) {
    if (!item[refField as keyof typeof item]) {
      return `At Row ${item.idx}: The field ${refField} is mandatory for internal transfer`;
    }
  }

  return null;
}

/** Validate auto-repeat subscription date range. */
export function validateAutoRepeatSubscriptionDates(
  fromDate?: string,
  toDate?: string
): string | null {
  if (fromDate && toDate && getdate(fromDate) > getdate(toDate)) {
    return `To Date cannot be before From Date`;
  }
  return null;
}

/** Validate due date is not before posting/bill date. */
export function validateDueDate(
  doctype: string,
  isPos: boolean | undefined,
  dueDate: string | undefined,
  postingDate: string | undefined,
  billDate?: string
): string | null {
  if (isPos || (doctype !== "Sales Invoice" && doctype !== "Purchase Invoice")) {
    return null;
  }

  const referenceDate = doctype === "Purchase Invoice" ? (billDate ?? postingDate) : postingDate;
  if (dueDate && referenceDate && getdate(dueDate) < getdate(referenceDate)) {
    return `Due Date cannot be before Posting Date`;
  }
  return null;
}

/** Validate advances have valid references. */
export function validateAdvances(
  advances: AdvanceRow[] | undefined,
  doctype: string
): string | null {
  if (!advances || (doctype !== "Sales Invoice" && doctype !== "Purchase Invoice")) {
    return null;
  }

  const invalid = advances.filter((a) => !a.reference_type || !a.reference_name);
  if (invalid.length > 0) {
    return `Rows: ${invalid.map((a) => a.idx).join(", ")} in Advance Payments are Invalid. Reference Name should point to a valid Payment Entry or Journal Entry.`;
  }
  return null;
}

/** Validate base_grand_total >= 0 for non-return documents. */
export function validateGrandTotal(
  baseGrandTotal: number | undefined,
  isReturn: boolean | undefined
): string | null {
  if (!isReturn && (baseGrandTotal ?? 0) < 0) {
    return `Grand Total cannot be negative`;
  }
  return null;
}

/** Validate multiple billing against reference document amounts. */
export function validateMultipleBilling(
  refWiseBilledAmount: Record<string, RefBilledAmount>,
  precision: number,
  isOverbillingAllowed: boolean,
  allowancePercent = 0
): string | null {
  const overbilledItems: RefBilledAmount[] = [];
  let totalOverbilledAmt = 0;
  const precisionAllowance = 1 / 10 ** precision;

  for (const row of Object.values(refWiseBilledAmount)) {
    const maxAllowedAmt = flt(row.ref_amt * (100 + allowancePercent) / 100, precision);

    let billedAmt = row.billed_amt;
    let maxAllowed = maxAllowedAmt;

    if (billedAmt < 0 && maxAllowed < 0) {
      billedAmt = Math.abs(billedAmt);
      maxAllowed = Math.abs(maxAllowed);
    }

    const overbillAmt = billedAmt - maxAllowed;
    row.max_allowed_amt = maxAllowed;
    totalOverbilledAmt += overbillAmt;

    if (overbillAmt > precisionAllowance && !isOverbillingAllowed) {
      overbilledItems.push(row);
    }
  }

  if (overbilledItems.length > 0) {
    const details = overbilledItems
      .map(
        (item) =>
          `Item ${item.item_code} in row(s) ${item.rows.join(", ")} billed more than ${item.max_allowed_amt}`
      )
      .join("; ");
    return `Cannot overbill for the following Items: ${details}`;
  }

  if (isOverbillingAllowed && totalOverbilledAmt > 0.1) {
    // This is a warning, not an error. We return null and let caller handle warnings.
    // Returning as warning string would need a different return type.
    // For now, we just return null — callers can inspect ref data for warnings.
  }

  return null;
}

/** Validate child item on delete (check partially transacted items). */
export function validateChildOnDelete(
  parentDoctype: string,
  row: {
    idx: number;
    item_code: string;
    delivered_qty?: number;
    work_order_qty?: number;
    ordered_qty?: number;
    received_qty?: number;
    billed_amt?: number;
  },
  orderedItemMap?: Record<string, number>
): string | null {
  if (parentDoctype === "Sales Order") {
    if (flt(row.delivered_qty) > 0) {
      return `Row #${row.idx}: Cannot delete item ${row.item_code} which has already been delivered`;
    }
    if (flt(row.work_order_qty) > 0) {
      return `Row #${row.idx}: Cannot delete item ${row.item_code} which has work order assigned to it`;
    }
    if (flt(row.ordered_qty) > 0) {
      return `Row #${row.idx}: Cannot delete item ${row.item_code} which is already ordered against this Sales Order`;
    }
  }

  if (parentDoctype === "Purchase Order" && flt(row.received_qty) > 0) {
    return `Row #${row.idx}: Cannot delete item ${row.item_code} which has already been received`;
  }

  if (
    (parentDoctype === "Purchase Order" || parentDoctype === "Sales Order") &&
    flt(row.billed_amt) > 0
  ) {
    return `Row #${row.idx}: Cannot delete item ${row.item_code} which has already been billed`;
  }

  if (parentDoctype === "Quotation" && orderedItemMap && orderedItemMap[row.item_code]) {
    return `Cannot delete an item which has been ordered`;
  }

  return null;
}

/** Validate quantity and rate update constraints. */
export function validateQuantityAndRate(
  parentDoctype: string,
  childItem: {
    idx: number;
    item_code: string;
    qty: number;
    billed_amt?: number;
    delivered_qty?: number;
    received_qty?: number;
  },
  newData: { qty?: number; rate?: number; idx?: number; item_code?: string },
  allowZeroQty = false,
  orderedQty?: number
): string | null {
  if (!flt(newData.qty) && !allowZeroQty) {
    return `Row #${newData.idx ?? childItem.idx}: Quantity for Item ${newData.item_code ?? childItem.item_code} cannot be zero`;
  }

  const qtyLimits: Record<string, [string, string]> = {
    "Sales Order": ["delivered_qty", "Cannot set quantity less than delivered quantity"],
    "Purchase Order": ["received_qty", "Cannot set quantity less than received quantity"],
  };

  if (parentDoctype in qtyLimits) {
    const [qtyField, errorMsg] = qtyLimits[parentDoctype];
    const currentQty = flt(newData.qty);
    const limitQty = flt(childItem[qtyField as keyof typeof childItem] as number);
    if (currentQty < limitQty) {
      return `Row #${newData.idx ?? childItem.idx}: ${errorMsg}`;
    }
  }

  if (
    (parentDoctype === "Quotation" || parentDoctype === "Supplier Quotation") &&
    orderedQty &&
    orderedQty > 0
  ) {
    if (flt(newData.rate) !== undefined && flt(newData.rate) !== childItem.qty) {
      // rate changed
      return `Cannot update rate as item ${newData.item_code} is already ordered or purchased against this quotation`;
    }
    if (flt(newData.qty) < orderedQty) {
      return `Cannot reduce quantity than ordered or purchased quantity`;
    }
  }

  return null;
}

/** Validate supplier block status (pure: caller passes status). */
export function validateSupplierBlockStatus(
  supplierName: string,
  onHold: boolean,
  holdType: string,
  releaseDate: string | undefined,
  currentDate: string,
  isBuyingInvoice: boolean,
  isSupplierPayment: boolean
): string | null {
  if (!onHold) return null;

  const blocksTransaction =
    (isBuyingInvoice && ["All", "Invoices"].includes(holdType)) ||
    (isSupplierPayment && ["All", "Payments"].includes(holdType));

  if (!blocksTransaction) return null;

  if (!releaseDate || getdate(currentDate) <= getdate(releaseDate)) {
    return `${supplierName} is blocked so this transaction cannot proceed`;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Main orchestrator                                                  */
/* ------------------------------------------------------------------ */

export interface ValidateAccountDocOptions {
  fiscalYearRange?: FiscalYearRange;
  originalReturnAgainstAccount?: string;
  defaultDeferredRevenueAccount?: string;
  defaultDeferredExpenseAccount?: string;
  addressCompanyLinks?: AddressLink[];
  partyAccountCurrency?: string;
  accountCompanyMap?: Record<string, string>;
  taxesAndChargesDisabledMap?: Record<string, boolean>;
  costCenterCompanyMap?: Record<string, string>;
  allowMultiCurrencyAgainstSinglePartyAccount?: boolean;
  isInternalTransfer?: boolean;
  supplierBlockStatus?: {
    onHold: boolean;
    holdType: string;
    releaseDate?: string;
  };
  currentDate?: string;
}

export function validateAccountDoc(
  doc: AccountDoc,
  options: ValidateAccountDocOptions = {}
): ValidationResult {
  const warnings: string[] = [];

  try {
    // 1. Qty must not be zero for non-return docs
    const qtyErr = validateQtyIsNotZero(
      doc.items,
      false,
      doc.is_return,
      doc.doctype
    );
    if (qtyErr) return { success: false, error: qtyErr };

    // 2. Zero qty for return invoices with stock
    const returnStockErr = validateZeroQtyForReturnInvoicesWithStock(
      doc.items,
      !!doc.is_return,
      doc.doctype === "Sales Invoice" || doc.doctype === "Purchase Invoice"
        ? undefined
        : false
    );
    if (returnStockErr) return { success: false, error: returnStockErr };

    // 3. Validate date with fiscal year
    const dateField = doc.posting_date ?? doc.transaction_date;
    if (dateField && doc.fiscal_year && options.fiscalYearRange) {
      const fyErr = validateDateWithFiscalYear(
        dateField,
        doc.fiscal_year,
        options.fiscalYearRange
      );
      if (fyErr) return { success: false, error: fyErr };
    }

    // 4. Validate party accounts (income vs party account must differ)
    const partyAccountErr = validatePartyAccounts(doc);
    if (partyAccountErr) return { success: false, error: partyAccountErr };

    // 5. Validate return against account
    if (options.originalReturnAgainstAccount !== undefined) {
      const crDrField = doc.doctype === "Sales Invoice" ? "debit_to" : "credit_to";
      const currentAccount = doc[crDrField as keyof AccountDoc] as string | undefined;
      const returnAgainstErr = validateReturnAgainstAccount(
        doc.doctype,
        doc.is_return,
        doc.return_against,
        currentAccount,
        options.originalReturnAgainstAccount
      );
      if (returnAgainstErr) return { success: false, error: returnAgainstErr };
    }

    // 6. Validate deferred revenue / expense dates
    const deferredErr = validateDeferredDates(
      doc.items,
      doc.posting_date,
      doc.transaction_date
    );
    if (deferredErr) return { success: false, error: deferredErr };

    // 7. Validate deferred accounts exist
    const deferredAccountErr = validateDeferredIncomeExpenseAccount(
      doc.doctype,
      doc.items,
      options.defaultDeferredRevenueAccount,
      options.defaultDeferredExpenseAccount
    );
    if (deferredAccountErr) return { success: false, error: deferredAccountErr };

    // 8. Validate grand_total >= 0 for non-returns
    const grandTotalErr = validateGrandTotal(doc.base_grand_total, doc.is_return);
    if (grandTotalErr) return { success: false, error: grandTotalErr };

    // 9. Validate all document schedule
    const scheduleErr = validateAllDocumentsSchedule(doc, options.partyAccountCurrency);
    if (scheduleErr) return { success: false, error: scheduleErr };

    // 10. Validate advances have references
    const advancesErr = validateAdvances(doc.advances, doc.doctype);
    if (advancesErr) return { success: false, error: advancesErr };

    // 11. Validate currency / conversion rate
    if (!doc.currency) {
      return { success: false, error: "Currency is required" };
    }
    const conversionRateErr = validateConversionRate(
      doc.currency,
      doc.conversion_rate,
      doc.company_currency ?? doc.currency
    );
    if (conversionRateErr) return { success: false, error: conversionRateErr };

    // 12. Validate party account currency
    const partyAccountCurrencyErr = validatePartyAccountCurrency(
      doc.doctype,
      doc.is_opening,
      options.partyAccountCurrency,
      doc.currency,
      !!options.allowMultiCurrencyAgainstSinglePartyAccount
    );
    if (partyAccountCurrencyErr) return { success: false, error: partyAccountCurrencyErr };

    // 13. Validate tax account company
    if (options.accountCompanyMap && doc.taxes) {
      const taxCompanyErr = validateTaxAccountCompany(
        doc.taxes,
        doc.company,
        options.accountCompanyMap
      );
      if (taxCompanyErr) return { success: false, error: taxCompanyErr };
    }

    // 14. Validate taxes_and_charges not disabled
    if (options.taxesAndChargesDisabledMap && doc.taxes) {
      const taxDisabledErr = validateEnabledTaxesAndCharges(
        doc.taxes[0]?.account_head,
        options.taxesAndChargesDisabledMap
      );
      if (taxDisabledErr) return { success: false, error: taxDisabledErr };
    }

    // 15. Validate individual tax rows
    if (doc.taxes) {
      for (const tax of doc.taxes) {
        const taxErr = validateTaxesAndCharges(tax);
        if (taxErr) return { success: false, error: taxErr };

        const inclusiveErr = validateInclusiveTax(tax, doc.taxes);
        if (inclusiveErr) return { success: false, error: inclusiveErr };

        if (options.costCenterCompanyMap) {
          const ccErr = validateCostCenter(
            tax.idx,
            tax.cost_center,
            doc.company,
            options.costCenterCompanyMap
          );
          if (ccErr) return { success: false, error: ccErr };
        }
      }
    }

    // 16. Validate company-linked addresses
    const addressErr = validateCompanyLinkedAddresses(
      doc.doctype,
      doc.company,
      doc.items,
      doc.dispatch_address_name,
      doc.company_address,
      doc.billing_address,
      doc.shipping_address,
      options.addressCompanyLinks
    );
    if (addressErr) return { success: false, error: addressErr };

    // 17. Validate due date
    const dueDateErr = validateDueDate(
      doc.doctype,
      doc.is_pos,
      doc.payment_schedule?.[0]?.due_date,
      doc.posting_date,
      undefined // bill_date not in AccountDoc interface yet
    );
    if (dueDateErr) return { success: false, error: dueDateErr };

    // 18. Validate inter-company reference
    const interCompanyErr = validateInterCompanyReference(
      doc.doctype,
      doc.is_return,
      !!options.isInternalTransfer,
      doc.inter_company_reference,
      doc.inter_company_invoice_reference,
      doc.inter_company_order_reference,
      doc.items.map((item) => ({
        idx: item.idx,
        sales_invoice_item: undefined,
        purchase_invoice_item: undefined,
        sales_order_item: undefined,
        purchase_order_item: undefined,
        delivery_note_item: undefined,
      }))
    );
    if (interCompanyErr) return { success: false, error: interCompanyErr };

    // 19. Validate auto-repeat dates
    const autoRepeatErr = validateAutoRepeatSubscriptionDates(
      doc.transaction_date,
      doc.posting_date
    );
    if (autoRepeatErr) return { success: false, error: autoRepeatErr };

    // 20. Validate supplier blocked
    if (options.supplierBlockStatus && options.currentDate) {
      const isBuyingInvoice = doc.doctype === "Purchase Invoice";
      const isSupplierPayment = doc.doctype === "Payment Entry" && doc.supplier !== undefined;
      if (doc.supplier && (isBuyingInvoice || isSupplierPayment)) {
        const blockErr = validateSupplierBlockStatus(
          doc.supplier,
          options.supplierBlockStatus.onHold,
          options.supplierBlockStatus.holdType,
          options.supplierBlockStatus.releaseDate,
          options.currentDate,
          isBuyingInvoice,
          isSupplierPayment
        );
        if (blockErr) return { success: false, error: blockErr };
      }
    }

    return { success: true, warnings };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  GL Entry builders (pure)                                           */
/* ------------------------------------------------------------------ */

export function buildGLEntries(doc: AccountDoc): SubmitResult["gl_entries"] {
  const entries: NonNullable<SubmitResult["gl_entries"]> = [];

  if (doc.doctype === "Sales Invoice") {
    for (const item of doc.items) {
      entries.push({
        account: item.income_account ?? "Sales",
        debit: 0,
        credit: flt(item.amount, 2),
        cost_center: item.cost_center,
        remarks: `Sales Invoice ${doc.name ?? ""}`,
      });
    }
    entries.push({
      account: doc.debit_to ?? "Debtors",
      debit: flt(doc.grand_total, 2),
      credit: 0,
      remarks: `Sales Invoice ${doc.name ?? ""}`,
    });
  } else if (doc.doctype === "Purchase Invoice") {
    for (const item of doc.items) {
      entries.push({
        account: item.expense_account ?? "Purchase",
        debit: flt(item.amount, 2),
        credit: 0,
        cost_center: item.cost_center,
        remarks: `Purchase Invoice ${doc.name ?? ""}`,
      });
    }
    entries.push({
      account: doc.credit_to ?? "Creditors",
      debit: 0,
      credit: flt(doc.grand_total, 2),
      remarks: `Purchase Invoice ${doc.name ?? ""}`,
    });
  }

  return entries;
}

export function onSubmitAccountDoc(doc: AccountDoc): SubmitResult {
  try {
    // 1. Re-validate
    const validation = validateAccountDoc(doc);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    // 2. Check GL entries balance
    const glEntries = buildGLEntries(doc);
    if (!glEntries) {
      return { success: false, error: "No GL entries generated" };
    }
    const totalDebit = glEntries.reduce((sum, e) => sum + flt(e.debit), 0);
    const totalCredit = glEntries.reduce((sum, e) => sum + flt(e.credit), 0);

    if (flt(totalDebit, 2) !== flt(totalCredit, 2)) {
      return {
        success: false,
        error: `GL Entries are not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`,
      };
    }

    return { success: true, gl_entries: glEntries };
  } catch (error) {
    return { success: false, error: errorMessage(error) ?? String(error) };
  }
}
