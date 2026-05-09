/**
 * Validation Pipeline — Runs a multi-stage validation before document submit.
 *
 * Pipeline stages:
 *   1. Field validation — required fields, format checks (using DMMF discovery)
 *   2. Business rule checks — DocType-specific rules
 *   3. GL impact preview — show what GL entries will be created (dry-run)
 *   4. Confirm — aggregate result
 *
 * Uses DMMF (Data Model Meta Facility) for runtime model discovery so that
 * required fields are never hardcoded — they come from the Prisma schema.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - Uses DMMF for field discovery, never hardcoded field lists.
 * - Unknown fields → null, never invented fallback values.
 */

import { Prisma } from "@/prisma/client";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** A single validation error */
export interface ValidationError {
  field: string;
  message: string;
  /** The validation rule that triggered this error */
  rule: ValidationRuleType;
}

/** A single validation warning (non-blocking) */
export interface ValidationWarning {
  field: string;
  message: string;
}

/** The type of validation rule that produced an error */
export type ValidationRuleType =
  | "required_field"
  | "format_check"
  | "business_rule"
  | "gl_balance"
  | "stock_validation"
  | "custom";

/** The overall validation result */
export interface ValidationPipelineResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  /** GL entries that would be created on submit (dry-run preview) */
  glPreview: unknown[];
}

/** Business rule category based on DocType domain */
export type DocTypeDomain = "selling" | "buying" | "stock" | "accounts" | "hr" | "crm" | "generic";

/* ------------------------------------------------------------------ */
/*  DMMF field discovery                                               */
/* ------------------------------------------------------------------ */

/**
 * Discover required fields for a Prisma model using DMMF.
 *
 * Returns an array of field names that are marked as required
 * (isRequired=true) and do not have a default value, plus those
 * that are required but have a default that is not auto-generated.
 *
 * @param modelName - The Prisma model name (e.g. "SalesInvoice")
 * @returns Array of field names that must be provided by the caller
 */
export function discoverRequiredFields(modelName: string): string[] {
  const required: string[] = [];

  try {
    const dmmfModels = Prisma.dmmf.datamodel.models;
    const model = dmmfModels.find(
      (m) => m.name === modelName || m.name === modelName.charAt(0).toLowerCase() + modelName.slice(1),
    );

    if (!model) return required;

    for (const field of model.fields) {
      // Skip: id fields, relation fields, list fields, generated fields
      if (field.isId) continue;
      if (field.kind === "object") continue;
      if (field.isList) continue;
      if (field.isGenerated) continue;

      // Required fields without a default must be provided
      if (field.isRequired && !field.hasDefaultValue) {
        required.push(field.name);
      }
    }
  } catch (_e: unknown) {
    // DMMF may not be available in all environments
  }

  return required;
}

/**
 * Discover all fields on a Prisma model using DMMF.
 *
 * @param modelName - The Prisma model name
 * @returns Array of DMMF field descriptors
 */
