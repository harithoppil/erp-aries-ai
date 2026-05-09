/**
 * Material Request → Stock Entry (Material Transfer) conversion (make_stock_entry)
 *
 * Filters MR items where material_request_type === "Material Transfer",
 * then creates a Stock Entry with purpose "Material Transfer".
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Material Request ──────────────────────────────────
  const mr = await prisma.materialRequest.findUnique({ where: { name } });

  if (!mr) {
    return NextResponse.json(
      { error: `Material Request ${name} not found` },
      { status: 404 },
    );
  }

  if (mr.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Material Requests can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const mrItems = await prisma.materialRequestItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  // Filter only "Material Transfer" type items
  const transferItems = mrItems.filter(
    (item) => mr.material_request_type === "Material Transfer",
  );

  if (transferItems.length === 0) {
    return NextResponse.json(
      { error: "No Material Transfer items found in this Material Request" },
      { status: 400 },
    );
  }

  // ── Generate new SE name ──────────────────────────────────────────
  const seName = generateShortCode("STE");

  // ── Create Stock Entry header + items atomically ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx) => {
    const se = await tx.stockEntry.create({
      data: {
        name: seName,
        docstatus: 0,
        naming_series: "STE-.YYYY.-",
        purpose: "Material Transfer",
        company: mr.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        from_warehouse: mr.set_from_warehouse,
        to_warehouse: mr.set_warehouse,
        letter_head: mr.letter_head,
        select_print_heading: mr.select_print_heading,
        project: mrItems[0]?.project,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
      } as any,
    });

    // ── Create SE items from MR items ───────────────────────────────────
    const seItemRows = transferItems.map((item, i) => ({
      name: generateShortCode("SED"),
      parent: seName,
      parentfield: "items",
      parenttype: "Stock Entry",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      qty: Math.max(0, item.qty - (item.ordered_qty ?? 0)),
      uom: item.uom,
      stock_uom: item.stock_uom,
      conversion_factor: item.conversion_factor,
      s_warehouse: item.from_warehouse ?? mr.set_from_warehouse,
      t_warehouse: item.warehouse ?? mr.set_warehouse,
      expense_account: item.expense_account,
      cost_center: item.cost_center,
      basic_rate: item.rate,
      basic_amount: item.amount,
      amount: item.amount,
      item_group: item.item_group,
      brand: item.brand,
      bom_no: item.bom_no,
      material_request: mr.name,
      material_request_item: item.name,
      project: item.project,
    }));

    if (seItemRows.length > 0) {
      await tx.stockEntryDetail.createMany({ data: seItemRows as any });
    }

    return se;
  });

  // ── Return the new SE with items ───────────────────────────────────
  const [seResult, seItems] = await Promise.all([
    prisma.stockEntry.findUnique({ where: { name: seName } }),
    prisma.stockEntryDetail.findMany({
      where: { parent: seName, parentfield: "items" },
      orderBy: { idx: "asc" },
    }),
  ]);

  const finalResult = { ...seResult, items: seItems };

  return NextResponse.json({ data: finalResult }, { status: 201 });
}
