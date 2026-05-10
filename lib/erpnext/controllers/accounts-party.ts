/**
 * Ported from erpnext/accounts/party.py
 * Pure business logic for party-related utilities.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

export const PURCHASE_TRANSACTION_TYPES: ReadonlySet<string> = new Set([
  "Supplier Quotation",
  "Purchase Order",
  "Purchase Receipt",
  "Purchase Invoice",
]);

export const SALES_TRANSACTION_TYPES: ReadonlySet<string> = new Set([
  "Quotation",
  "Sales Order",
  "Delivery Note",
  "Sales Invoice",
  "POS Invoice",
]);

export const TRANSACTION_TYPES: ReadonlySet<string> = new Set([
  ...PURCHASE_TRANSACTION_TYPES,
  ...SALES_TRANSACTION_TYPES,
]);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PartyAccount {
  company: string;
  account: string;
  advance_account?: string;
}

export interface SalesTeamMember {
  sales_person: string;
  allocated_percentage?: number | null;
  commission_rate?: number;
}

export interface PaymentTerm {
  due_date_based_on: "Day(s) after invoice date" | "Day(s) after the end of the invoice month" | "Month(s) after the end of the invoice month";
  credit_days: number;
  credit_months: number;
}

export interface PaymentTermsTemplate {
  name: string;
  terms: PaymentTerm[];
}

export interface Address {
  name: string;
  is_shipping_address?: number;
  address_type?: string;
  disabled?: number;
  tax_category?: string | null;
}

export interface ContactInfo {
  contact_person?: string | null;
  contact_display?: string | null;
  contact_email?: string | null;
  contact_mobile?: string | null;
  contact_phone?: string | null;
  contact_designation?: string | null;
  contact_department?: string | null;
}

export interface CompanyDefaults {
  default_receivable_account?: string;
  default_payable_account?: string;
  default_advance_received_account?: string;
  default_advance_paid_account?: string;
  default_currency?: string;
  payment_terms?: string;
  role_allowed_for_frozen_entries?: string;
  tax_category?: string | null;
  determine_address_tax_category_from?: "Billing Address" | "Shipping Address";
}

export interface Party {
  name: string;
  doctype?: string;
  default_currency?: string;
  customer_name?: string;
  customer_group?: string;
  supplier_name?: string;
  supplier_group?: string;
  territory?: string;
  language?: string;
  tax_withholding_category?: string;
  tax_withholding_group?: string;
  tax_category?: string;
  disabled?: boolean;
  is_frozen?: boolean;
  sales_team?: SalesTeamMember[];
  default_price_list?: string;
  default_sales_partner?: string;
  default_commission_rate?: number;
  accounts?: PartyAccount[];
  payment_terms?: string;
}

export interface PartyDetails {
  customer?: string;
  supplier?: string;
  lead?: string;
  prospect?: string;
  employee?: string;
  student?: string;
  shareholder?: string;

  debit_to?: string;
  credit_to?: string;
  due_date?: string | null;

  customer_address?: string;
  supplier_address?: string;
  employee_address?: string;
  shipping_address_name?: string;
  dispatch_address?: string;

  address_display?: string;
  shipping_address?: string;
  dispatch_address_display?: string;

  company_address?: string;
  company_address_display?: string;
  billing_address?: string;
  billing_address_display?: string;

  contact_person?: string | null;
  contact_display?: string | null;
  contact_email?: string | null;
  contact_mobile?: string | null;
  contact_phone?: string | null;
  contact_designation?: string | null;
  contact_department?: string | null;

  customer_group?: string;
  supplier_group?: string;
  territory?: string;
  language?: string;
  tax_withholding_category?: string;
  tax_withholding_group?: string;
  tax_category?: string | null;

  currency?: string;
  price_list_currency?: string | null;
  selling_price_list?: string | null;
  buying_price_list?: string | null;
  sales_partner?: string;
  commission_rate?: number;

  taxes_and_charges?: string | null;
  payment_terms_template?: string | null;

  sales_team?: SalesTeamMember[];

  [key: string]: string | number | boolean | null | undefined | object;
}

export interface TaxRuleArgs {
  tax_type: "Sales" | "Purchase";
  company?: string;
  customer?: string | null;
  supplier?: string | null;
  customer_group?: string | null;
  supplier_group?: string | null;
  tax_category?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  use_for_shopping_cart?: number | null;
  [key: string]: unknown;
}

export interface GetTaxTemplateFn {
  (postingDate: string | Date | null | undefined, args: TaxRuleArgs): string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cint(value: number | string | undefined | boolean): number {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") return Math.trunc(value);
  return parseInt(value ?? "0", 10);
}

function getDate(d: string | Date | null | undefined): Date {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  return new Date(d);
}

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function getLastDay(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return result;
}

function dateDiff(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / msPerDay);
}

function scrub(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "_");
}

/* ------------------------------------------------------------------ */
/*  set_account_and_due_date                                           */
/* ------------------------------------------------------------------ */

