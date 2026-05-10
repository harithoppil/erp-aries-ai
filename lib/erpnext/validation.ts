/**
 * Zod Schema Generator — Dynamically generate Zod validation schemas
 * from Prisma DMMF field metadata for each DocType.
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - Uses Prisma DMMF for runtime model discovery — never hardcoded lists.
 * - Caches schemas after first generation (DMMF doesn't change at runtime).
 * - Unknown fields → null, never invented fallback values.
 */

import { z, ZodObject, ZodError, type ZodType } from "zod";
import { Prisma } from "@/prisma/client";
import type { DmmfField } from "./prisma-delegate";

// ── Type for ZodObject shape in v4 ──────────────────────────────────────────────
type ZodShape = Readonly<{ [k: string]: ZodType }>;
type DynamicZodObject = ZodObject<ZodShape>;

// ── Schema Cache ──────────────────────────────────────────────────────────────

/** Cache generated Zod schemas by DocType name. DMMF is static at runtime. */
const schemaCache: Map<string, DynamicZodObject> = new Map();

// ── DMMF → Zod field mapper ───────────────────────────────────────────────────

/**
 * Map a Prisma DMMF field type to the appropriate Zod type.
 * Respects `isRequired`, `hasDefaultValue`, and `isList` semantics.
 */
function fieldToZod(field: DmmfField): z.ZodType {
  // Skip relation fields — they are not direct input
  if (field.kind === "object") {
    return z.never().optional();
  }

  // Determine base Zod type from Prisma scalar type
  let base: z.ZodType;

  switch (field.type) {
    case "String":
      base = z.string();
      break;
    case "Int":
      base = z.coerce.number().int();
      break;
    case "Float":
      base = z.coerce.number();
      break;
    case "Decimal":
      // Prisma represents Decimal as string in input, number in JS
      // Accept both string and number, coerce to string for Prisma
      base = z.union([z.string(), z.number()]).transform(String);
      break;
    case "Boolean":
      base = z.boolean();
      break;
    case "DateTime":
      base = z.coerce.date();
      break;
    case "Json":
      base = z.unknown();
      break;
    case "Bytes":
      base = z.instanceof(Uint8Array);
      break;
    default:
      // Enum type — Prisma stores the enum name in `field.type`
      // Try to resolve enum values from DMMF
      {
        const enumValues = resolveEnumValues(field.type);
        if (enumValues && enumValues.length > 0) {
          base = z.enum(enumValues as [string, ...string[]]);
        } else {
          // Unknown scalar — accept string as fallback
          base = z.string();
        }
      }
      break;
  }

  // Handle optionality
  // A field is effectively optional if:
  //   - It is NOT required, OR
  //   - It IS required but has a default value (Prisma will fill it)
  const isEffectivelyOptional = !field.isRequired || field.hasDefaultValue;

  // Special cases: auto-managed fields should be optional in input
  const autoFields = new Set([
    "creation",
    "modified",
    "owner",
    "modified_by",
    "docstatus",
    "idx",
  ]);

  const isAutoField = autoFields.has(field.name);

  if (isAutoField || isEffectivelyOptional) {
    // Allow null and undefined
    base = base.optional().nullable();
  }

  // Handle list types (arrays) — not common on parent doctypes but possible
  if (field.isList) {
    base = z.array(base).optional();
  }

  return base;
}

/**
 * Try to resolve enum values from the Prisma DMMF.
 * Searches the datamodel enums for a matching name.
 */
function resolveEnumValues(enumName: string): string[] | null {
  try {
    const enums = Prisma.dmmf.datamodel.enums;
    if (!enums) return null;

    for (const e of enums) {
      if (e.name === enumName) {
        return e.values.map((v) => v.name);
      }
    }
    return null;
  } catch (_e: unknown) {
    return null;
  }
}

// ── Schema Generation ─────────────────────────────────────────────────────────

/**
 * Generate a Zod schema for the given DocType by reading Prisma DMMF fields.
 * Results are cached after first generation.
 *
 * @param doctype - The DocType/model name (e.g. "SalesInvoice" or "Sales Invoice")
 * @returns ZodObject schema for validating document input
 */
