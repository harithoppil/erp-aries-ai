/**
 * Ported from erpnext/selling/doctype/customer/customer.py
 * Pure business logic — no Frappe / Prisma imports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CustomerCreditLimit {
  company: string;
  credit_limit: number;
  bypass_credit_limit_check?: boolean;
}

export interface PartyAccount {
  company: string;
  account: string;
}

export interface SalesTeamMember {
  sales_person: string;
  allocated_percentage: number;
  commission_rate?: number;
  allocated_amount?: number;
  incentives?: number;
}

export interface PortalUser {
  user: string;
}

export interface SupplierNumberAtCustomer {
  supplier: string;
  supplier_number: string;
}

export interface Customer {
  name?: string;
  customer_name: string;
  customer_type: "Company" | "Individual" | "Partnership";
  customer_group?: string;
  territory?: string;
  default_currency?: string;
  default_price_list?: string;
  default_sales_partner?: string;
  default_bank_account?: string;
  default_commission_rate?: number;
  account_manager?: string;
  tax_id?: string;
  tax_category?: string;
  tax_withholding_category?: string;
  tax_withholding_group?: string;
  payment_terms?: string;
  loyalty_program?: string;
  loyalty_program_tier?: string;
  industry?: string;
  market_segment?: string;
  language?: string;
  website?: string;
  disabled?: boolean;
  dn_required?: boolean;
  so_required?: boolean;
  is_frozen?: boolean;
  is_internal_customer?: boolean;
  represents_company?: string;
  lead_name?: string;
  opportunity_name?: string;
  prospect_name?: string;
  customer_primary_address?: string;
  customer_primary_contact?: string;
  primary_address?: string;
  email_id?: string;
  mobile_no?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  image?: string;
  customer_pos_id?: string;
  credit_limits: CustomerCreditLimit[];
  accounts: PartyAccount[];
  sales_team?: SalesTeamMember[];
  portal_users?: PortalUser[];
  supplier_numbers?: SupplierNumberAtCustomer[];
}

export interface CustomerValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
  doc?: Customer;
}

export interface CustomerGroupInfo {
  is_group: boolean;
  accounts: PartyAccount[];
  credit_limits: CustomerCreditLimit[];
  payment_terms?: string;
  default_price_list?: string;
}

export interface GLEntryInfo {
  debit: number;
  credit: number;
}

export interface SalesOrderOutstanding {
  base_grand_total: number;
  per_billed: number;
  status: string;
}

export interface DeliveryNoteItemInfo {
  name: string;
  amount: number;
  base_net_total: number;
  base_grand_total: number;
  si_amount?: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function cint(value: number | string | undefined): number {
  return typeof value === "number" ? Math.trunc(value) : parseInt(value ?? "0", 10);
}

/* ------------------------------------------------------------------ */
/*  Validation entry point                                             */
/* ------------------------------------------------------------------ */

export function validateCustomer(
  doc: Customer,
  customerGroupInfo?: CustomerGroupInfo,
  existingInternalCustomers?: { name: string; represents_company: string }[],
  outstandingByCompany?: Record<string, number>,
  isNew: boolean = false
): CustomerValidationResult {
  const warnings: string[] = [];

  // Validate customer group
  const cgErr = validateCustomerGroup(doc.customer_group, customerGroupInfo);
  if (cgErr) return { success: false, error: cgErr };

  // Validate credit limit on change
  const clErr = validateCreditLimitOnChange(doc, outstandingByCompany ?? {});
  if (clErr) return { success: false, error: clErr };

  // Validate internal customer
  const icErr = validateInternalCustomer(doc, existingInternalCustomers ?? []);
  if (icErr) return { success: false, error: icErr };

  // Validate sales team allocation
  const stErr = validateSalesTeam(doc.sales_team ?? []);
  if (stErr) return { success: false, error: stErr };

  // Set loyalty program tier from previous if unchanged
  if (!isNew && doc.loyalty_program && !doc.loyalty_program_tier) {
    // Caller should set previous tier before calling if needed
  }

  return { success: true, warnings, doc };
}

/* ------------------------------------------------------------------ */
/*  Customer name generation                                           */
/* ------------------------------------------------------------------ */

export function getCustomerName(
  desiredName: string,
  existingNames: string[]
): string {
  const stripped = desiredName.trim();
  if (!existingNames.includes(stripped)) return stripped;

  const prefix = `${stripped} - `;
  const regex = new RegExp(`^${stripped} - (\\d+)$`);
  let max = 0;

  for (const name of existingNames) {
    const match = name.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > max) max = num;
    }
  }

  return `${stripped} - ${max + 1}`;
}