export function setAccountAndDueDate(
  party: string,
  account: string | undefined,
  partyType: string,
  company: string | null | undefined,
  postingDate: string | Date | null | undefined,
  billDate: string | Date | null | undefined,
  doctype: string | null | undefined
): Record<string, string | null | undefined> {
  const invoiceDoctypes = ["POS Invoice", "Sales Invoice", "Purchase Invoice"];
  if (!invoiceDoctypes.includes(doctype ?? "")) {
    return { [scrub(partyType)]: party };
  }

  const accountFieldname = partyType === "Customer" ? "debit_to" : "credit_to";
  return {
    [scrub(partyType)]: party,
    [accountFieldname]: account,
    due_date: getDueDate(postingDate, partyType, party, company, billDate),
  };
}

/* ------------------------------------------------------------------ */
/*  get_party_details                                                  */
/* ------------------------------------------------------------------ */

export interface GetPartyDetailsOptions {
  account?: string;
  postingDate?: string | Date | null;
  billDate?: string | Date | null;
  priceList?: string | null;
  currency?: string | null;
  doctype?: string | null;
  partyAddress?: string | null;
  companyAddress?: string | null;
  shippingAddress?: string | null;
  dispatchAddress?: string | null;
  posProfile?: string | null;
  fetchPaymentTermsTemplate?: boolean;
  ignorePermissions?: boolean;
}

export interface GetPartyDetailsDeps {
  party: Party;
  companyDefaults: CompanyDefaults;
  taxTemplateFn?: GetTaxTemplateFn;
  permittedPriceLists?: string[];
  posProfilePriceList?: string | null;
  posProfileTaxCategory?: string | null;
  defaultContact?: string | null;
  contactDetails?: ContactInfo | null;
  companyAddress?: { company_address?: string; company_address_display?: string };
  addressTaxCategoryFn?: (addressName: string) => string | null;
  getFetchValues?: (doctype: string, fieldname: string, value: string) => Record<string, unknown>;
  getDefaultAddress?: (partyType: string, partyName: string) => string | null;
  getPartyShippingAddress?: (partyType: string, partyName: string) => string | null;
  renderAddress?: (addressName: string | null, checkPermissions: boolean) => string;
  getRegionalAddressDetails?: (partyDetails: PartyDetails, doctype: string, company: string) => void;
}