export function generateZodSchema(doctype: string): DynamicZodObject {
  // Normalise: "Sales Invoice" → "SalesInvoice" for DMMF lookup
  const modelName = doctype.replace(/\s+/g, "");

  // Return cached schema if available
  const cached = schemaCache.get(modelName);
  if (cached) return cached;

  // Find the DMMF model
  const dmmfModels = Prisma.dmmf.datamodel.models;
  const dmmfModel = dmmfModels.find(
    (m) => m.name === modelName || m.name === doctype,
  );

  if (!dmmfModel) {
    // Return a permissive schema for unknown DocTypes
    const permissive = z.object({ name: z.string() }).passthrough();
    schemaCache.set(modelName, permissive);
    return permissive;
  }

  // Build Zod shape from DMMF fields (only scalar/enum fields)
  const shape: Record<string, ZodType> = {};

  for (const field of dmmfModel.fields as unknown as DmmfField[]) {
    if (field.kind === "object") continue; // Skip relations
    shape[field.name] = fieldToZod(field);
  }

  // Create the schema — allow extra fields (passthrough) for dynamic data
  const schema = z.object(shape).passthrough();

  // Cache it
  schemaCache.set(modelName, schema);

  return schema;
}

// ── Validation ────────────────────────────────────────────────────────────────

/** Validation result returned by `validateDocument`. */
export interface ZodValidationResult {
  valid: boolean;
  errors: ZodError["issues"];
}

/**
 * Validate a document's data against the Zod schema generated from DMMF.
 *
 * @param doctype - The DocType name
 * @param data    - The document data to validate
 * @returns Object with `valid` flag and error details if invalid
 */
export function validateDocument(
  doctype: string,
  data: Record<string, unknown>,
): ZodValidationResult {
  const schema = generateZodSchema(doctype);
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues,
  };
}

// ── Pre-built Schemas for Common DocTypes ─────────────────────────────────────

/** Lazy-initialised pre-built schemas. Generated once on first access. */
let _prebuiltCache: Map<string, DynamicZodObject> | null = null;

function getPrebuiltSchemas(): Map<string, DynamicZodObject> {
  if (_prebuiltCache) return _prebuiltCache;

  const doctypes = [
    "SalesInvoice",
    "PurchaseInvoice",
    "SalesOrder",
    "PurchaseOrder",
    "Quotation",
    "DeliveryNote",
    "StockEntry",
    "JournalEntry",
    "PaymentEntry",
    "PurchaseReceipt",
    "MaterialRequest",
  ];

  _prebuiltCache = new Map();
  for (const dt of doctypes) {
    _prebuiltCache.set(dt, generateZodSchema(dt));
  }
  return _prebuiltCache;
}

/** Pre-built Zod schema for Sales Invoice */
export const SalesInvoiceSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("SalesInvoice");
    },
  },
);

/** Pre-built Zod schema for Purchase Invoice */
export const PurchaseInvoiceSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("PurchaseInvoice");
    },
  },
);

/** Pre-built Zod schema for Sales Order */
export const SalesOrderSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("SalesOrder");
    },
  },
);

/** Pre-built Zod schema for Purchase Order */
export const PurchaseOrderSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("PurchaseOrder");
    },
  },
);

/** Pre-built Zod schema for Quotation */
export const QuotationSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("Quotation");
    },
  },
);

/** Pre-built Zod schema for Delivery Note */
export const DeliveryNoteSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("DeliveryNote");
    },
  },
);

/** Pre-built Zod schema for Stock Entry */
export const StockEntrySchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("StockEntry");
    },
  },
);

/** Pre-built Zod schema for Journal Entry */
export const JournalEntrySchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("JournalEntry");
    },
  },
);

/** Pre-built Zod schema for Payment Entry */
export const PaymentEntrySchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("PaymentEntry");
    },
  },
);

/** Pre-built Zod schema for Purchase Receipt */
export const PurchaseReceiptSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("PurchaseReceipt");
    },
  },
);

/** Pre-built Zod schema for Material Request */
export const MaterialRequestSchema: DynamicZodObject = new Proxy(
  {} as DynamicZodObject,
  {
    get(_target, _prop) {
      return getPrebuiltSchemas().get("MaterialRequest");
    },
  },
);
