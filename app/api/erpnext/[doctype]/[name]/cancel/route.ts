/**
 * ERPNext Cancel — Transition docstatus 1 → 2
 *
 * POST /api/erpnext/:doctype/:name/cancel
 *
 * Delegates ALL business logic to the document-orchestrator:
 *   - Validation (docstatus transition, dependency checks)
 *   - GL entry reversal
 *   - Stock ledger reversal
 *   - Status updates
 *   - Child cascade
 *   - Transaction wrapping
 */

import { NextRequest, NextResponse } from "next/server";
import { cancelDocument } from "@/lib/erpnext/document-orchestrator";
import { success, error, forbidden } from "@/lib/erpnext/api-response";
import { withCors, corsPreflightResponse } from "@/lib/erpnext/cors";
import {
  logRequestStart,
  logRequestEnd,
} from "@/lib/erpnext/request-logger";

// ── OPTIONS — Preflight ────────────────────────────────────────────────────────

export async function OPTIONS() {
  return corsPreflightResponse();
}

// ── POST — Cancel ─────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  const logCtx = logRequestStart("POST", req.nextUrl.pathname);
  try {
    const { doctype, name } = await params;

    // Extract session token from cookies for user-scoped RBAC
    const token = req.cookies.get("token")?.value;

    const result = await cancelDocument(doctype, name, { token });

    if (!result.success) {
      // Determine the appropriate status code from the error
      const isForbidden =
        result.error?.includes("Permission denied") ||
        result.error?.includes("does not have");
      const isNotFound = result.error?.includes("not found");
      const isDraft = result.error?.includes("Draft");

      let status = 400;
      let code = "CANCEL_FAILED";

      if (isForbidden) {
        status = 403;
        code = "FORBIDDEN";
      } else if (isNotFound) {
        status = 404;
        code = "NOT_FOUND";
      } else if (isDraft) {
        status = 400;
        code = "DRAFT_CANNOT_CANCEL";
      }

      const resp = NextResponse.json(
        error(result.error ?? "Cancel failed", code),
        { status },
      );
      logRequestEnd(logCtx, status);
      return withCors(resp);
    }

    const resp = NextResponse.json(
      success({
        ...(result.data as Record<string, unknown>),
        message: `${doctype} "${name}" cancelled successfully`,
      }),
    );
    logRequestEnd(logCtx, 200);
    return withCors(resp);
  } catch (e: any) {
    console.error("[erpnext/cancel] Error:", e?.message);
    const resp = NextResponse.json(
      error(e?.message || "Internal server error", "INTERNAL_ERROR"),
      { status: 500 },
    );
    logRequestEnd(logCtx, 500);
    return withCors(resp);
  }
}