export function getPartyDetails(
  partyName: string | null | undefined,
  partyType: string,
  company: string | null | undefined,
  options: GetPartyDetailsOptions = {},
  deps: GetPartyDetailsDeps
): PartyDetails {
  if (!partyName) {
    return {};
  }

  const {
    account,
    postingDate,
    billDate,
    priceList,
    currency: currencyArg,
    doctype,
    partyAddress,
    companyAddress,
    shippingAddress,
    dispatchAddress,
    posProfile,
    fetchPaymentTermsTemplate = true,
  } = options;

  const partyDetails: PartyDetails = {
    ...setAccountAndDueDate(
      partyName,
      account,
      partyType,
      company,
      postingDate,
      billDate,
      doctype
    ),
  };

  partyDetails[scrub(partyType)] = partyName;

  const party = deps.party;

  const currency = party.default_currency || currencyArg || deps.companyDefaults.default_currency;

  const [resolvedPartyAddress, resolvedShippingAddress] = setAddressDetails(
    partyDetails,
    party,
    partyType,
    doctype,
    company,
    partyAddress,
    companyAddress,
    shippingAddress,
    dispatchAddress,
    deps
  );

  // Set contact details
  if (deps.defaultContact) {
    partyDetails.contact_person = deps.defaultContact;
  }
  if (deps.contactDetails) {
    partyDetails.contact_display = deps.contactDetails.contact_display ?? null;
    partyDetails.contact_email = deps.contactDetails.contact_email ?? null;
    partyDetails.contact_mobile = deps.contactDetails.contact_mobile ?? null;
    partyDetails.contact_phone = deps.contactDetails.contact_phone ?? null;
    partyDetails.contact_designation = deps.contactDetails.contact_designation ?? null;
    partyDetails.contact_department = deps.contactDetails.contact_department ?? null;
  }

  // Set other values
  const toCopy = ["tax_withholding_category", "tax_withholding_group", "language"];
  if (partyType === "Customer") {
    toCopy.push("customer_name", "customer_group", "territory");
  } else {
    toCopy.push("supplier_name", "supplier_group");
  }
  for (const f of toCopy) {
    const val = party[f as keyof Party];
    if (val !== undefined) {
      partyDetails[f] = val as string;
    }
  }

  for (const f of ["currency", "sales_partner", "commission_rate"] as const) {
    const fieldKey = f === "currency" ? "default_currency" : `default_${f}`;
    const val = party[fieldKey as keyof Party];
    if (val !== undefined) {
      (partyDetails as Record<string, unknown>)[f] = val;
    }
  }

  // Price list
  let resolvedPriceList: string | null = priceList ?? null;
  const permitted = deps.permittedPriceLists;
  if (permitted && permitted.length === 1) {
    resolvedPriceList = permitted[0];
  } else if (posProfile && partyType === "Customer") {
    resolvedPriceList =
      party.default_price_list || deps.posProfilePriceList || priceList || null;
  } else {
    resolvedPriceList = party.default_price_list || priceList || null;
  }

  if (resolvedPriceList) {
    // price_list_currency would need a lookup; kept as optional param
    partyDetails.price_list_currency = currency ?? null;
  }
  if (resolvedPriceList === null) {
    partyDetails.price_list_currency = null;
  }
  partyDetails[party.doctype === "Customer" ? "selling_price_list" : "buying_price_list"] =
    resolvedPriceList ?? null;

  // Taxes
  if (deps.taxTemplateFn) {
    const taxTemplate = setTaxes(
      party.name,
      partyType,
      postingDate,
      company,
      partyDetails.customer_group,
      partyDetails.supplier_group,
      partyDetails.tax_category,
      resolvedPartyAddress,
      resolvedShippingAddress,
      deps.taxTemplateFn
    );
    if (taxTemplate) {
      partyDetails.taxes_and_charges = taxTemplate;
    }
  }

  // Payment terms
  if (cint(fetchPaymentTermsTemplate)) {
    partyDetails.payment_terms_template = getPaymentTermsTemplate(
      party.name,
      partyType,
      company,
      deps.companyDefaults
    );
  }

  if (!partyDetails.currency) {
    partyDetails.currency = currency ?? undefined;
  }

  // Sales team
  if (partyType === "Customer" && party.sales_team) {
    partyDetails.sales_team = party.sales_team.map((d) => ({
      sales_person: d.sales_person,
      allocated_percentage: d.allocated_percentage ?? null,
      commission_rate: d.commission_rate,
    }));
  }

  if (!partyDetails.tax_category && posProfile) {
    partyDetails.tax_category = deps.posProfileTaxCategory ?? undefined;
  }

  return partyDetails;
}

