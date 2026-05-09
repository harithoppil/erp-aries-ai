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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ doctype: string; name: string }> },
) {
  try {
    const { doctype, name } = await params;
    const result = await cancelDocument(doctype, name);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      data: result.data,
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
