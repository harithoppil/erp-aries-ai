/**
 * ERPNext CRUD — List & Create
 *
 * GET  /api/erpnext/:doctype          — list records with filters, pagination, sorting
 * POST /api/erpnext/:doctype          — create a new record
 *
 * Query params (GET):
 *   fields   — comma-separated field list (default: name)
 *   filters  — JSON array of [field, operator, value] triples
 *              e.g. [["customer_group","=","Commercial"]]
 *              or nested: [[["field1","=","val1"],["field2","like","%test%"]]]
 *   limit    — page size (default 20, max 200)
 *   offset   — skip count (default 0)
 *   orderby  — field name (default: creation)
 *   order    — "asc" | "desc" (default: desc)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/client";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert PascalCase DocType name to the camelCase Prisma accessor. */
function toAccessor(doctype: string): string {
  return doctype.charAt(0).toLowerCase() + doctype.slice(1);
}

/** Safely resolve a Prisma delegate from a doctype string. */
function getModel(doctype: string): { model: any; accessor: string } | null {
  const accessor = toAccessor(doctype);
  const delegate = (prisma as any)[accessor];
  if (!delegate || typeof delegate.findMany !== "function") return null;
  return { model: delegate, accessor };
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

/**
 * Parse ERPNext-style filters into a Prisma `where` object.
 *
 * Supported forms:
 *   - [["field","=","value"]]                         — single filter
 *   - [["field1","=","v1"],["field2","like","%x%"]]   — AND (flat array)
 *   - [[["f1","=","v1"],["f2","like","%x%"]]]         — OR (nested array)
 *
 * Operators: =, !=, <, >, <=, >=, like, not like, in, not in, is, between
 */
function parseFilters(filtersRaw: string): any {
  let parsed: any[];
  try {
    parsed = JSON.parse(filtersRaw);
  } catch {
    return {};
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return {};

  // Detect OR-group: outermost array whose first element is also an array of filters
  // e.g. [[["f1","=","v1"],["f2","=","v2"]],[["f3","=","v3"]]]
  const isOrGroup = Array.isArray(parsed[0]) && Array.isArray(parsed[0][0]);

  if (isOrGroup) {
    return {
      OR: parsed.map((group: any[]) => {
        const andClauses = group.map(buildClause).filter(Boolean);
        return andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
      }),
    };
  }

  // Flat AND array
  const clauses = parsed.map(buildClause).filter(Boolean);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

function buildClause(triple: any[]): any {
  if (!Array.isArray(triple) || triple.length < 3) return {};
  const [field, op, value] = triple;

  switch (op) {
    case "=":
      return { [field]: value };
    case "!=":
      return { [field]: { not: value } };
    case "<":
      return { [field]: { lt: value } };
    case ">":
      return { [field]: { gt: value } };
    case "<=":
      return { [field]: { lte: value } };
    case ">=":
      return { [field]: { gte: value } };
    case "like": {
      const v = String(value);
      const hasStart = !v.startsWith("%");
      const hasEnd = !v.endsWith("%");
      const stripped = v.replace(/^%+|%+$/g, "");
      if (!hasStart && !hasEnd) return { [field]: { contains: stripped, mode: "insensitive" } };
      if (hasStart && !hasEnd) return { [field]: { startsWith: stripped, mode: "insensitive" } };
      if (!hasStart && hasEnd) return { [field]: { endsWith: stripped, mode: "insensitive" } };
      return { [field]: { equals: stripped, mode: "insensitive" } };
    }
    case "not like": {
      const v = String(value);
      const hasStart = !v.startsWith("%");
      const hasEnd = !v.endsWith("%");
      const stripped = v.replace(/^%+|%+$/g, "");
      if (!hasStart && !hasEnd) return { NOT: { [field]: { contains: stripped, mode: "insensitive" } } };
      if (hasStart && !hasEnd) return { NOT: { [field]: { startsWith: stripped, mode: "insensitive" } } };
      if (!hasStart && hasEnd) return { NOT: { [field]: { endsWith: stripped, mode: "insensitive" } } };
      return { NOT: { [field]: { equals: stripped, mode: "insensitive" } } };
    }
    case "in":
      return { [field]: { in: Array.isArray(value) ? value : [value] } };
    case "not in":
      return { [field]: { notIn: Array.isArray(value) ? value : [value] } };
    case "is":
      return value === "set"
        ? { [field]: { not: null } }
        : { [field]: null };
    case "between": {
      const [lo, hi] = Array.isArray(value) ? value : [value, value];
      return { AND: [{ [field]: { gte: lo } }, { [field]: { lte: hi } }] };
    }
    default:
      return { [field]: value };
  }
}

// ── GET — List ────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const resolved = getModel(doctype);
    if (!resolved) {
      return NextResponse.json(
        { error: `Unknown DocType: ${doctype}` },
        { status: 404 },
      );
    }
    const { model } = resolved;

    const url = req.nextUrl;
    const fieldsRaw = url.searchParams.get("fields") || "";
    const filtersRaw = url.searchParams.get("filters") || "";
    const limit = Math.min(
      Math.max(parseInt(url.searchParams.get("limit") || "20", 10), 1),
      200,
    );
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10), 0);
    const orderby = url.searchParams.get("orderby") || "creation";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

    // Build query
    const where = filtersRaw ? parseFilters(filtersRaw) : undefined;

    const select = fieldsRaw
      ? fieldsRaw.split(",").reduce((acc: Record<string, true>, f: string) => {
          acc[f.trim()] = true;
          return acc;
        }, {})
      : undefined;

    // Always include the primary key so the caller can identify rows
    if (select && !select.name) select.name = true;

    const [data, total] = await Promise.all([
      model.findMany({
        where,
        select: select || undefined,
        orderBy: { [orderby]: order },
        take: limit,
        skip: offset,
      }),
      model.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("[erpnext/list] Error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}

// ── POST — Create ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  try {
    const { doctype } = await params;
    const resolved = getModel(doctype);
    if (!resolved) {
      return NextResponse.json(
        { error: `Unknown DocType: ${doctype}` },
        { status: 404 },
      );
    }
    const { model } = resolved;

    const body = await req.json();

    // ── Validation ──────────────────────────────────────────────────────
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 },
      );
    }

    // Ensure primary key `name` is present (erpnext_port models use name as @id)
    if (!body.name) {
      return NextResponse.json(
        { error: "Field 'name' (primary key) is required" },
        { status: 400 },
      );
    }

    // Enforce draft state on creation
    body.docstatus = body.docstatus ?? 0;
    if (body.docstatus !== 0) {
      return NextResponse.json(
        { error: "New documents must be created in Draft state (docstatus=0)" },
        { status: 400 },
      );
    }

    // Stamp audit fields
    const now = new Date();
    if (!body.creation) body.creation = now;
    if (!body.modified) body.modified = now;
    if (!body.owner) body.owner = "Administrator";
    if (!body.modified_by) body.modified_by = "Administrator";
    if (body.idx === undefined) body.idx = 0;

    // Separate child-table arrays from parent fields
    // Child tables are arrays of objects with parent/parentfield/parenttype
    const childTables: Record<string, any[]> = {};
    const parentFields: Record<string, any> = {};

    for (const [key, val] of Object.entries(body)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        childTables[key] = val as any[];
      } else {
        parentFields[key] = val;
      }
    }

    // Create parent + children atomically in a transaction
    const result = await prisma.$transaction(async (tx: any) => {
      const created = await tx[resolved.accessor].create({
        data: parentFields,
      });

      // Create child-table rows using the DMMF-based child accessors
      const childAccessors = findChildAccessors(doctype);

      for (const [field, rows] of Object.entries(childTables)) {
        // Find the child model that handles this parentfield
        let childAccessor: string | null = null;
        for (const accessor of childAccessors) {
          if (accessor.endsWith(toAccessor(field)) || accessor === toAccessor(doctype) + field.charAt(0).toUpperCase() + field.slice(1)) {
            childAccessor = accessor;
            break;
          }
        }

        // Fallback: try naming convention
        if (!childAccessor) {
          const childAccessorCandidates = [
            toAccessor(doctype) + field.charAt(0).toUpperCase() + field.slice(1),
            toAccessor(doctype) + "Item",
            toAccessor(doctype.replace(/s$/, "")) + toAccessor(field),
          ];
          for (const candidate of childAccessorCandidates) {
            const delegate = tx[candidate];
            if (delegate && typeof delegate.createMany === "function") {
              childAccessor = candidate;
              break;
            }
          }
        }

        if (childAccessor) {
          const childRows = rows.map((row: any, i: number) => ({
            ...row,
            parent: body.name,
            parentfield: field,
            parenttype: doctype,
            idx: row.idx ?? i + 1,
            docstatus: row.docstatus ?? 0,
          }));
          await tx[childAccessor].createMany({ data: childRows });
        }
      }

      // Re-fetch the created record to return with all fields
      return await tx[resolved.accessor].findUnique({ where: { name: body.name } });
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (err: any) {
    console.error("[erpnext/create] Error:", err?.message);

    // Prisma unique constraint violation
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: `A ${await params.then(p => p.doctype)} with this name already exists` },
        { status: 409 },
      );
    }

    // Prisma required-field violation
    if (err?.code === "P2000" || err?.code === "P2012") {
      return NextResponse.json(
        { error: `Missing required field: ${err?.meta?.field_name || "unknown"}` },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
