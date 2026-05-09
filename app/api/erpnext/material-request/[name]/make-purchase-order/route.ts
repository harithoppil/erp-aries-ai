/**
 * Material Request → Purchase Order conversion (make_purchase_order)
 *
 * Copies items, company, schedule dates from a submitted Material Request
 * (type "Purchase") into a new Draft Purchase Order.
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

  // ── Fetch source Material Request ─────────────────────────────────
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

  if (mr.material_request_type !== "Purchase") {
    return NextResponse.json(
      { error: "Only 'Purchase' type Material Requests can create a Purchase Order" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const mrItems = await prisma.materialRequestItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new PO name ──────────────────────────────────────────
  const poName = generateShortCode("PO");

  // ── Create Purchase Order header + items atomically ────────────────
  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.create({
      data: {
        name: poName,
        docstatus: 0,
        naming_series: "PUR-ORD-.YYYY.-",
        company: mr.company,
        transaction_date: new Date(),
        schedule_date: mr.schedule_date ?? new Date(Date.now() + 7 * 86400000),
        customer: mr.customer,
        set_warehouse: mr.set_warehouse,
        set_from_warehouse: mr.set_from_warehouse,
        letter_head: mr.letter_head,
        select_print_heading: mr.select_print_heading,
        tc_name: mr.tc_name,
        terms: mr.terms,
        buying_price_list: mr.buying_price_list,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.PurchaseOrderCreateInput,
    });

    // ── Create PO items from MR items ─────────────────────────────────
    const poItemRows = mrItems.map((item, i) => ({
      name: generateShortCode("POI"),
      parent: poName,
      parentfield: "items",
      parenttype: "Purchase Order",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      qty: item.qty,
      stock_uom: item.stock_uom,
      uom: item.uom,
      conversion_factor: item.conversion_factor,
      stock_qty: item.stock_qty,
      schedule_date: item.schedule_date,
      rate: item.rate ?? 0,
      amount: item.amount ?? 0,
      price_list_rate: item.price_list_rate,
      warehouse: item.warehouse,
      from_warehouse: item.from_warehouse,
      item_group: item.item_group,
      brand: item.brand,
      project: item.project,
      cost_center: item.cost_center,
      expense_account: item.expense_account,
      material_request: mr.name,
      material_request_item: item.name,
      sales_order: item.sales_order,
      sales_order_item: item.sales_order_item,
      manufacturer: item.manufacturer,
      manufacturer_part_no: item.manufacturer_part_no,
      bom_no: item.bom_no,
      page_break: item.page_break,
    }));

    if (poItemRows.length > 0) {
      await tx.purchaseOrderItem.createMany({ data: poItemRows as unknown as Prisma.PurchaseOrderItemCreateManyInput[] });
    }

    return po;
  });

  // ── Return the new PO ─────────────────────────────────────────────
  const poResult = await prisma.purchaseOrder.findUnique({
    where: { name: poName },
  });

  return NextResponse.json({ data: poResult }, { status: 201 });
}
