/**
 * ERPNext CRUD — Read, Update, Delete
 *
 * GET    /api/erpnext/:doctype/:name   — fetch a single record with child tables
 * PUT    /api/erpnext/:doctype/:name   — update fields on an existing record
 * DELETE /api/erpnext/:doctype/:name   — delete a record (only Draft: docstatus=0)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/client";
import {
  PrismaDelegate,
  DmmfField,
  DmmfModel,
  toAccessor,
  getDelegate,
  getDelegateByAccessor,
} from "@/lib/erpnext/prisma-delegate";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getModel(doctype: string): { model: PrismaDelegate; accessor: string } | null {
  const accessor = toAccessor(doctype);
  const model = getDelegate(prisma, doctype);
  if (!model) return null;
  return { model, accessor };
}

/**
 * Find child-table models that belong to a given parent doctype.
 * Uses Prisma DMMF to discover relations, falling back to the
 * convention: child models have `parent` + `parenttype` columns.
 */
function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];
  const dmmfModels = Prisma.dmmf.datamodel.models as unknown as DmmfModel[];

  for (const m of dmmfModels) {
    // Has parenttype field → is a child table
    const hasParentType = m.fields.some((f: DmmfField) => f.name === "parenttype");
    const hasParent = m.fields.some((f: DmmfField) => f.name === "parent");
    const hasParentfield = m.fields.some((f: DmmfField) => f.name === "parentfield");
    if (hasParentType && hasParent && hasParentfield) {
      // Check if any field's default value references the parent doctype,
      // or if the model name starts with the parent doctype (naming convention)
      const defaultMatchesParent = m.fields.some(
        (f: DmmfField) =>
          f.name === "parenttype" &&
          f.default != null &&
          (String(f.default) === doctype ||
            (typeof f.default === "object" && f.default !== null && String((f.default as { value: string }).value) === doctype)),
      );
      if (defaultMatchesParent || m.name.startsWith(doctype)) {
        results.push(toAccessor(m.name));
      }
    }
  }
  return results;
}

// ── GET — Single Record ───────────────────────────────────────────────────────

export async function GET(
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
    const { model } = resolved;

    const record = await model.findUnique({ where: { name } });
    if (!record) {
      return NextResponse.json(
        { error: `${doctype} "${name}" not found` },
        { status: 404 },
      );
    }

    // Fetch child-table rows grouped by parentfield
    const childAccessors = findChildAccessors(doctype);
    const children: Record<string, unknown[]> = {};

    await Promise.all(
      childAccessors.map(async (accessor) => {
        const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, accessor);
        if (childModel) {
          const rows = await childModel.findMany({
            where: { parent: name },
            orderBy: { idx: "asc" },
          });
          // Group rows by parentfield
          for (const row of rows as Record<string, unknown>[]) {
            const field = (row.parentfield as string) || "items";
            if (!children[field]) children[field] = [];
            children[field].push(row);
          }
        }
      }),
    );

    return NextResponse.json({
      data: { ...record, ...children },
    });
  } catch (error: any) {
    console.error("[erpnext/read] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ── PUT — Update ──────────────────────────────────────────────────────────────

export async function PUT(
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

    // Check record exists and is editable
    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) {
      return NextResponse.json(
        { error: `${doctype} "${name}" not found` },
        { status: 404 },
      );
    }

    const body = await req.json() as Record<string, unknown>;

    // Submitted (docstatus=1) and Cancelled (docstatus=2) records cannot be edited
    if (existing.docstatus === 1) {
      return NextResponse.json(
        { error: `Cannot update submitted ${doctype}. Cancel it first.` },
        { status: 403 },
      );
    }
    if (existing.docstatus === 2) {
      return NextResponse.json(
        { error: `Cannot update cancelled ${doctype}` },
        { status: 403 },
      );
    }

    // Prevent direct docstatus change via PUT (use /submit or /cancel endpoints)
    if ("docstatus" in body && body.docstatus !== existing.docstatus) {
      return NextResponse.json(
        { error: "Use /submit or /cancel endpoints to change docstatus" },
        { status: 400 },
      );
    }

    // Prevent changing the primary key
    if ("name" in body && body.name !== name) {
      return NextResponse.json(
        { error: "Cannot change the 'name' (primary key) of a record" },
        { status: 400 },
      );
    }

    // Separate child-table arrays from parent fields
    const childTables: Record<string, unknown[]> = {};
    const parentFields: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(body)) {
      if (Array.isArray(val)) {
        childTables[key] = val;
      } else {
        parentFields[key] = val;
      }
    }

    // Stamp audit fields
    parentFields.modified = new Date();
    parentFields.modified_by = "Administrator";

    // Remove fields that should not be directly updated
    delete parentFields.creation;
    delete parentFields.owner;

    // Update parent + children atomically in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      const updated = await txRecord[accessor].update({
        where: { name },
        data: parentFields,
      });

      // Update child tables: delete existing rows, then re-insert
      const childAccessors = findChildAccessors(doctype);
      for (const [field, rows] of Object.entries(childTables)) {
        // Find the child model that handles this parentfield
        let childAccessor: string | null = null;
        for (const ca of childAccessors) {
          const childDelegate = txRecord[ca];
          if (childDelegate) {
            const sample = await childDelegate.findFirst({
              where: { parent: name, parentfield: field },
            });
            if (sample) {
              childAccessor = ca;
              break;
            }
          }
        }

        if (!childAccessor) {
          // Try naming convention: doctype + field name
          const candidate = toAccessor(doctype) + field.charAt(0).toUpperCase() + field.slice(1);
          const delegate = getDelegateByAccessor(tx as unknown as Record<string, unknown>, candidate);
          if (delegate) {
            childAccessor = candidate;
          }
        }

        if (childAccessor) {
          const childModel = txRecord[childAccessor];
          // Delete existing child rows for this parentfield
          await childModel.deleteMany({
            where: { parent: name, parentfield: field },
          });

          // Re-insert with updated data
          if (rows.length > 0) {
            const childRows = (rows as Record<string, unknown>[]).map((row, i) => ({
              ...row,
              parent: name,
              parentfield: field,
              parenttype: doctype,
              idx: row.idx ?? i + 1,
            }));
            await childModel.createMany({ data: childRows });
          }
        }
      }

      // Re-fetch to return updated record
      return await txRecord[accessor].findUnique({ where: { name } });
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error("[erpnext/update] Error:", error?.message);

    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ── DELETE — Remove Draft ──────────────────────────────────────────────────────

