/**
 * Lead → Customer conversion (make_customer)
 *
 * Creates a new Customer from a Lead.
 * Lead is NOT submittable — no docstatus check required.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Lead (no docstatus check — Lead is not submittable) ──
  const lead = await prisma.lead.findUnique({ where: { name } });

  if (!lead) {
    return NextResponse.json(
      { error: `Lead ${name} not found` },
      { status: 404 },
    );
  }

  // ── Generate new Customer name ─────────────────────────────────────
  const custName = generateShortCode("CUST");

  // ── Create Customer atomically ─────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx) => {
    const cust = await tx.customer.create({
      data: {
        name: custName,
        docstatus: 0,
        naming_series: "CUST-.YYYY.-",
        customer_name: lead.lead_name ?? "",
        email_id: lead.email_id,
        mobile_no: lead.mobile_no,
        phone: lead.phone,
        territory: lead.territory,
        industry: lead.industry,
        market_segment: lead.market_segment,
        lead_name: lead.name,
        image: lead.image,
        gender: lead.gender,
        language: lead.language,
        customer_group: "All Customer Groups",
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
      } as any,
    });

    return cust;
  });

  // ── Return the new Customer ────────────────────────────────────────
  const custResult = await prisma.customer.findUnique({
    where: { name: custName },
  });

  return NextResponse.json({ data: custResult }, { status: 201 });
}
