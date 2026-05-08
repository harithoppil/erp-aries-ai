/**
 * Ported from erpnext/accounts/doctype/cost_center/cost_center.py
 * Pure validation logic for Cost Center master.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error: any)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CostCenterDoc {
  name?: string;
  cost_center_name: string;
  cost_center_number?: string | null;
  company: string;
  parent_cost_center?: string | null;
  is_group?: boolean;
  disabled?: boolean;
  old_parent?: string | null;
  lft?: number;
  rgt?: number;
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface ConversionResult {
  canConvert: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Naming                                                             */
/* ------------------------------------------------------------------ */

/** Build cost center name with number prefix if provided. */
export function getNameWithNumber(name: string, number?: string | null): string {
  if (number && name && !/^\d/.test(name)) {
    return `${number} - ${name}`;
  }
  return name;
}

/** Build full cost center name with company abbreviation.
 *  (Server action supplies company abbreviation.)
 */
export function getCostCenterAutoname(
  costCenterName: string,
  companyAbbr: string,
  costCenterNumber?: string | null
): string {
  const base = `${costCenterName} - ${companyAbbr}`;
  if (costCenterNumber && !/^\d/.test(base)) {
    return `${costCenterNumber} - ${costCenterName} - ${companyAbbr}`;
  }
  return base;
}

/* ------------------------------------------------------------------ */
/*  Mandatory validations                                              */
/* ------------------------------------------------------------------ */

/** Validate mandatory parent rules for cost centers. */
export function validateMandatory(doc: CostCenterDoc): string | null {
  const isRoot = doc.cost_center_name === doc.company;

  if (!isRoot && !doc.parent_cost_center) {
    return "Please enter parent cost center";
  }

  if (isRoot && doc.parent_cost_center) {
    return "Root cannot have a parent cost center";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Parent validation                                                  */
/* ------------------------------------------------------------------ */

/** Validate that parent cost center is a group node. */
export function validateParentCostCenter(
  parentCostCenterIsGroup: boolean | undefined,
  parentCostCenterName: string
): string | null {
  if (parentCostCenterIsGroup === false) {
    return `${parentCostCenterName} is not a group node. Please select a group node as parent cost center`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Master validate                                                    */
/* ------------------------------------------------------------------ */

/** Run all cost center validations. */
export function validateCostCenter(
  doc: CostCenterDoc,
  parentCostCenterIsGroup: boolean | undefined
): ValidationResult {
  const mandatoryErr = validateMandatory(doc);
  if (mandatoryErr) return { success: false, error: mandatoryErr };

  if (doc.parent_cost_center) {
    const parentErr = validateParentCostCenter(parentCostCenterIsGroup, doc.parent_cost_center);
    if (parentErr) return { success: false, error: parentErr };
  }

  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Group ↔ Ledger conversion                                          */
/* ------------------------------------------------------------------ */

export function canConvertGroupToLedger(hasChildren: boolean, hasGLEntries: boolean): ConversionResult {
  if (hasChildren) {
    return { canConvert: false, error: "Cannot convert Cost Center to ledger as it has child nodes" };
  }
  if (hasGLEntries) {
    return { canConvert: false, error: "Cost Center with existing transactions can not be converted to ledger" };
  }
  return { canConvert: true };
}

export function canConvertLedgerToGroup(
  hasGLEntries: boolean,
  hasAllocationRecords = false,
  isPartOfAllocation = false
): ConversionResult {
  if (hasAllocationRecords) {
    return { canConvert: false, error: "Cost Center with Allocation records can not be converted to a group" };
  }
  if (isPartOfAllocation) {
    return { canConvert: false, error: "Cost Center is a part of Cost Center Allocation, hence cannot be converted to a group" };
  }
  if (hasGLEntries) {
    return { canConvert: false, error: "Cost Center with existing transactions can not be converted to group" };
  }
  return { canConvert: true };
}

/* ------------------------------------------------------------------ */
/*  Rename helpers                                                     */
/* ------------------------------------------------------------------ */

/** After a rename, derive cost_center_name and cost_center_number from the new name.
 *  Returns the parsed values.
 */
export function parseRenamedCostCenter(
  newName: string,
  currentNumber?: string | null
): { cost_center_name: string; cost_center_number?: string } {
  // Names are like: "Main - COMPANY" or "01 - Main - COMPANY"
  const parts = newName.split(" - ");

  // Remove company abbreviation (last part)
  parts.pop();

  let number: string | undefined = currentNumber ?? undefined;

  // If first part starts with a digit, treat it as the number
  if (parts.length > 0 && /^\d/.test(parts[0])) {
    number = parts[0];
    parts.shift();
  }

  const costCenterName = parts.join(" - ");

  return { cost_center_name: costCenterName, cost_center_number: number };
}