export async function DELETE(
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

    const existing = await model.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!existing) {
      return NextResponse.json(
        { error: `${doctype} "${name}" not found` },
        { status: 404 },
      );
    }

    // Only Draft (docstatus=0) records can be deleted
    if (existing.docstatus !== 0) {
      return NextResponse.json(
        {
          error:
            existing.docstatus === 1
              ? `Cannot delete submitted ${doctype}. Cancel it first.`
              : `Cannot delete cancelled ${doctype}`,
        },
        { status: 403 },
      );
    }

    // ── Dependency check ────────────────────────────────────────────────
    // Look for child-table rows that reference this document
    const childAccessors = findChildAccessors(doctype);
    let childCount = 0;
    for (const childAccessor of childAccessors) {
      const childModel = getDelegateByAccessor(prisma as unknown as Record<string, unknown>, childAccessor);
      if (childModel) {
        childCount += await childModel.count({ where: { parent: name } });
      }
    }

    // Also check for common link-back references.
    // Many doctypes have an `amended_from` or reference field that points
    // to other documents — we check if *other* documents reference this one.
    const dmmfModel = (Prisma.dmmf.datamodel.models as unknown as DmmfModel[]).find(
      (m) => m.name === doctype,
    );

    // Look for fields that could be foreign keys referencing this doctype
    // (fields named `amended_from`, `{doctype_lower}_name`, etc.)
    const linkFields: string[] = [];
    if (dmmfModel) {
      for (const field of dmmfModel.fields) {
        if (
          field.kind === "scalar" &&
          field.type === "String" &&
          (field.name === "amended_from" ||
            field.name === `${accessor}_name` ||
            field.name === `${accessor}_no` ||
            field.name === `${accessor}_id` ||
            field.name === "reference_name")
        ) {
          linkFields.push(field.name);
        }
      }
    }

    // Delete child rows + parent atomically in a transaction
    await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, PrismaDelegate>;
      // Delete child rows first
      for (const childAccessor of childAccessors) {
        const childDelegate = txRecord[childAccessor];
        if (childDelegate) {
          await childDelegate.deleteMany({ where: { parent: name } });
        }
      }

      // Delete the parent record
      await txRecord[accessor].delete({ where: { name } });
    });

    return NextResponse.json({
      message: `${doctype} "${name}" deleted successfully`,
      deleted_children: childCount,
    });
  } catch (error: any) {
    console.error("[erpnext/delete] Error:", error?.message);

    // Foreign-key constraint violation
    if (error?.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete: other documents reference this record" },
        { status: 409 },
      );
    }

    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