/* ------------------------------------------------------------------ */
/*  set_address_details                                                */
/* ------------------------------------------------------------------ */

export function setAddressDetails(
  partyDetails: PartyDetails,
  party: Party,
  partyType: string,
  doctype: string | null | undefined,
  company: string | null | undefined,
  partyAddress: string | null | undefined,
  companyAddress: string | null | undefined,
  shippingAddress: string | null | undefined,
  dispatchAddress: string | null | undefined,
  deps: GetPartyDetailsDeps
): [string | null, string | null] {
  // Party billing
  const partyBillingField =
    partyType === "Lead" || partyType === "Prospect"
      ? "customer_address"
      : `${scrub(partyType)}_address`;

  const defaultPartyAddress = deps.getDefaultAddress
    ? deps.getDefaultAddress(partyType, party.name)
    : null;
  partyDetails[partyBillingField] = partyAddress || defaultPartyAddress || undefined;

  if (doctype && partyDetails[partyBillingField] && deps.getFetchValues) {
    Object.assign(
      partyDetails,
      deps.getFetchValues(doctype, partyBillingField, partyDetails[partyBillingField] as string)
    );
  }

  partyDetails.address_display = deps.renderAddress
    ? deps.renderAddress((partyDetails[partyBillingField] as string | null) ?? null, true)
    : "";

  // Party shipping
  let partyShippingField: string;
  let partyShippingDisplay: string;
  let defaultShipping: string | null | undefined;

  if (partyType === "Customer" || partyType === "Lead") {
    partyShippingField = "shipping_address_name";
    partyShippingDisplay = "shipping_address";
    defaultShipping = shippingAddress;
  } else {
    partyShippingField = "dispatch_address";
    partyShippingDisplay = "dispatch_address_display";
    defaultShipping = dispatchAddress;
  }

  const shippingAddr =
    defaultShipping || (deps.getPartyShippingAddress
      ? deps.getPartyShippingAddress(partyType, party.name)
      : null);
  partyDetails[partyShippingField] = shippingAddr || undefined;
  partyDetails[partyShippingDisplay] = deps.renderAddress
    ? deps.renderAddress((partyDetails[partyShippingField] as string | null) ?? null, true)
    : "";

  if (doctype && partyDetails[partyShippingField] && deps.getFetchValues) {
    Object.assign(
      partyDetails,
      deps.getFetchValues(doctype, partyShippingField, partyDetails[partyShippingField] as string)
    );
  }

  // Company address
  if (companyAddress) {
    partyDetails.company_address = companyAddress;
  } else if (deps.companyAddress) {
    partyDetails.company_address = deps.companyAddress.company_address;
    partyDetails.company_address_display = deps.companyAddress.company_address_display;
  }

  if (doctype && SALES_TRANSACTION_TYPES.has(doctype) && partyDetails.company_address && deps.getFetchValues) {
    Object.assign(
      partyDetails,
      deps.getFetchValues(doctype, "company_address", partyDetails.company_address)
    );
  }

  if (doctype && PURCHASE_TRANSACTION_TYPES.has(doctype)) {
    if (shippingAddress) {
      partyDetails.shipping_address = shippingAddress;
      partyDetails.shipping_address_display = deps.renderAddress
        ? deps.renderAddress(shippingAddress, true)
        : "";
      if (deps.getFetchValues) {
        Object.assign(
          partyDetails,
          deps.getFetchValues(doctype, "shipping_address", shippingAddress)
        );
      }
    }

    if (partyDetails.company_address) {
      partyDetails.billing_address = partyDetails.company_address;
      partyDetails.billing_address_display =
        partyDetails.company_address_display ||
        (deps.renderAddress
          ? deps.renderAddress(partyDetails.company_address, false)
          : "");
      if (deps.getFetchValues) {
        Object.assign(
          partyDetails,
          deps.getFetchValues(doctype, "billing_address", partyDetails.company_address)
        );
      }

      if (!partyDetails.shipping_address) {
        partyDetails.shipping_address = partyDetails.billing_address;
        partyDetails.shipping_address_display = partyDetails.billing_address_display;
        if (deps.getFetchValues) {
          Object.assign(
            partyDetails,
            deps.getFetchValues(doctype, "shipping_address", partyDetails.billing_address)
          );
        }
      }
    }
  }

  const partyBilling = partyDetails[partyBillingField] as string | undefined;
  const partyShipping = partyDetails[partyShippingField] as string | undefined;

  partyDetails.tax_category = getAddressTaxCategory(
    party.tax_category,
    partyBilling ?? null,
    partyShipping ?? null,
    deps.addressTaxCategoryFn,
    deps.companyDefaults
  ) ?? null;

  if (doctype && TRANSACTION_TYPES.has(doctype) && deps.getRegionalAddressDetails && company) {
    deps.getRegionalAddressDetails(partyDetails, doctype, company);
  }

  return [partyBilling ?? null, partyShipping ?? null];
}