/* ------------------------------------------------------------------ */
/*  parseFullName                                                      */
/* ------------------------------------------------------------------ */

export function parseFullName(fullName: string): {
  first_name: string;
  middle_name?: string;
  last_name?: string;
} {
  const names = fullName.split(/\s+/).filter(Boolean);
  const first_name = names[0] ?? "";
  const middle_name = names.length > 2 ? names.slice(1, -1).join(" ") : undefined;
  const last_name = names.length > 1 ? names[names.length - 1] : undefined;
  return { first_name, middle_name, last_name };
}

/* ------------------------------------------------------------------ */
/*  validateCustomerGroup                                              */
/* ------------------------------------------------------------------ */

export function validateCustomerGroup(
  customerGroup: string | undefined,
  info?: CustomerGroupInfo
): string | undefined {
  if (!customerGroup) return undefined;
  if (info?.is_group) {
    return "Cannot select a Group type Customer Group. Please select a non-group Customer Group.";
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateInternalCustomer                                           */
/* ------------------------------------------------------------------ */

export function validateInternalCustomer(
  doc: Customer,
  existingInternalCustomers: { name: string; represents_company: string }[]
): string | undefined {
  if (!doc.is_internal_customer) {
    doc.represents_company = "";
    return undefined;
  }

  const dup = existingInternalCustomers.find(
    (c) => c.represents_company === doc.represents_company && c.name !== doc.name
  );
  if (dup) {
    return `Internal Customer for company ${doc.represents_company} already exists`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateCreditLimitOnChange                                        */
/* ------------------------------------------------------------------ */

export function validateCreditLimitOnChange(
  doc: Customer,
  outstandingByCompany: Record<string, number>
): string | undefined {
  if (!doc.credit_limits || doc.credit_limits.length === 0) return undefined;

  const companyRecord: string[] = [];
  for (const limit of doc.credit_limits) {
    if (companyRecord.includes(limit.company)) {
      return `Credit limit is already defined for the Company ${limit.company}`;
    }
    companyRecord.push(limit.company);

    const outstanding = outstandingByCompany[limit.company] ?? 0;
    if (flt(limit.credit_limit) < outstanding) {
      return `New credit limit is less than current outstanding amount for the customer. Credit limit has to be atleast ${outstanding}`;
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  validateSalesTeam                                                  */
/* ------------------------------------------------------------------ */

export function validateSalesTeam(salesTeam: SalesTeamMember[]): string | undefined {
  if (!salesTeam || salesTeam.length === 0) return undefined;
  const total = salesTeam.reduce((sum, m) => sum + flt(m.allocated_percentage), 0);
  if (flt(total, 2) !== 100) {
    return `Total contribution percentage should be equal to 100, got ${total}`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Credit limit calculations                                          */
/* ------------------------------------------------------------------ */

export function checkCreditLimit(
  creditLimit: number | undefined,
  customerOutstanding: number,
  extraAmount: number = 0
): { exceeded: boolean; message?: string } {
  if (!creditLimit) return { exceeded: false };

  const outstanding = customerOutstanding + flt(extraAmount);
  if (creditLimit > 0 && outstanding > creditLimit) {
    return {
      exceeded: true,
      message: `Credit limit has been crossed for customer (${outstanding}/${creditLimit})`,
    };
  }
  return { exceeded: false };
}

export function getCustomerOutstanding(
  outstandingBasedOnGLE: number,
  outstandingBasedOnSO: number,
  outstandingBasedOnDN: number
): number {
  return flt(outstandingBasedOnGLE + outstandingBasedOnSO + outstandingBasedOnDN, 2);
}

export function calculateOutstandingBasedOnGLE(
  glEntries: GLEntryInfo[]
): number {
  const debit = glEntries.reduce((s, e) => s + flt(e.debit), 0);
  const credit = glEntries.reduce((s, e) => s + flt(e.credit), 0);
  return flt(debit - credit, 2);
}

export function calculateOutstandingBasedOnSO(
  salesOrders: SalesOrderOutstanding[],
  ignoreClosed: boolean = true
): number {
  let total = 0;
  for (const so of salesOrders) {
    if (so.per_billed < 100 && (!ignoreClosed || so.status !== "Closed")) {
      total += flt(so.base_grand_total * (100 - so.per_billed) / 100, 2);
    }
  }
  return total;
}

export function calculateOutstandingBasedOnDN(
  dnItems: DeliveryNoteItemInfo[]
): number {
  let total = 0;
  for (const dn of dnItems) {
    const dnAmount = flt(dn.amount);
    const siAmount = flt(dn.si_amount ?? 0);
    if (dnAmount > siAmount && dn.base_net_total) {
      total += ((dnAmount - siAmount) / dn.base_net_total) * dn.base_grand_total;
    }
  }
  return flt(total, 2);
}

export function getCreditLimit(
  customerCreditLimit?: number,
  groupCreditLimit?: number,
  groupBypassCheck?: boolean,
  companyCreditLimit?: number
): number {
  if (customerCreditLimit !== undefined && customerCreditLimit !== null) {
    return flt(customerCreditLimit);
  }
  if (groupCreditLimit !== undefined && groupCreditLimit !== null && !groupBypassCheck) {
    return flt(groupCreditLimit);
  }
  if (companyCreditLimit !== undefined && companyCreditLimit !== null) {
    return flt(companyCreditLimit);
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  makeContactArgs / makeAddressArgs                                  */
/* ------------------------------------------------------------------ */

export function makeContactArgs(
  doc: Customer,
  isPrimaryContact: number = 1
): {
  is_primary_contact: number;
  links: { link_doctype: string; link_name?: string }[];
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  company_name?: string;
  email_id?: string;
  mobile_no?: string;
} {
  const links = [{ link_doctype: "Customer", link_name: doc.name }];

  if (doc.customer_type === "Individual") {
    const { first_name, middle_name, last_name } = parseFullName(doc.customer_name);
    return {
      is_primary_contact: isPrimaryContact,
      links,
      first_name,
      middle_name,
      last_name,
      email_id: doc.email_id,
      mobile_no: doc.mobile_no,
    };
  }

  return {
    is_primary_contact: isPrimaryContact,
    links,
    company_name: doc.customer_name,
    email_id: doc.email_id,
    mobile_no: doc.mobile_no,
  };
}

export function makeAddressArgs(
  doc: Customer & {
    address_line1?: string;
    address_line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  },
  isPrimaryAddress: number = 1,
  isShippingAddress: number = 1
): {
  address_title: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  is_primary_address: number;
  is_shipping_address: number;
  links: { link_doctype: string; link_name?: string }[];
} {
  return {
    address_title: doc.customer_name,
    address_line1: doc.address_line1,
    address_line2: doc.address_line2,
    city: doc.city,
    state: doc.state,
    pincode: doc.pincode,
    country: doc.country,
    is_primary_address: isPrimaryAddress,
    is_shipping_address: isShippingAddress,
    links: [{ link_doctype: "Customer", link_name: doc.name }],
  };
}

export function validateAddressFields(
  city?: string,
  country?: string
): string | undefined {
  const missing: string[] = [];
  if (!city) missing.push("City");
  if (!country) missing.push("Country");
  if (missing.length) {
    return `Following fields are mandatory to create address: ${missing.join(", ")}`;
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Loyalty program helpers                                            */
/* ------------------------------------------------------------------ */

export interface LoyaltyProgram {
  name: string;
  customer_group?: string;
  customer_territory?: string;
  auto_opt_in: boolean;
  from_date: string;
  to_date?: string;
}

export function getLoyaltyPrograms(
  doc: Customer,
  loyaltyPrograms: LoyaltyProgram[],
  nestedGroups: Record<string, string[]>,
  nestedTerritories: Record<string, string[]>
): string[] {
  const lpDetails: string[] = [];
  const todayStr = new Date().toISOString().split("T")[0];

  for (const lp of loyaltyPrograms) {
    const fromOk = lp.from_date <= todayStr;
    const toOk = !lp.to_date || lp.to_date >= todayStr;
    if (!fromOk || !toOk) continue;

    const groupMatch =
      !lp.customer_group ||
      (nestedGroups[lp.customer_group] ?? []).includes(doc.customer_group ?? "");

    const territoryMatch =
      !lp.customer_territory ||
      (nestedTerritories[lp.customer_territory] ?? []).includes(doc.territory ?? "");

    if (groupMatch && territoryMatch) {
      lpDetails.push(lp.name);
    }
  }

  return lpDetails;
}

export function setLoyaltyProgram(
  doc: Customer,
  loyaltyPrograms: string[]
): Customer {
  if (doc.loyalty_program) return doc;
  if (loyaltyPrograms.length === 1) {
    doc.loyalty_program = loyaltyPrograms[0];
  }
  return doc;
}

/* ------------------------------------------------------------------ */
/*  Naming helpers                                                     */
/* ------------------------------------------------------------------ */

export function validateNameWithCustomerGroup(
  customerName: string,
  existingCustomerGroups: string[]
): string | undefined {
  if (existingCustomerGroups.includes(customerName)) {
    return "A Customer Group exists with same name please change the Customer name or rename the Customer Group";
  }
  return undefined;
}
