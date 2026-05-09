/**
 * Opportunity → Quotation conversion (make_quotation)
 *
 * Copies party info, company, items, contact details from a submitted
 * Opportunity into a new Draft Quotation.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Opportunity ──────────────────────────────────────
  const opp = await prisma.opportunity.findUnique({ where: { name } });

  if (!opp) {
    return NextResponse.json(
      { error: `Opportunity ${name} not found` },
      { status: 404 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const oppItems = await prisma.opportunityItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new Quotation name ───────────────────────────────────
  const qtnName = generateShortCode("QT");

  // ── Determine quotation_to ────────────────────────────────────────
  // If opportunity_from is "Lead", quotation_to = "Lead"; if "Customer", "Customer"
  const quotationTo =
    opp.opportunity_from === "Customer" ? "Customer" : "Lead";

  // ── Create Quotation header + items atomically ─────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const qtn = await tx.quotation.create({
      data: {
        name: qtnName,
        docstatus: 0,
        naming_series: "SAL-QTN-.YYYY.-",
        quotation_to: quotationTo,
        party_name: opp.party_name,
        customer_name: opp.customer_name,
        company: opp.company,
        transaction_date: new Date(),
        order_type: "Sales",
        customer_address: opp.customer_address,
        address_display: opp.address_display,
        contact_person: opp.contact_person,
        contact_display: opp.contact_display,
        contact_mobile: opp.contact_mobile,
        contact_email: opp.contact_email,
        territory: opp.territory,
        customer_group: opp.customer_group,
        currency: opp.currency ?? "USD",
        conversion_rate: opp.conversion_rate ?? 1,
        tax_category: null,
        opportunity: opp.name,
        company_address: null,
        language: opp.language,
        incoterm: null,
        utm_campaign: opp.utm_campaign,
        utm_source: opp.utm_source,
        utm_medium: opp.utm_medium,
        utm_content: opp.utm_content,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as any,
    });

    // ── Create Quotation items from Opportunity items ─────────────────
    const qtnItemRows = oppItems.map((item, i) => ({
      name: generateShortCode("QTI"),
      parent: qtnName,
      parentfield: "items",
      parenttype: "Quotation",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      qty: item.qty ?? 1,
      uom: item.uom,
      item_group: item.item_group,
      brand: item.brand,
      rate: item.rate,
      amount: item.amount,
      base_rate: item.base_rate,
      base_amount: item.base_amount,
      prevdoc_doctype: "Opportunity",
      prevdoc_docname: opp.name,
    }));

    if (qtnItemRows.length > 0) {
      await tx.quotationItem.createMany({ data: qtnItemRows as any });
    }

    return qtn;
  });

  // ── Return the new Quotation ──────────────────────────────────────
  const qtnResult = await prisma.quotation.findUnique({
    where: { name: qtnName },
  });

  return NextResponse.json({ data: qtnResult }, { status: 201 });
}
