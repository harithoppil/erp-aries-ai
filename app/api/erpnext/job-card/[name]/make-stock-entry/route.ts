/**
 * Job Card → Stock Entry conversion (make_stock_entry)
 *
 * Creates a Stock Entry with purpose "Manufacture" from a submitted Job Card.
 * Copies work_order and operation from the Job Card.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Job Card ──────────────────────────────────────────
  const jc = await prisma.jobCard.findUnique({ where: { name } });

  if (!jc) {
    return NextResponse.json(
      { error: `Job Card ${name} not found` },
      { status: 404 },
    );
  }

  if (jc.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Job Cards can be converted" },
      { status: 400 },
    );
  }

  // ── Generate new SE name ───────────────────────────────────────────
  const seName = generateShortCode("STE");

  // ── Create Stock Entry atomically ──────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx) => {
    const se = await tx.stockEntry.create({
      data: {
        name: seName,
        docstatus: 0,
        naming_series: "STE-.YYYY.-",
        purpose: "Manufacture",
        company: jc.company,
        work_order: jc.work_order,
        job_card: jc.name,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        from_warehouse: jc.wip_warehouse,
        fg_completed_qty: jc.for_quantity,
        bom_no: jc.bom_no,
        project: jc.project,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
      } as any,
    });

    return se;
  });

  // ── Return the new SE ──────────────────────────────────────────────
  const seResult = await prisma.stockEntry.findUnique({
    where: { name: seName },
  });

  return NextResponse.json({ data: seResult }, { status: 201 });
}