/* ------------------------------------------------------------------ */
/*  get_party_account                                                  */
/* ------------------------------------------------------------------ */

export interface GetPartyAccountDeps {
  partyAccounts?: PartyAccount[];
  groupAccounts?: PartyAccount[];
  companyDefaults: CompanyDefaults;
  existingGleCurrency?: string | null;
  existingGleAccount?: string | null;
  partyGroupDoctype?: string;
  accountCurrency?: string | null;
  partyTypeAccountType?: string | null;
}

export function getPartyAccount(
  partyType: string,
  party: string | null | undefined,
  company: string | null | undefined,
  deps: GetPartyAccountDeps,
  includeAdvance: boolean = false
): string | string[] | null {
  if (!partyType) {
    throw new Error("Party Type is mandatory");
  }
  if (!company) {
    throw new Error("Please select a Company");
  }

  if (!party && (partyType === "Customer" || partyType === "Supplier")) {
    const defaultAccountName =
      partyType === "Customer" ? "default_receivable_account" : "default_payable_account";
    return deps.companyDefaults[defaultAccountName as keyof CompanyDefaults] ?? null;
  }

  let account: string | null = null;

  if (deps.partyAccounts) {
    const pa = deps.partyAccounts.find((a) => a.company === company);
    if (pa) account = pa.account;
  }

  if (!account && (partyType === "Customer" || partyType === "Supplier")) {
    if (deps.groupAccounts) {
      const ga = deps.groupAccounts.find((a) => a.company === company);
      if (ga) account = ga.account;
    }
  }

  if (!account && (partyType === "Customer" || partyType === "Supplier")) {
    const defaultAccountName =
      partyType === "Customer" ? "default_receivable_account" : "default_payable_account";
    account = deps.companyDefaults[defaultAccountName as keyof CompanyDefaults] ?? null;
  }

  const gleCurrency = deps.existingGleCurrency;
  if (gleCurrency) {
    const acctCurrency = deps.accountCurrency;
    if ((account && acctCurrency !== gleCurrency) || !account) {
      account = deps.existingGleAccount ?? account;
    }
  }

  if (!account && deps.partyTypeAccountType) {
    const defaultAccountName = `default_${deps.partyTypeAccountType.toLowerCase()}_account`;
    account = deps.companyDefaults[defaultAccountName as keyof CompanyDefaults] ?? null;
  }

  if (includeAdvance && (partyType === "Customer" || partyType === "Supplier" || partyType === "Student")) {
    const advanceAccount = getPartyAdvanceAccount(partyType, company, deps);
    if (advanceAccount) {
      return account ? [account, advanceAccount] : [advanceAccount];
    }
    return account ? [account] : [];
  }

  return account;
}

