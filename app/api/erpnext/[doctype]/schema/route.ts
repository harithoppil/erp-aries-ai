/**
 * ERPNext Schema — Return DocType field metadata from the Prisma model
 *
 * GET /api/erpnext/:doctype/schema
 *
 * Returns field names, types, constraints (required, unique, isId),
 * defaults, and relation info. This is the TypeScript equivalent of
 * Frappe's `frappe.get_meta(doctype)` — used by the frontend to
 * auto-generate forms, validation rules, and column definitions.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/prisma/client";
import { getDelegate } from "@/lib/erpnext/prisma-delegate";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Map Prisma scalar types to ERPNext-style field types. */
function prismaTypeToFieldType(prismaType: string): string {
  switch (prismaType) {
    case "String":
      return "Data";
    case "Int":
      return "Int";
    case "Float":
    case "Decimal":
      return "Float";
    case "Boolean":
      return "Check";
    case "DateTime":
      return "Datetime";
    case "Json":
      return "JSON";
    case "Bytes":
      return "Blob";
    default:
      return prismaType; // enum names, etc.
  }
}

/** Determine the ERPNext-style "fieldtype" for a field, including link types. */
type DmmfField = Prisma.DMMF.Field;

function inferFieldMeta(
  field: DmmfField,
  modelName: string,
): {
  fieldname: string;
  fieldtype: string;
  label: string;
  required: boolean;
  unique: boolean;
  isId: boolean;
  isList: boolean;
  isUpdatedAt: boolean;
  hasDefault: boolean;
  default_value: unknown;
  db_type: string | null;
  relation?: {
    model: string;
    fromFields: string[];
    toFields: string[];
  };
} {
  const isLink =
    field.kind === "object" &&
    field.relationFromFields &&
    field.relationFromFields.length > 0;

  const isChildTable =
    field.kind === "object" &&
    field.isList === true;

  let fieldtype: string;
  if (isChildTable) {
    fieldtype = "Table";
  } else if (isLink) {
    fieldtype = "Link";
  } else if (field.kind === "enum") {
    fieldtype = "Select";
  } else if (field.kind === "unsupported") {
    fieldtype = "Data";
  } else {
    fieldtype = prismaTypeToFieldType(field.type);
  }

  // Override special ERPNext fields with their conventional types
  if (field.name === "docstatus") fieldtype = "Int";
  if (field.name === "name" && field.isId) fieldtype = "Data";
  if (field.name === "owner" || field.name === "modified_by") fieldtype = "Link";
  if (field.name === "creation" || field.name === "modified") fieldtype = "Datetime";
  if (field.name === "idx") fieldtype = "Int";
  if (field.name === "parent" || field.name === "parenttype" || field.name === "parentfield") {
    fieldtype = "Link";
  }

  return {
    fieldname: field.name,
    fieldtype,
    label: field.name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase()),
    required: field.isRequired && !field.hasDefaultValue && !field.isId,
    unique: field.isUnique,
    isId: field.isId,
    isList: field.isList,
    isUpdatedAt: field.isUpdatedAt ?? false,
    hasDefault: field.hasDefaultValue,
    default_value: field.default ?? null,
    db_type: field.dbName ?? null,
    ...(isLink && field.relationName
      ? {
          relation: {
            model: field.type,
            fromFields: [...(field.relationFromFields ?? [])],
            toFields: [...(field.relationToFields ?? [])],
          },
        }
      : {}),
    ...(isChildTable && field.relationName
      ? {
          relation: {
            model: field.type,
            fromFields: [...(field.relationFromFields ?? [])],
            toFields: [...(field.relationToFields ?? [])],
          },
        }
      : {}),
  };
}

// ── GET — Schema ──────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;

    // ── Look up the DMMF model ───────────────────────────────────────────
    const dmmfModels = Prisma.dmmf.datamodel.models;
    const dmmfModel = dmmfModels.find((m) => m.name === doctype);

    if (!dmmfModel) {
      return NextResponse.json(
        { error: `Unknown DocType: ${doctype}` },
        { status: 404 },
      );
    }

    // ── Verify the Prisma client has this model ───────────────────────────
    const { prisma } = await import("@/lib/prisma");
    const delegate = getDelegate(prisma, doctype);
    const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
    if (!delegate) {
      return NextResponse.json(
        { error: `No Prisma delegate for ${doctype}` },
        { status: 404 },
      );
    }

    // ── Build field metadata ──────────────────────────────────────────────
    const fields = dmmfModel.fields.map((f: DmmfField) => inferFieldMeta(f, doctype));

    // ── Separate into categories ───────────────────────────────────────────
    const scalarFields = fields.filter(
      (f) => f.fieldtype !== "Table" && !f.relation,
    );
    const linkFields = fields.filter(
      (f) => f.fieldtype === "Link" && f.relation,
    );
    const childTables = fields.filter(
      (f) => f.fieldtype === "Table" && f.relation,
    );

    // ── Identify standard ERPNext fields ─────────────────────────────────
    const standardFields = new Set([
      "name",
      "owner",
      "creation",
      "modified",
      "modified_by",
      "docstatus",
      "idx",
      "parent",
      "parenttype",
      "parentfield",
    ]);

    const customFields = fields.filter(
      (f) => !standardFields.has(f.fieldname) && f.fieldtype !== "Table",
    );

    // ── Identify primary key ──────────────────────────────────────────────
    const primaryKey = dmmfModel.primaryKey
      ? dmmfModel.primaryKey.fields
      : dmmfModel.fields
          .filter((f: DmmfField) => f.isId)
          .map((f: DmmfField) => f.name);

    // ── Identify unique constraints ────────────────────────────────────────
    const uniqueFields = dmmfModel.uniqueFields || [];
    const uniqueIndexes = (dmmfModel.uniqueIndexes || []).map(
      (idx: { fields: readonly string[] }) => [...idx.fields],
    );

    return NextResponse.json({
      name: doctype,
      accessor,
      db_table: dmmfModel.dbName || doctype.toLowerCase(),
      primary_key: primaryKey,
      fields,
      scalar_fields: scalarFields,
      link_fields: linkFields,
      child_tables: childTables,
      custom_fields: customFields,
      required_fields: fields.filter((f) => f.required).map((f) => f.fieldname),
      unique_constraints: [...uniqueFields, ...uniqueIndexes],
      is_submittable: fields.some(
        (f) => f.fieldname === "docstatus",
      ),
      is_child_table: fields.some((f) => f.fieldname === "parent") &&
        fields.some((f) => f.fieldname === "parenttype"),
      field_count: fields.length,
    });
  } catch (error: any) {
    console.error("[erpnext/schema] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
