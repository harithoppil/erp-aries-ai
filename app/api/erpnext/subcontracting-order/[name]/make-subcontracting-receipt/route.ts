/**
 * Subcontracting Order → Subcontracting Receipt conversion (make_subcontracting_receipt)
 *
 * Creates a Subcontracting Receipt from a submitted Subcontracting Order.
 * Items have qty = Math.max(0, item.qty - (item.received_qty ?? 0)).
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

  // ── Fetch source Subcontracting Order ───────────────────────────────
  const sco = await prisma.subcontractingOrder.findUnique({
    where: { name },
  });

  if (!sco) {
    return NextResponse.json(
      { error: `Subcontracting Order ${name} not found` },
      { status: 404 },
    );
  }

  if (sco.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Subcontracting Orders can be received" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const scoItems = await prisma.subcontractingOrderItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new SCR name ──────────────────────────────────────────
  const scrName = generateShortCode("SCR");

  // ── Create Subcontracting Receipt header + items atomically ─────────
  const result = await prisma.$transaction(async (tx) => {
    const scr = await tx.subcontractingReceipt.create({
      data: {
        name: scrName,
        docstatus: 0,
        naming_series: "SCR-.YYYY.-",
        supplier: sco.supplier,
        supplier_name: sco.supplier_name,
        company: sco.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        supplier_address: sco.supplier_address,
        address_display: sco.address_display,
        contact_person: sco.contact_person,
        contact_display: sco.contact_display,
        contact_mobile: sco.contact_mobile,
        contact_email: sco.contact_email,
        shipping_address: sco.shipping_address,
        shipping_address_display: sco.shipping_address_display,
        set_warehouse: sco.set_warehouse,
        billing_address: sco.billing_address,
        billing_address_display: sco.billing_address_display,
        letter_head: sco.letter_head,
        select_print_heading: sco.select_print_heading,
        cost_center: sco.cost_center,
        project: sco.project,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.SubcontractingReceiptCreateInput,
    });

    // ── Create SCR items from SCO items ─────────────────────────────────
    const scrItemRows = scoItems.map((item, i) => ({
      name: generateShortCode("SCRI"),
      parent: scrName,
      parentfield: "items",
      parenttype: "Subcontracting Receipt",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      qty: Math.max(0, item.qty - (item.received_qty ?? 0)),
      stock_uom: item.stock_uom,
      conversion_factor: item.conversion_factor,
      rate: item.rate,
      amount: item.amount,
      warehouse: item.warehouse,
      expense_account: item.expense_account,
      bom: item.bom,
      subcontracting_order: sco.name,
      subcontracting_order_item: item.name,
      schedule_date: item.schedule_date,
      cost_center: item.cost_center,
      project: item.project,
    }));

    if (scrItemRows.length > 0) {
      await tx.subcontractingReceiptItem.createMany({
        data: scrItemRows as unknown as Prisma.SubcontractingReceiptItemCreateManyInput[],
      });
    }

    return scr;
  });

  // ── Return the new SCR with items ──────────────────────────────────
  const [scrResult, scrItems] = await Promise.all([
    prisma.subcontractingReceipt.findUnique({ where: { name: scrName } }),
    prisma.subcontractingReceiptItem.findMany({
      where: { parent: scrName, parentfield: "items" },
      orderBy: { idx: "asc" },
    }),
  ]);

  const finalResult = { ...scrResult, items: scrItems };

  return NextResponse.json({ data: finalResult }, { status: 201 });
}
