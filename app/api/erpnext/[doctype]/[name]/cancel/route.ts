/**
 * ERPNext Cancel — Transition docstatus 1 → 2
 *
 * POST /api/erpnext/:doctype/:name/cancel
 *
 * Only Submitted (docstatus=1) documents can be cancelled.
 * Cancellation reverses the posting — GL entries are negated,
 * stock ledger entries are reversed, and linked documents may
 * need to be updated (e.g. outstanding amounts restored).
 *
 * Cancelled documents cannot be amended — users should create
 * a new document with `amended_from` pointing to the cancelled one.
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

/** Check if any other submitted documents reference this one. */
async function checkDependencies(
  doctype: string,
  name: string,
): Promise<{ blocked: boolean; references: string[] }> {
  const references: string[] = [];

  // Map of doctypes that commonly reference each other.
  // In a full implementation this would come from the DocType meta's
  // "is_submittable" + link fields, but for now we use a static map.
  const dependencyMap: Record<string, { doctype: string; field: string }[]> = {
    SalesOrder: [
      { doctype: "SalesInvoice", field: "sales_order" },
      { doctype: "DeliveryNote", field: "against_sales_order" },
    ],
    PurchaseOrder: [
      { doctype: "PurchaseReceipt", field: "against_purchase_order" },
      { doctype: "PurchaseInvoice", field: "purchase_order" },
    ],
    Quotation: [
      { doctype: "SalesOrder", field: "quotation" },
    ],
    MaterialRequest: [
      { doctype: "PurchaseOrder", field: "material_request" },
      { doctype: "SalesOrder", field: "material_request" },
    ],
  };

  const deps = dependencyMap[doctype];
  if (!deps) return { blocked: false, references };

  for (const dep of deps) {
    const depAccessor = toAccessor(dep.doctype);
    const depModel = (prisma as any)[depAccessor];
    if (depModel && typeof depModel.findMany === "function") {
      try {
        // Check for submitted (docstatus=1) records referencing this document
        const linked = await depModel.findMany({
          where: {
            [dep.field]: name,
            docstatus: 1,
          },
          select: { name: true },
        });
        for (const doc of linked) {
          references.push(`${dep.doctype}: ${doc.name}`);
        }
      } catch {
        // Field might not exist on the model — skip silently
      }
    }
  }

  return { blocked: references.length > 0, references };
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

// ── POST — Cancel ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
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

    if (currentStatus === 0) {
      return NextResponse.json(
        { error: `${doctype} "${name}" is a Draft. Use DELETE to remove it, or submit it first.` },
        { status: 400 },
      );
    }

    if (currentStatus === 2) {
      return NextResponse.json(
        { error: `${doctype} "${name}" is already cancelled` },
        { status: 409 },
      );
    }

    if (currentStatus !== 1) {
      return NextResponse.json(
        { error: `Unexpected docstatus=${currentStatus} for ${doctype} "${name}"` },
        { status: 400 },
      );
    }

    // ── Dependency check ────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const forceCancel = body.force === true || req.nextUrl.searchParams.get("force") === "1";

    if (!forceCancel) {
      const { blocked, references } = await checkDependencies(doctype, name);
      if (blocked) {
        return NextResponse.json(
          {
            error: `Cannot cancel ${doctype} "${name}": submitted documents depend on it`,
            dependencies: references,
            hint: "Cancel the dependent documents first, or retry with ?force=1",
          },
          { status: 409 },
        );
      }
    }

    // ── Perform the cancel + cascade children atomically ─────────────────
    const now = new Date();
    const childAccessors = findChildAccessors(doctype);

    const updated = await prisma.$transaction(async (tx: any) => {
      const result = await tx[accessor].update({
        where: { name },
        data: {
          docstatus: 2,
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
            data: { docstatus: 2 },
          });
        }
      }

      return result;
    });

    return NextResponse.json({
      data: updated,
      message: `${doctype} "${name}" cancelled successfully`,
    });
  } catch (err: any) {
    console.error("[erpnext/cancel] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