/* ------------------------------------------------------------------ */
/*  get_party_advance_account                                          */
/* ------------------------------------------------------------------ */

export function getPartyAdvanceAccount(
  partyType: string,
  company: string,
  deps: GetPartyAccountDeps
): string | null {
  if (deps.partyAccounts) {
    const pa = deps.partyAccounts.find((a) => a.company === company && a.advance_account);
    if (pa && pa.advance_account) return pa.advance_account;
  }

  if (deps.groupAccounts) {
    const ga = deps.groupAccounts.find((a) => a.company === company && a.advance_account);
    if (ga && ga.advance_account) return ga.advance_account;
  }

  const accountName =
    partyType === "Customer"
      ? "default_advance_received_account"
      : "default_advance_paid_account";
  return deps.companyDefaults[accountName as keyof CompanyDefaults] ?? null;
}

/* ------------------------------------------------------------------ */
/*  get_party_account_currency                                         */
/* ------------------------------------------------------------------ */

export function getPartyAccountCurrency(
  partyType: string,
  party: string | null | undefined,
  company: string | null | undefined,
  deps: GetPartyAccountDeps,
  accountCurrencyMap: Record<string, string>
): string | null {
  const partyAccount = getPartyAccount(partyType, party, company, deps);
  if (!partyAccount || Array.isArray(partyAccount)) return null;
  return accountCurrencyMap[partyAccount] ?? null;
}

/* ------------------------------------------------------------------ */
/*  get_due_date                                                       */
/* ------------------------------------------------------------------ */

export interface GetDueDateDeps {
  paymentTermsTemplates?: Record<string, PaymentTermsTemplate>;
  partyPaymentTermsTemplate?: string | null;
  groupPaymentTermsTemplate?: string | null;
}

export function getDueDate(
  postingDate: string | Date | null | undefined,
  partyType: string | null | undefined,
  party: string | null | undefined,
  company: string | null | undefined,
  billDate: string | Date | null | undefined = null,
  templateName: string | null | undefined = null,
  deps?: GetDueDateDeps
): string | null {
  if (!(billDate || postingDate) || !party) {
    return null;
  }

  let dueDate: Date = getDate(billDate || postingDate);

  if (!templateName && deps) {
    templateName =
      deps.partyPaymentTermsTemplate ||
      (partyType === "Supplier" ? deps.groupPaymentTermsTemplate : null) ||
      null;
  }

  if (templateName && deps?.paymentTermsTemplates?.[templateName]) {
    dueDate = getDueDateFromTemplate(deps.paymentTermsTemplates[templateName], postingDate, billDate);
  }

  if (getDate(dueDate) < getDate(postingDate)) {
    dueDate = getDate(postingDate);
  }

  return formatDate(dueDate);
}

/* ------------------------------------------------------------------ */
/*  get_due_date_from_template                                         */
/* ------------------------------------------------------------------ */

export function getDueDateFromTemplate(
  template: PaymentTermsTemplate,
  postingDate: string | Date | null | undefined,
  billDate: string | Date | null | undefined
): Date {
  let dueDate = getDate(billDate || postingDate);

  for (const term of template.terms) {
    if (term.due_date_based_on === "Day(s) after invoice date") {
      dueDate = new Date(Math.max(dueDate.getTime(), addDays(dueDate, term.credit_days).getTime()));
    } else if (term.due_date_based_on === "Day(s) after the end of the invoice month") {
      dueDate = new Date(
        Math.max(dueDate.getTime(), addDays(getLastDay(dueDate), term.credit_days).getTime())
      );
    } else {
      dueDate = new Date(
        Math.max(
          dueDate.getTime(),
          getLastDay(addMonths(dueDate, term.credit_months)).getTime()
        )
      );
    }
  }
  return dueDate;
}

