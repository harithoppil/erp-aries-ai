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
import {
  PrismaDelegate,
  DmmfField,
  DmmfModel,
  FilterTriple,
  WhereClause,
  toAccessor,
  getDelegate,
  getDelegateByAccessor,
} from "@/lib/erpnext/prisma-delegate";
import { validateDocument } from "@/lib/erpnext/validation";
import { success, error, validationError, notFound } from "@/lib/erpnext/api-response";
import type { ApiResponse } from "@/lib/erpnext/api-response";
import { withCors, corsPreflightResponse } from "@/lib/erpnext/cors";
import {
  logRequestStart,
  logRequestEnd,
} from "@/lib/erpnext/request-logger";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Safely resolve a Prisma delegate from a doctype string. */
function getModel(doctype: string): { model: PrismaDelegate; accessor: string } | null {
  const accessor = toAccessor(doctype);
  const model = getDelegate(prisma, doctype);
  if (!model) return null;
  return { model, accessor };
}

/**
 * Find child-table model accessors that belong to a given parent doctype.
 * Uses Prisma DMMF to discover models with `parenttype` / `parent` fields,
 * then matches them to the parent doctype.
 */
function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];
  const dmmfModels = Prisma.dmmf.datamodel.models as unknown as DmmfModel[];

  for (const m of dmmfModels) {
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
function parseFilters(filtersRaw: string): WhereClause {
  let parsed: unknown[];
  try {
    parsed = JSON.parse(filtersRaw);
  } catch {
    return {};
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return {};

  // Detect OR-group: outermost array whose first element is also an array of filters
  // e.g. [[["f1","=","v1"],["f2","=","v2"]],[["f3","=","v3"]]]
  const isOrGroup = Array.isArray(parsed[0]) && Array.isArray((parsed[0] as unknown[])[0]);

  if (isOrGroup) {
    return {
      OR: (parsed as unknown[][]).map((group: unknown[]) => {
        const andClauses = (group as FilterTriple[]).map(buildClause).filter(Boolean);
        return andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
      }),
    };
  }

  // Flat AND array
  const clauses = (parsed as FilterTriple[]).map(buildClause).filter(Boolean);
  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}

function buildClause(triple: FilterTriple): WhereClause {
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

// ── OPTIONS — Preflight ────────────────────────────────────────────────────────

export async function OPTIONS() {
  return corsPreflightResponse();
}

// ── GET — List ────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const logCtx = logRequestStart("GET", req.nextUrl.pathname);
  try {
    const { doctype } = await params;
    const resolved = getModel(doctype);
    if (!resolved) {
      const resp = NextResponse.json(
        error(`Unknown DocType: ${doctype}`, "NOT_FOUND"),
        { status: 404 },
      );
      logRequestEnd(logCtx, 404);
      return withCors(resp);
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

    const page = Math.floor(offset / limit) + 1;
    const resp = NextResponse.json(
      success(data, {
        page,
        pageSize: limit,
        total,
        hasMore: offset + limit < total,
      }),
    );
    logRequestEnd(logCtx, 200);
    return withCors(resp);
  } catch (e: any) {
    console.error("[erpnext/list] Error:", e?.message);
    const resp = NextResponse.json(
      error(e?.message || "Internal server error", "INTERNAL_ERROR"),
      { status: 500 },
    );
    logRequestEnd(logCtx, 500);
    return withCors(resp);
  }
}

// ── POST — Create ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string }> },
) {
  const logCtx = logRequestStart("POST", req.nextUrl.pathname);
  try {
    const { doctype } = await params;
    const resolved = getModel(doctype);
    if (!resolved) {
      const resp = NextResponse.json(
        error(`Unknown DocType: ${doctype}`, "NOT_FOUND"),
        { status: 404 },
      );
      logRequestEnd(logCtx, 404);
      return withCors(resp);
    }
    const { model } = resolved;

    const body = await req.json() as Record<string, unknown>;

    // ── Validation ──────────────────────────────────────────────────────
    if (!body || typeof body !== "object") {
      const resp = NextResponse.json(
        error("Request body must be a JSON object", "INVALID_BODY"),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
    }

    // Ensure primary key `name` is present (erpnext_port models use name as @id)
    if (!body.name) {
      const resp = NextResponse.json(
        error("Field 'name' (primary key) is required", "MISSING_PK"),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
    }

    // Enforce draft state on creation
    body.docstatus = body.docstatus ?? 0;
    if (body.docstatus !== 0) {
      const resp = NextResponse.json(
        error("New documents must be created in Draft state (docstatus=0)", "INVALID_DOCSTATUS"),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
    }

    // ── Zod schema validation ───────────────────────────────────────────
    const validation = validateDocument(doctype, body);
    if (!validation.valid) {
      const resp = NextResponse.json(
        validationError(validation.errors),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
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
    const childTables: Record<string, unknown[]> = {};
    const parentFields: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(body)) {
      if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object") {
        childTables[key] = val;
      } else {
        parentFields[key] = val;
      }
    }

    // Create parent + children atomically in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const txModel = (tx as Record<string, unknown>)[resolved.accessor] as PrismaDelegate;
      const created = await txModel.create({
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
            const delegate = getDelegateByAccessor(tx as Record<string, unknown>, candidate);
            if (delegate) {
              childAccessor = candidate;
              break;
            }
          }
        }

        if (childAccessor) {
          const childModel = (tx as Record<string, unknown>)[childAccessor] as PrismaDelegate;
          const childRows = (rows as Record<string, unknown>[]).map((row, i) => ({
            ...row,
            parent: body.name,
            parentfield: field,
            parenttype: doctype,
            idx: row.idx ?? i + 1,
            docstatus: row.docstatus ?? 0,
          }));
          await childModel.createMany({ data: childRows });
        }
      }

      // Re-fetch the created record to return with all fields
      return await txModel.findUnique({ where: { name: body.name as string } });
    });

    const resp = NextResponse.json(success(result), { status: 201 });
    logRequestEnd(logCtx, 201);
    return withCors(resp);
  } catch (e: any) {
    console.error("[erpnext/create] Error:", e?.message);

    // Prisma unique constraint violation
    if (e?.code === "P2002") {
      const doctype = (await params).doctype;
      const resp = NextResponse.json(
        error(`A ${doctype} with this name already exists`, "DUPLICATE"),
        { status: 409 },
      );
      logRequestEnd(logCtx, 409);
      return withCors(resp);
    }

    // Prisma required-field violation
    if (e?.code === "P2000" || e?.code === "P2012") {
      const resp = NextResponse.json(
        error(`Missing required field: ${e?.meta?.field_name || "unknown"}`, "MISSING_FIELD"),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
    }

    const resp = NextResponse.json(
      error(e?.message || "Internal server error", "INTERNAL_ERROR"),
      { status: 500 },
    );
    logRequestEnd(logCtx, 500);
    return withCors(resp);
  }
}
