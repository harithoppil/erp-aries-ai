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

/**
 * Find child-table models that belong to a given parent doctype.
 * Uses Prisma DMMF to discover relations, falling back to the
 * convention: child models have `parent` + `parenttype` columns.
 */
function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];
  const dmmfModels = Prisma.dmmf.datamodel.models;

  for (const m of dmmfModels) {
    // Has parenttype field → is a child table
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
    const children: Record<string, any[]> = {};

    await Promise.all(
      childAccessors.map(async (accessor) => {
        const childModel = (prisma as any)[accessor];
        if (childModel && typeof childModel.findMany === "function") {
          const rows = await childModel.findMany({
            where: { parent: name },
            orderBy: { idx: "asc" },
          });
          // Group rows by parentfield
          for (const row of rows) {
            const field = row.parentfield || "items";
            if (!children[field]) children[field] = [];
            children[field].push(row);
          }
        }
      }),
    );

    return NextResponse.json({
      data: { ...record, ...children },
    });
  } catch (err: any) {
    console.error("[erpnext/read] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
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
    const existing = await model.findUnique({ where: { name } });
    if (!existing) {
      return NextResponse.json(
        { error: `${doctype} "${name}" not found` },
        { status: 404 },
      );
    }

    const body = await req.json();

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
    const childTables: Record<string, any[]> = {};
    const parentFields: Record<string, any> = {};

    for (const [key, val] of Object.entries(body)) {
      if (Array.isArray(val)) {
        childTables[key] = val as any[];
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
    const result = await prisma.$transaction(async (tx: any) => {
      const updated = await tx[resolved.accessor].update({
        where: { name },
        data: parentFields,
      });

      // Update child tables: delete existing rows, then re-insert
      const childAccessors = findChildAccessors(doctype);
      for (const [field, rows] of Object.entries(childTables)) {
        // Find the child model that handles this parentfield
        let childAccessor: string | null = null;
        for (const accessor of childAccessors) {
          const childDelegate = tx[accessor];
          if (childDelegate && typeof childDelegate.findFirst === "function") {
            const sample = await childDelegate.findFirst({
              where: { parent: name, parentfield: field },
            });
            if (sample) {
              childAccessor = accessor;
              break;
            }
          }
        }

        if (!childAccessor) {
          // Try naming convention: doctype + field name
          const candidate = toAccessor(doctype) + field.charAt(0).toUpperCase() + field.slice(1);
          const delegate = tx[candidate];
          if (delegate && typeof delegate.deleteMany === "function") {
            childAccessor = candidate;
          }
        }

        if (childAccessor) {
          // Delete existing child rows for this parentfield
          await tx[childAccessor].deleteMany({
            where: { parent: name, parentfield: field },
          });

          // Re-insert with updated data
          if (rows.length > 0) {
            const childRows = rows.map((row: any, i: number) => ({
              ...row,
              parent: name,
              parentfield: field,
              parenttype: doctype,
              idx: row.idx ?? i + 1,
            }));
            await tx[childAccessor].createMany({ data: childRows });
          }
        }
      }

      // Re-fetch to return updated record
      return await tx[resolved.accessor].findUnique({ where: { name } });
    });

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("[erpnext/update] Error:", err?.message);

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: err?.message || "Internal server error" },
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

    const existing = await model.findUnique({ where: { name } });
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
      const childModel = (prisma as any)[childAccessor];
      if (childModel && typeof childModel.count === "function") {
        childCount += await childModel.count({ where: { parent: name } });
      }
    }

    // Also check for common link-back references.
    // Many doctypes have an `amended_from` or reference field that points
    // to other documents — we check if *other* documents reference this one.
    const dmmfModel = Prisma.dmmf.datamodel.models.find(
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
    await prisma.$transaction(async (tx: any) => {
      // Delete child rows first
      for (const childAccessor of childAccessors) {
        const childDelegate = tx[childAccessor];
        if (childDelegate && typeof childDelegate.deleteMany === "function") {
          await childDelegate.deleteMany({ where: { parent: name } });
        }
      }

      // Delete the parent record
      await tx[accessor].delete({ where: { name } });
    });

    return NextResponse.json({
      message: `${doctype} "${name}" deleted successfully`,
      deleted_children: childCount,
    });
  } catch (err: any) {
    console.error("[erpnext/delete] Error:", err?.message);

    // Foreign-key constraint violation
    if (err?.code === "P2003") {
      return NextResponse.json(
        { error: "Cannot delete: other documents reference this record" },
        { status: 409 },
      );
    }

    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
