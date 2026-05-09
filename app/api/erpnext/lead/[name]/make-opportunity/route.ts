/**
 * Lead → Opportunity conversion (make_opportunity)
 *
 * Creates an Opportunity from a Lead, copying contact info, company,
 * and other CRM fields. The opportunity_from is set to "Lead".
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";
import type { Prisma } from "@/prisma/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Lead ─────────────────────────────────────────────
  const lead = await prisma.lead.findUnique({ where: { name } });

  if (!lead) {
    return NextResponse.json(
      { error: `Lead ${name} not found` },
      { status: 404 },
    );
  }

  // ── Check if already converted ─────────────────────────────────────
  if (lead.status === "Converted" && lead.customer) {
    return NextResponse.json(
      { error: "Lead is already converted to a Customer" },
      { status: 400 },
    );
  }

  // ── Generate new Opportunity name ─────────────────────────────────
  const oppName = generateShortCode("OPP");

  // ── Create Opportunity header atomically ──────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    const opp = await tx.opportunity.create({
      data: {
        name: oppName,
        docstatus: 0,
        naming_series: "OPP-.YYYY.-",
        opportunity_from: "Lead",
        party_name: lead.name,
        customer_name: lead.lead_name ?? lead.company_name ?? "",
        title: lead.lead_name ?? lead.company_name ?? lead.name,
        currency: "USD",
        company: lead.company ?? "",
        transaction_date: new Date(),
        customer_address: lead.city ?? "",
        territory: lead.territory,
        customer_group: lead.industry,
        contact_person: lead.name,
        contact_email: lead.email_id,
        contact_mobile: lead.mobile_no ?? lead.phone ?? "",
        phone: lead.phone,
        city: lead.city,
        state: lead.state,
        country: lead.country,
        industry: lead.industry,
        market_segment: lead.market_segment,
        language: lead.language,
        no_of_employees: lead.no_of_employees,
        annual_revenue: lead.annual_revenue,
        website: lead.website,
        job_title: lead.job_title,
        utm_source: lead.utm_source,
        utm_campaign: lead.utm_campaign,
        utm_medium: lead.utm_medium,
        utm_content: lead.utm_content,
        status: "Open",
        sales_stage: "Prospecting",
        probability: 100,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
      } as unknown as Prisma.OpportunityCreateInput,
    });

    return opp;
  });

  // ── Return the new Opportunity ─────────────────────────────────────
  const oppResult = await prisma.opportunity.findUnique({
    where: { name: oppName },
  });

  return NextResponse.json({ data: oppResult }, { status: 201 });
}
