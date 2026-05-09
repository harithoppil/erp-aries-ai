/**
 * ERPNext Submit — Transition docstatus 0 → 1
 *
 * POST /api/erpnext/:doctype/:name/submit
 *
 * Submittable documents follow the ERPNext document lifecycle:
 *   Draft (0) → Submitted (1) → Cancelled (2)
 *
 * Only Draft documents can be submitted. Submission is the ERPNext
 * equivalent of "posting" or "confirming" a transaction — it locks
 * the document and triggers downstream effects (GL entries, stock
 * ledger updates, etc.).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

function toAccessor(doctype: string): string {
  return doctype.charAt(0).toLowerCase() + doctype.slice(1);
}

function getModel(doctype: string): { model: any; accessor: string } | null {
  const accessor = toAccessor(doctype);
  const delegate = (prisma as any)[accessor];
  if (!delegate || typeof delegate.findUnique !== "function") return null;
  return { model: delegate, accessor };
}

// ── POST — Submit ─────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  try {
    const { doctype, name } = await params;
    const resolved = getModel(doctype);
    if (!resolved) {
      return NextResponse.json(
        { error: `Unknown DocType: ${doctype}` },
        { status: 404 },
      );
    }
    const { model, accessor } = resolved;

    // ── Fetch the record ────────────────────────────────────────────────
    const record = await model.findUnique({ where: { name } });
    if (!record) {
      return NextResponse.json(
        { error: `${doctype} "${name}" not found` },
        { status: 404 },
      );
    }

    // ── Validate docstatus transition ────────────────────────────────────
    const currentStatus = record.docstatus ?? 0;

    if (currentStatus === 1) {
      return NextResponse.json(
        { error: `${doctype} "${name}" is already submitted` },
        { status: 409 },
      );
    }

    if (currentStatus === 2) {
      return NextResponse.json(
        { error: `Cannot submit cancelled ${doctype} "${name}". Create an amended document instead.` },
        { status: 403 },
      );
    }

    // currentStatus must be 0 (Draft)
    if (currentStatus !== 0) {
      return NextResponse.json(
        { error: `Unexpected docstatus=${currentStatus} for ${doctype} "${name}"` },
        { status: 400 },
      );
    }

    // ── Validate mandatory fields for submission ────────────────────────
    // Check that no required (non-nullable, no default) fields are null
    // This is a lightweight check — full business validation should be
    // done at the controller level before calling this endpoint.
    const dmmfModel = Prisma.dmmf.datamodel.models.find(
      (m: any) => m.name === doctype,
    );

    if (dmmfModel) {
      const missingFields: string[] = [];
      for (const field of dmmfModel.fields) {
        // Only check scalar fields that are required and not auto-managed
        if (
          field.kind === "scalar" &&
          field.isRequired &&
          !field.isId &&
          !field.isUpdatedAt &&
          !field.isGenerated &&
          field.name !== "creation" &&
          field.name !== "modified" &&
          field.name !== "docstatus" &&
          field.name !== "idx" &&
          field.name !== "owner" &&
          field.name !== "modified_by" &&
          !field.hasDefaultValue
        ) {
          if (record[field.name] === null || record[field.name] === undefined) {
            missingFields.push(field.name);
          }
        }
      }

      if (missingFields.length > 0) {
        return NextResponse.json(
          {
            error: `Cannot submit: mandatory fields are empty`,
            missing_fields: missingFields,
          },
          { status: 400 },
        );
      }
    }

    // ── Perform the submit + cascade children atomically ────────────────
    const now = new Date();
    const childAccessors = findChildAccessors(doctype);

    const updated = await prisma.$transaction(async (tx: any) => {
      const result = await tx[resolved.accessor].update({
        where: { name },
        data: {
          docstatus: 1,
          modified: now,
          modified_by: "Administrator",
        },
      });

      // Update child-table rows docstatus to match parent
      for (const childAccessor of childAccessors) {
        const childDelegate = tx[childAccessor];
        if (childDelegate && typeof childDelegate.updateMany === "function") {
          await childDelegate.updateMany({
            where: { parent: name },
            data: { docstatus: 1 },
          });
        }
      }

      return result;
    });

    return NextResponse.json({
      data: updated,
      message: `${doctype} "${name}" submitted successfully`,
    });
  } catch (err: any) {
    console.error("[erpnext/submit] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Find child-table model accessors that belong to a given parent doctype.
 * Uses Prisma DMMF to discover models with `parenttype` / `parent` fields,
 * then matches them to the parent doctype.
 */
function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];
  const dmmfModels = Prisma.dmmf.datamodel.models;

  for (const m of dmmfModels) {
    const hasParentType = m.fields.some((f: any) => f.name === "parenttype");
    const hasParent = m.fields.some((f: any) => f.name === "parent");
    const hasParentfield = m.fields.some((f: any) => f.name === "parentfield");
    if (hasParentType && hasParent && hasParentfield) {
      // Check if any field's default value references the parent doctype,
      // or if the model name starts with the parent doctype (naming convention)
      const defaultMatchesParent = m.fields.some(
        (f: any) =>
          f.name === "parenttype" &&
          f.default &&
          (String(f.default) === doctype ||
            (typeof f.default === "object" && f.default !== null && String((f.default as any).value) === doctype)),
      );
      if (defaultMatchesParent || m.name.startsWith(doctype)) {
        results.push(toAccessor(m.name));
      }
    }
  }
  return results;
}
