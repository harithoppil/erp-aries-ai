/**
 * Ported from erpnext/support/doctype/warranty_claim/warranty_claim.py
 * Pure business logic — no Frappe / Prisma imports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type WarrantyClaimStatus = "" | "Open" | "Closed" | "Work In Progress" | "Cancelled";
export type WarrantyAmcStatus =
  | ""
  | "Under Warranty"
  | "Out of Warranty"
  | "Under AMC"
  | "Out of AMC";

export interface WarrantyClaim {
  name?: string;
  naming_series?: string;
  status: WarrantyClaimStatus;
  company: string;
  complaint: string;
  complaint_date: string; // ISO date
  complaint_raised_by?: string;
  customer: string;
  customer_name?: string;
  customer_group?: string;
  contact_person?: string;
  contact_display?: string;
  contact_email?: string;
  contact_mobile?: string;
  customer_address?: string;
  address_display?: string;
  description?: string;
  from_company?: string;
  item_code?: string;
  item_name?: string;
  resolution_date?: string;
  resolution_details?: string;
  resolved_by?: string;
  serial_no?: string;
  service_address?: string;
  territory?: string;
  warranty_amc_status?: WarrantyAmcStatus;
  warranty_expiry_date?: string;
  amc_expiry_date?: string;
  docstatus: number;
}

export interface LinkedMaintenanceVisit {
  name: string;
  docstatus: number; // 2 = Cancelled
}

export interface WarrantyClaimValidationResult {
  success: boolean;
  error?: string;
  doc?: WarrantyClaim;
}

export interface WarrantyClaimCancelResult {
  success: boolean;
  error?: string;
  status?: "Cancelled";
}

/* ------------------------------------------------------------------ */
/*  Validate                                                           */
/* ------------------------------------------------------------------ */

/**
 * Validates a Warranty Claim.
 * - Guest users may skip customer check (original allows Guest to create without customer).
 * - When status moves to Closed and resolution_date is empty, set it to now.
 */
export function validateWarrantyClaim(
  doc: WarrantyClaim,
  user: string,
  prevStatus?: string,
  now?: string
): WarrantyClaimValidationResult {
  const updated = { ...doc };

  if (user !== "Guest" && !doc.customer) {
    return { success: false, error: "Customer is required" };
  }

  if (
    updated.status === "Closed" &&
    !updated.resolution_date &&
    prevStatus !== "Closed"
  ) {
    updated.resolution_date = now || new Date().toISOString();
  }

  return { success: true, doc: updated };
}

/* ------------------------------------------------------------------ */
/*  Cancel                                                             */
/* ------------------------------------------------------------------ */

/**
 * Checks for linked Maintenance Visits that are not cancelled.
 * Returns an error if any exist, otherwise allows cancellation.
 */
export function checkCancelWarrantyClaim(
  claimName: string,
  linkedVisits: LinkedMaintenanceVisit[]
): WarrantyClaimCancelResult {
  const blocking = linkedVisits.filter((v) => v.docstatus !== 2);

  if (blocking.length > 0) {
    const names = blocking.map((v) => v.name).join(", ");
    return {
      success: false,
      error: `Cancel Material Visit ${names} before cancelling this Warranty Claim`,
    };
  }

  return { success: true, status: "Cancelled" };
}