export function discoverModelFields(modelName: string): Array<{
  name: string;
  type: string;
  isRequired: boolean;
  hasDefaultValue: boolean;
}> {
  try {
    const dmmfModels = Prisma.dmmf.datamodel.models;
    const model = dmmfModels.find(
      (m) => m.name === modelName || m.name === modelName.charAt(0).toLowerCase() + modelName.slice(1),
    );

    if (!model) return [];

    return model.fields
      .filter((f) => f.kind !== "object" && !f.isList)
      .map((f) => ({
        name: f.name,
        type: f.type,
        isRequired: f.isRequired,
        hasDefaultValue: f.hasDefaultValue,
      }));
  } catch (_e: unknown) {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Domain classification                                              */
/* ------------------------------------------------------------------ */

/**
 * Classify a DocType into a business domain for rule selection.
 *
 * Uses naming conventions from the existing orchestrator registry
 * to determine the domain.
 */
export function classifyDocType(doctype: string): DocTypeDomain {
  const lower = doctype.toLowerCase();

  // Selling domain
  if (
    lower.includes("sales invoice") ||
    lower.includes("sales order") ||
    lower.includes("quotation") ||
    lower.includes("delivery note")
  ) {
    return "selling";
  }

  // Buying domain
  if (
    lower.includes("purchase invoice") ||
    lower.includes("purchase order") ||
    lower.includes("purchase receipt") ||
    lower.includes("supplier")
  ) {
    return "buying";
  }

  // Stock domain
  if (
    lower.includes("stock entry") ||
    lower.includes("stock ledger") ||
    lower.includes("material request") ||
    lower.includes("work order") ||
    lower.includes("bom") ||
    lower.includes("bin") ||
    lower.includes("item")
  ) {
    return "stock";
  }

  // Accounts domain
  if (
    lower.includes("journal entry") ||
    lower.includes("payment entry") ||
    lower.includes("gl entry") ||
    lower.includes("account")
  ) {
    return "accounts";
  }

  // CRM domain
  if (
    lower.includes("lead") ||
    lower.includes("opportunity") ||
    lower.includes("customer")
  ) {
    return "crm";
  }

  return "generic";
}

/* ------------------------------------------------------------------ */
/*  Stage 1: Field Validation                                          */
/* ------------------------------------------------------------------ */

/**
 * Validate required fields on a document using DMMF discovery.
 *
 * @param doctype - The DocType name
 * @param doc     - The document data
 * @returns Array of validation errors for missing/invalid fields
 */
export function validateFields(
  doctype: string,
  doc: Record<string, unknown>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Discover required fields from DMMF
  const requiredFields = discoverRequiredFields(doctype);

  for (const field of requiredFields) {
    const value = doc[field];

    // Check for missing values
    if (value === undefined || value === null || value === "") {
      errors.push({
        field,
        message: `${field} is a required field`,
        rule: "required_field",
      });
    }
  }

  // Format checks for common fields
  if (doc.posting_date && typeof doc.posting_date === "string") {
    const parsed = Date.parse(doc.posting_date as string);
    if (isNaN(parsed)) {
      errors.push({
        field: "posting_date",
        message: "posting_date is not a valid date",
        rule: "format_check",
      });
    }
  }

  if (doc.conversion_rate !== undefined && doc.conversion_rate !== null) {
    const rate = Number(doc.conversion_rate);
    if (isNaN(rate) || rate <= 0) {
      errors.push({
        field: "conversion_rate",
        message: "conversion_rate must be a positive number",
        rule: "format_check",
      });
    }
  }

  return errors;
}

/* ------------------------------------------------------------------ */
/*  Stage 2: Business Rule Validation                                  */
/* ------------------------------------------------------------------ */

/**
 * Validate business rules for a document based on its domain.
 *
 * @param doctype - The DocType name
 * @param doc     - The document data
 * @returns Tuple of [errors, warnings]
 */
export function validateBusinessRules(
  doctype: string,
  doc: Record<string, unknown>,
): [ValidationError[], ValidationWarning[]] {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const domain = classifyDocType(doctype);

  // ── Selling rules ──────────────────────────────────────────────────
  if (domain === "selling") {
    if (!doc.customer) {
      errors.push({
        field: "customer",
        message: "Customer is required for selling documents",
        rule: "business_rule",
      });
    }

    const items = doc.items as unknown[] | undefined;
    if (Array.isArray(items) && items.length === 0) {
      errors.push({
        field: "items",
        message: "At least one item is required",
        rule: "business_rule",
      });
    }

    // Check outstanding amount for Sales Invoice
    if (doctype === "Sales Invoice") {
      const outstandingAmount = Number(doc.outstanding_amount ?? 0);
      const grandTotal = Number(doc.grand_total ?? 0);
      if (outstandingAmount > grandTotal && grandTotal > 0) {
        warnings.push({
          field: "outstanding_amount",
          message: `Outstanding amount (${outstandingAmount}) exceeds grand total (${grandTotal})`,
        });
      }
    }
  }

  // ── Buying rules ───────────────────────────────────────────────────
  if (domain === "buying") {
    if (!doc.supplier) {
      errors.push({
        field: "supplier",
        message: "Supplier is required for buying documents",
        rule: "business_rule",
      });
    }

    const items = doc.items as unknown[] | undefined;
    if (Array.isArray(items) && items.length === 0) {
      errors.push({
        field: "items",
        message: "At least one item is required",
        rule: "business_rule",
      });
    }
  }

  // ── Stock rules ───────────────────────────────────────────────────
  if (domain === "stock") {
    const items = doc.items as unknown[] | undefined;
    if (Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as Record<string, unknown> | null;
        if (!item) continue;

        const qty = Number(item.qty ?? 0);
        if (qty === 0) {
          errors.push({
            field: `items[${i}].qty`,
            message: "Item quantity cannot be zero",
            rule: "stock_validation",
          });
        }

        if (qty < 0 && doctype !== "Stock Entry") {
          warnings.push({
            field: `items[${i}].qty`,
            message: "Negative quantity detected — verify this is intentional",
          });
        }
      }
    }
  }

  // ── Accounts rules ────────────────────────────────────────────────
  if (domain === "accounts") {
    if (doctype === "Journal Entry") {
      const accounts = doc.accounts as unknown[] | undefined;
      if (Array.isArray(accounts) && accounts.length < 2) {
        errors.push({
          field: "accounts",
          message: "Journal Entry must have at least 2 account entries",
          rule: "business_rule",
        });
      }
    }

    if (doctype === "Payment Entry") {
      if (!doc.party_type || !doc.party) {
        errors.push({
          field: "party",
          message: "Party type and party are required for Payment Entry",
          rule: "business_rule",
        });
      }
    }
  }

  // ── Common rules across all domains ───────────────────────────────
  if (!doc.company) {
    errors.push({
      field: "company",
      message: "Company is required",
      rule: "business_rule",
    });
  }

  const docstatus = Number(doc.docstatus ?? 0);
  if (docstatus === 2) {
    errors.push({
      field: "docstatus",
      message: "Cannot validate a cancelled document",
      rule: "business_rule",
    });
  }

  return [errors, warnings];
}

/* ------------------------------------------------------------------ */
/*  Stage 3: GL Impact Preview (placeholder)                           */
/* ------------------------------------------------------------------ */

/**
 * Preview the GL entries that would be created on submit.
 *
 * This is a dry-run that returns what the controller would produce
 * without actually persisting anything.
 *
 * NOTE: Currently returns an empty array. Full implementation requires
 * calling the controller's onSubmit and extracting glEntries without
 * side effects. This will be integrated with the document-orchestrator's
 * controller registry in a future iteration.
 *
 * @param _doctype - The DocType name
 * @param _doc     - The document data
 * @returns Array of GL entry previews (currently empty)
 */
export function previewGlImpact(
  _doctype: string,
  _doc: Record<string, unknown>,
): unknown[] {
  // TODO: Integrate with document-orchestrator controller registry
  // to dry-run the onSubmit function and extract glEntries.
  return [];
}

/* ------------------------------------------------------------------ */
/*  validateDocument — Main pipeline entry point                        */
/* ------------------------------------------------------------------ */

/**
 * Validate a document through the full validation pipeline.
 *
 * Stages:
 *   1. Field validation (required fields via DMMF, format checks)
 *   2. Business rule checks (domain-specific rules)
 *   3. GL impact preview (dry-run)
 *   4. Aggregate result
 *
 * @param doctype - The DocType name (e.g. "Sales Invoice")
 * @param doc     - The document data as a plain object
 * @returns Validation result with errors, warnings, and GL preview
 */
export function validateDocument(
  doctype: string,
  doc: Record<string, unknown>,
): ValidationPipelineResult {
  // Stage 1: Field validation
  const fieldErrors = validateFields(doctype, doc);

  // Stage 2: Business rules
  const [businessErrors, businessWarnings] = validateBusinessRules(doctype, doc);

  // Stage 3: GL preview
  const glPreview = previewGlImpact(doctype, doc);

  // Stage 4: Aggregate
  const allErrors = [...fieldErrors, ...businessErrors];
  const allWarnings = [...businessWarnings];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    glPreview,
  };
}