/* ------------------------------------------------------------------ */
/*  validate_due_date                                                  */
/* ------------------------------------------------------------------ */

export interface ValidateDueDateDeps {
  paymentTermsTemplates?: Record<string, PaymentTermsTemplate>;
  creditControllerRoles?: string[];
  userRoles?: string[];
}

export function validateDueDate(
  postingDate: string | Date,
  dueDate: string | Date,
  billDate: string | Date | null | undefined = null,
  templateName: string | null | undefined = null,
  doctype: string | null | undefined = null,
  deps?: ValidateDueDateDeps
): { valid: boolean; error?: string; warning?: string } {
  if (getDate(dueDate) < getDate(postingDate)) {
    let doctypeDate = "Date";
    if (doctype === "Purchase Invoice") doctypeDate = "Supplier Invoice Date";
    if (doctype === "Sales Invoice") doctypeDate = "Posting Date";
    return { valid: false, error: `Due Date cannot be before ${doctypeDate}` };
  }

  const templateCheck = validateDueDateWithTemplate(
    postingDate,
    dueDate,
    billDate,
    templateName,
    doctype,
    deps
  );
  if (templateCheck.warning) {
    return { valid: true, warning: templateCheck.warning };
  }
  if (templateCheck.error) {
    return { valid: false, error: templateCheck.error };
  }
  return { valid: true };
}

function validateDueDateWithTemplate(
  postingDate: string | Date,
  dueDate: string | Date,
  billDate: string | Date | null | undefined,
  templateName: string | null | undefined,
  doctype: string | null | undefined,
  deps?: ValidateDueDateDeps
): { warning?: string; error?: string } {
  if (!templateName || !deps?.paymentTermsTemplates?.[templateName]) {
    return {};
  }

  const defaultDueDate = getDueDateFromTemplate(
    deps.paymentTermsTemplates[templateName],
    postingDate,
    billDate
  );
  const defaultDueDateStr = formatDate(defaultDueDate);
  const postingDateStr =
    typeof postingDate === "string" ? postingDate : formatDate(postingDate);

  if (defaultDueDateStr !== postingDateStr && getDate(dueDate) > defaultDueDate) {
    const isCreditController =
      deps.creditControllerRoles &&
      deps.userRoles &&
      deps.userRoles.some((r) => deps.creditControllerRoles!.includes(r));

    if (isCreditController) {
      const partyType = doctype === "Purchase Invoice" ? "supplier" : "customer";
      const diff = dateDiff(getDate(dueDate), defaultDueDate);
      return {
        warning: `Note: Due Date exceeds allowed ${partyType} credit days by ${diff} day(s)`,
      };
    } else {
      return {
        error: `Due Date cannot be after ${defaultDueDateStr}`,
      };
    }
  }

  return {};
}

/* ------------------------------------------------------------------ */
/*  set_taxes                                                          */
/* ------------------------------------------------------------------ */

export function setTaxes(
  party: string | null,
  partyType: string,
  postingDate: string | Date | null | undefined,
  company: string | null | undefined,
  customerGroup: string | null | undefined,
  supplierGroup: string | null | undefined,
  taxCategory: string | null | undefined,
  billingAddress: string | null | undefined,
  shippingAddress: string | null | undefined,
  getTaxTemplate: GetTaxTemplateFn,
  useForShoppingCart: number | null = null
): string | null {
  const args: TaxRuleArgs = {
    tax_type: "Purchase",
    [scrub(partyType)]: party,
    company: company ?? undefined,
    tax_category: taxCategory ?? null,
    customer_group: customerGroup ?? null,
    supplier_group: supplierGroup ?? null,
  };

  if (billingAddress || shippingAddress) {
    args.billing_address = billingAddress ?? null;
    args.shipping_address = shippingAddress ?? null;
  } else {
    args.billing_address = null;
    args.shipping_address = null;
  }

  if (["Customer", "Lead", "Prospect", "CRM Deal"].includes(partyType)) {
    args.tax_type = "Sales";
    if (["Lead", "Prospect", "CRM Deal"].includes(partyType)) {
      args.customer = null;
      delete args[scrub(partyType)];
    }
  } else {
    args.tax_type = "Purchase";
  }

  if (useForShoppingCart) {
    args.use_for_shopping_cart = useForShoppingCart;
  }

  return getTaxTemplate(postingDate, args);
}

