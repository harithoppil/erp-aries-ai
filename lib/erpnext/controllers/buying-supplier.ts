/**
 * Ported from erpnext/buying/doctype/supplier/supplier.py
 * Pure business logic for Supplier validation & calculations.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PartyAccount {
  company: string;
  account: string;
}

export interface AllowedToTransactWith {
  company: string;
}

export interface CustomerNumberAtSupplier {
  customer: string;
  customer_name?: string;
  customer_number?: string;
}

export interface PortalUser {
  user: string;
}

export interface SupplierDoc {
  name?: string;
  supplier_name: string;
  naming_series?: string;
  supplier_group?: string;
  supplier_type?: "Company" | "Individual" | "Partnership";
  country?: string;
  default_currency?: string;
  default_price_list?: string;
  default_bank_account?: string;
  payment_terms?: string;
  tax_category?: string;
  tax_id?: string;
  tax_withholding_category?: string;
  tax_withholding_group?: string;
  website?: string;
  supplier_details?: string;
  image?: string;
  disabled?: boolean;
  is_internal_supplier?: boolean;
  represents_company?: string;
  is_frozen?: boolean;
  on_hold?: boolean;
  hold_type?: "" | "All" | "Invoices" | "Payments";
  release_date?: string;
  prevent_pos?: boolean;
  prevent_rfqs?: boolean;
  warn_pos?: boolean;
  warn_rfqs?: boolean;
  allow_purchase_invoice_creation_without_purchase_order?: boolean;
  allow_purchase_invoice_creation_without_purchase_receipt?: boolean;
  is_transporter?: boolean;
  language?: string;
  gender?: string;
  email_id?: string;
  mobile_no?: string;
  primary_address?: string;
  supplier_primary_address?: string;
  supplier_primary_contact?: string;
  accounts: PartyAccount[];
  companies: AllowedToTransactWith[];
  customer_numbers: CustomerNumberAtSupplier[];
  portal_users: PortalUser[];
}

export interface ValidationResult<T = never> {
  valid: boolean;
  error?: string;
  warnings?: string[];
  doc?: T;
}

export interface SupplierValidationContext {
  suppMasterName?: string;
  existingInternalSuppliers?: Array<{ name: string; represents_company: string }>;
  partyAccountsValid?: boolean;
  partyAccountsError?: string;
}

export interface SupplierGroupDetails {
  payment_terms?: string;
  accounts?: PartyAccount[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined | null, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

/* ------------------------------------------------------------------ */
/*  Main Validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Main Supplier validation.
 * Ported from Supplier.validate()
 */
export function validateSupplier(
  doc: SupplierDoc,
  ctx: SupplierValidationContext
): ValidationResult<SupplierDoc> {
  let d = { ...doc };

  // Naming Series validation
  if (ctx.suppMasterName === "Naming Series" && !d.naming_series) {
    return { valid: false, error: "Series is mandatory" };
  }

  // Party accounts validation
  if (ctx.partyAccountsValid === false) {
    return {
      valid: false,
      error: ctx.partyAccountsError ?? "Invalid party accounts",
    };
  }

  // Internal supplier validation
  const internalVal = validateInternalSupplier(
    d,
    ctx.existingInternalSuppliers ?? []
  );
  if (!internalVal.valid) return internalVal;

  return { valid: true, doc: d };
}

/* ------------------------------------------------------------------ */
/*  Before Save                                                        */
/* ------------------------------------------------------------------ */

/**
 * Reset hold fields when supplier is not on hold.
 * Ported from Supplier.before_save()
 */
export function beforeSaveSupplier(doc: SupplierDoc): SupplierDoc {
  let d = { ...doc };

  if (!d.on_hold) {
    d.hold_type = "";
    d.release_date = "";
  } else if (d.on_hold && !d.hold_type) {
    d.hold_type = "All";
  }

  return d;
}

/* ------------------------------------------------------------------ */
/*  Naming                                                             */
/* ------------------------------------------------------------------ */

/**
 * Determine supplier name / document name.
 * Ported from Supplier.autoname()
 */
export function autoNameSupplier(
  supplierName: string,
  namingSeries: string | undefined,
  suppMasterName: string
): { name: string; naming_series?: string } {
  if (suppMasterName === "Supplier Name") {
    return { name: supplierName };
  }

  if (suppMasterName === "Naming Series") {
    return { name: "", naming_series: namingSeries ?? "" };
  }

  // Default: hash / auto
  return { name: "" };
}

/* ------------------------------------------------------------------ */
/*  Internal Supplier                                                  */
/* ------------------------------------------------------------------ */

/**
 * Validate internal supplier uniqueness.
 * Ported from Supplier.validate_internal_supplier()
 */
