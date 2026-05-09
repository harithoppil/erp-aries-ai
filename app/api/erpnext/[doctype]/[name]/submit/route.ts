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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  try {
    const { doctype, name } = await params;

    // Extract session token from cookies for user-scoped RBAC
    const token = req.cookies.get("token")?.value;

    // Use the orchestrator which handles validation, GL, stock, etc.
    const result = await submitDocument(doctype, name, { token });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      data: result.data,
      gl_entries_count: result.gl_entries_count,
      stock_entries_count: result.stock_entries_count,
      message: `${doctype} "${name}" submitted successfully`,
    });
  } catch (error: any) {
    console.error("[erpnext/submit] Error:", error?.message);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 },
    );
  }
}
