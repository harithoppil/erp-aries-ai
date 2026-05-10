import { errorMessage } from '@/lib/utils';
/**
 * ERPNext Submit — Transition docstatus 0 → 1
 *
 * POST /api/erpnext/:doctype/:name/submit
 *
 * Delegates ALL business logic to the document-orchestrator:
 *   - Validation (mandatory fields, docstatus transition)
 *   - RBAC checks
 *   - GL entry creation
 *   - Stock ledger creation
 *   - Status updates
 *   - Child cascade
 *   - Transaction wrapping
 */

import { NextRequest, NextResponse } from "next/server";
import { submitDocument } from "@/lib/erpnext/document-orchestrator";
import { validateDocument as zodValidateDocument } from "@/lib/erpnext/validation";
import { success, error, validationError, forbidden } from "@/lib/erpnext/api-response";
import { withCors, corsPreflightResponse } from "@/lib/erpnext/cors";
import {
  logRequestStart,
  logRequestEnd,
} from "@/lib/erpnext/request-logger";
import { prisma } from "@/lib/prisma";
import { getDelegate, toAccessor } from "@/lib/erpnext/prisma-delegate";

// ── OPTIONS — Preflight ────────────────────────────────────────────────────────

export async function OPTIONS() {
  return corsPreflightResponse();
}

// ── POST — Submit ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  const logCtx = logRequestStart("POST", req.nextUrl.pathname);
  try {
    const { doctype, name } = await params;

    // Extract session token from cookies for user-scoped RBAC
    const token = req.cookies.get("token")?.value;

    // ── Pre-submit Zod validation ────────────────────────────────────────
    // Fetch the document to validate against the Zod schema
    const accessor = toAccessor(doctype);
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      const resp = NextResponse.json(
        error(`Unknown DocType: ${doctype}`, "NOT_FOUND"),
        { status: 404 },
      );
      logRequestEnd(logCtx, 404);
      return withCors(resp);
    }

    const existing = await delegate.findUnique({
      where: { name },
    }) as Record<string, unknown> | null;

    if (!existing) {
      const resp = NextResponse.json(
        error(`${doctype} "${name}" not found`, "NOT_FOUND"),
        { status: 404 },
      );
      logRequestEnd(logCtx, 404);
      return withCors(resp);
    }

    // Verify docstatus is Draft (0) before submit
    const currentDocstatus = Number(existing.docstatus ?? 0);
    if (currentDocstatus !== 0) {
      const code = currentDocstatus === 1 ? "ALREADY_SUBMITTED" : "CANCELLED";
      const msg =
        currentDocstatus === 1
          ? `${doctype} "${name}" is already submitted`
          : `Cannot submit cancelled ${doctype} "${name}"`;
      const resp = NextResponse.json(
        error(msg, code),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
    }

    // Run Zod validation on the existing document data
    const zodResult = zodValidateDocument(doctype, existing as Record<string, unknown>);
    if (!zodResult.valid) {
      const resp = NextResponse.json(
        validationError(zodResult.errors),
        { status: 400 },
      );
      logRequestEnd(logCtx, 400);
      return withCors(resp);
    }

    // Use the orchestrator which handles validation, GL, stock, etc.
    const result = await submitDocument(doctype, name, { token });

    if (!result.success) {
      // Determine the appropriate status code from the error
      const isForbidden =
        result.error?.includes("Permission denied") ||
        result.error?.includes("does not have");
      const isNotFound = result.error?.includes("not found");
      const isValidation = result.error?.includes("Validation failed");

      let status = 400;
      let code = "SUBMIT_FAILED";

      if (isForbidden) {
        status = 403;
        code = "FORBIDDEN";
      } else if (isNotFound) {
        status = 404;
        code = "NOT_FOUND";
      } else if (isValidation) {
        status = 400;
        code = "VALIDATION_ERROR";
      }

      const resp = NextResponse.json(
        error(result.error ?? "Submit failed", code),
        { status },
      );
      logRequestEnd(logCtx, status);
      return withCors(resp);
    }

    const resp = NextResponse.json(
      success({
        ...(result.data as Record<string, unknown>),
        gl_entries_count: result.gl_entries_count,
        stock_entries_count: result.stock_entries_count,
        message: `${doctype} "${name}" submitted successfully`,
      }),
    );
    logRequestEnd(logCtx, 200);
    return withCors(resp);
  } catch (e) {
    console.error("[erpnext/submit] Error:", errorMessage(e));
    const resp = NextResponse.json(
      error(errorMessage(e, "Internal server error"), "INTERNAL_ERROR"),
      { status: 500 },
    );
    logRequestEnd(logCtx, 500);
    return withCors(resp);
  }
}
