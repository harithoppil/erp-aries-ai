/**
 * Production Plan → Work Order conversion (make_work_order)
 *
 * Creates one Work Order per Production Plan item row (po_items).
 * Uses Promise.all for multiple creates within a transaction.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Production Plan ───────────────────────────────────
  const pp = await prisma.productionPlan.findUnique({ where: { name } });

  if (!pp) {
    return NextResponse.json(
      { error: `Production Plan ${name} not found` },
      { status: 404 },
    );
  }

  if (pp.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Production Plans can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch PP item rows (po_items) ──────────────────────────────────
  const ppItems = await prisma.productionPlanItem.findMany({
    where: { parent: name, parentfield: "po_items" },
    orderBy: { idx: "asc" },
  });

  if (ppItems.length === 0) {
    return NextResponse.json(
      { error: "No production plan items found" },
      { status: 400 },
    );
  }

  // ── Create one Work Order per PP item atomically ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = await prisma.$transaction(async (tx) => {
    const woNames = ppItems.map(() => generateShortCode("WO"));

    const workOrders = await Promise.all(
      ppItems.map((item, i) =>
        tx.workOrder.create({
          data: {
            name: woNames[i],
            docstatus: 0,
            naming_series: "WO-.YYYY.-",
            production_item: item.item_code,
            bom_no: item.bom_no,
            qty: item.planned_qty,
            company: pp.company,
            fg_warehouse: item.warehouse,
            planned_start_date: item.planned_start_date,
            status: "Draft",
            production_plan: pp.name,
            production_plan_item: item.name,
            stock_uom: item.stock_uom,
            description: item.description,
            sales_order: item.sales_order,
            sales_order_item: item.sales_order_item,
            material_request: item.material_request,
            material_request_item: item.material_request_item,
            creation: new Date(),
            modified: new Date(),
            owner: "Administrator",
            modified_by: "Administrator",
          } as any,
        }),
      ),
    );

    return workOrders;
  });

  return NextResponse.json({ data: results }, { status: 201 });
}