/* ------------------------------------------------------------------ */
/*  get_payment_terms_template                                         */
/* ------------------------------------------------------------------ */

export function getPaymentTermsTemplate(
  partyName: string,
  partyType: string,
  company: string | null | undefined,
  companyDefaults: CompanyDefaults,
  partyPaymentTerms?: string | null,
  groupPaymentTerms?: string | null
): string | null {
  if (partyType !== "Customer" && partyType !== "Supplier") {
    return null;
  }

  let template: string | null = partyPaymentTerms ?? null;

  if (!template && groupPaymentTerms) {
    template = groupPaymentTerms;
  }

  if (!template && company) {
    template = companyDefaults.payment_terms ?? null;
  }

  return template;
}

/* ------------------------------------------------------------------ */
/*  validate_party_frozen_disabled                                     */
/* ------------------------------------------------------------------ */

export interface ValidatePartyFrozenDisabledDeps {
  party: { disabled?: boolean; is_frozen?: boolean; status?: string };
  userRoles: string[];
  ignorePartyValidation?: boolean;
}

export function validatePartyFrozenDisabled(
  company: string | null | undefined,
  partyType: string | null | undefined,
  partyName: string | null | undefined,
  deps: ValidatePartyFrozenDisabledDeps
): { valid: boolean; error?: string; warning?: string } {
  if (deps.ignorePartyValidation) {
    return { valid: true };
  }

  if (!partyType || !partyName) {
    return { valid: true };
  }

  if (partyType === "Customer" || partyType === "Supplier") {
    if (deps.party.disabled) {
      return { valid: false, error: `${partyType} ${partyName} is disabled` };
    }
    if (deps.party.is_frozen) {
      return { valid: false, error: `${partyType} ${partyName} is frozen` };
    }
  }

  if (partyType === "Employee") {
    if (deps.party.status !== "Active") {
      return { valid: true, warning: `${partyType} ${partyName} is not active` };
    }
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  get_party_shipping_address                                         */
/* ------------------------------------------------------------------ */

export function getPartyShippingAddress(
  addresses: Address[]
): string | null {
  const shippingAddresses = addresses
    .filter((a) => !a.disabled)
    .filter(
      (a) => a.is_shipping_address === 1 || a.address_type === "Shipping"
    )
    .sort((a, b) => (b.is_shipping_address ?? 0) - (a.is_shipping_address ?? 0));

  if (shippingAddresses.length === 0) {
    return null;
  }

  if (shippingAddresses[0].is_shipping_address === 1) {
    return shippingAddresses[0].name;
  }

  if (shippingAddresses.length === 1) {
    return shippingAddresses[0].name;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  get_address_tax_category                                           */
/* ------------------------------------------------------------------ */

export function getAddressTaxCategory(
  taxCategory: string | null | undefined,
  billingAddress: string | null,
  shippingAddress: string | null,
  addressTaxCategoryFn?: (addressName: string) => string | null,
  companyDefaults?: CompanyDefaults
): string | null {
  const addrTaxCategoryFrom = companyDefaults?.determine_address_tax_category_from ?? "Billing Address";

  if (addrTaxCategoryFrom === "Shipping Address") {
    if (shippingAddress && addressTaxCategoryFn) {
      taxCategory = addressTaxCategoryFn(shippingAddress) || taxCategory;
    }
  } else {
    if (billingAddress && addressTaxCategoryFn) {
      taxCategory = addressTaxCategoryFn(billingAddress) || taxCategory;
    }
  }

  return taxCategory ?? null;
}