export function validateInternalSupplier(
  doc: SupplierDoc,
  existingInternalSuppliers: Array<{ name: string; represents_company: string }>
): ValidationResult<never> {
  if (!doc.is_internal_supplier) {
    return { valid: true };
  }

  const duplicate = existingInternalSuppliers.find(
    (s) =>
      s.represents_company === doc.represents_company && s.name !== doc.name
  );

  if (duplicate) {
    return {
      valid: false,
      error: `Internal Supplier for company ${doc.represents_company} already exists`,
    };
  }

  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Supplier Group Details                                             */
/* ------------------------------------------------------------------ */

/**
 * Map supplier group defaults onto supplier doc.
 * Ported from Supplier.get_supplier_group_details()
 */
export function applySupplierGroupDetails(
  doc: SupplierDoc,
  groupDetails: SupplierGroupDetails | null
): SupplierDoc {
  let d = { ...doc };

  d.payment_terms = "";
  d.accounts = [];

  if (groupDetails) {
    if (groupDetails.accounts) {
      d.accounts = groupDetails.accounts.map((a) => ({
        company: a.company,
        account: a.account,
      }));
    }
    if (groupDetails.payment_terms) {
      d.payment_terms = groupDetails.payment_terms;
    }
  }

  return d;
}

/* ------------------------------------------------------------------ */
/*  Portal User Role                                                   */
/* ------------------------------------------------------------------ */

/**
 * Check if portal user needs Supplier role added.
 * Ported from Supplier._add_supplier_role()
 */
export function needsSupplierRole(
  portalUser: PortalUser,
  isNew: boolean,
  existingUserRoles: string[],
  isSystemManager: boolean
): { needsRole: boolean; warning?: string } {
  if (!isNew) {
    return { needsRole: false };
  }

  if (existingUserRoles.includes("Supplier")) {
    return { needsRole: false };
  }

  if (!isSystemManager) {
    return {
      needsRole: false,
      warning: `Please add 'Supplier' role to user ${portalUser.user}.`,
    };
  }

  return { needsRole: true };
}

/* ------------------------------------------------------------------ */
/*  Dashboard Info Helpers                                             */
/* ------------------------------------------------------------------ */

export interface DashboardInfo {
  total_unpaid: number;
  currency: string;
  total_billed_amount: number;
  billing_this_year: number;
}

/**
 * Compute credit exposure ratio.
 */
export function computeCreditExposure(
  totalUnpaid: number,
  creditLimit: number
): number {
  if (!creditLimit) return 0;
  return flt((totalUnpaid / creditLimit) * 100);
}

/* ------------------------------------------------------------------ */
/*  Merge Validation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Validate currency compatibility before merging suppliers.
 * Ported from Supplier.before_rename() → validate_party_currency_before_merging
 */
export function validateMergeSupplier(
  oldSupplier: SupplierDoc,
  newSupplier: SupplierDoc
): ValidationResult<never> {
  if (oldSupplier.default_currency && newSupplier.default_currency) {
    if (oldSupplier.default_currency !== newSupplier.default_currency) {
      return {
        valid: false,
        error: `Cannot merge Suppliers with different currencies: ${oldSupplier.default_currency} vs ${newSupplier.default_currency}`,
      };
    }
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/*  Primary Contact / Address                                          */
/* ------------------------------------------------------------------ */

export interface ContactInfo {
  name?: string;
  email_id?: string;
  mobile_no?: string;
}

export interface AddressInfo {
  name?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

/**
 * Determine whether a primary contact should be created.
 * Ported from Supplier.create_primary_contact()
 */
export function shouldCreatePrimaryContact(
  doc: SupplierDoc
): { shouldCreate: boolean; mobile_no?: string; email_id?: string } {
  if (doc.supplier_primary_contact) {
    return { shouldCreate: false };
  }
  if (doc.mobile_no || doc.email_id) {
    return {
      shouldCreate: true,
      mobile_no: doc.mobile_no,
      email_id: doc.email_id,
    };
  }
  return { shouldCreate: false };
}

/**
 * Determine whether a primary address should be created.
 * Ported from Supplier.create_primary_address()
 */
export function shouldCreatePrimaryAddress(
  doc: SupplierDoc,
  isNewDoc: boolean
): { shouldCreate: boolean; address?: AddressInfo } {
  if (!isNewDoc) {
    return { shouldCreate: false };
  }
  if (doc.primary_address) {
    return { shouldCreate: false };
  }
  // In the real code it checks address_line1 via doc.get("address_line1")
  // which comes from the address form. Here we treat it as a hint.
  return { shouldCreate: false };
}
