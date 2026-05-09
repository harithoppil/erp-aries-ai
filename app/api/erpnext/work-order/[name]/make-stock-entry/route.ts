/**
 * Work Order → Stock Entry conversion (make_stock_entry)
 *
 * Creates a Stock Entry (Manufacture or Material Transfer) from a
 * submitted Work Order. Purpose is set based on the work order state:
 *   - If no materials transferred yet → "Material Transfer for Manufacture"
 *   - If materials transferred but not manufactured → "Manufacture"
 * Copies BOM items as stock entry details with source/target warehouses.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Work Order ───────────────────────────────────────
  const wo = await prisma.workOrder.findUnique({ where: { name } });

  if (!wo) {
    return NextResponse.json(
      { error: `Work Order ${name} not found` },
      { status: 404 },
    );
  }

  if (wo.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Work Orders can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch Work Order items (required_items) ──────────────────────
  const woItems = await prisma.workOrderItem.findMany({
    where: { parent: name, parentfield: "required_items" },
    orderBy: { idx: "asc" },
  });

  // ── Determine purpose ─────────────────────────────────────────────
  // If skip_transfer is true or material already transferred → Manufacture
  // Otherwise → Material Transfer for Manufacture
  const transferredQty = wo.material_transferred_for_manufacturing ?? 0;
  const producedQty = wo.produced_qty ?? 0;
  const isManufacture =
    wo.skip_transfer ||
    (transferredQty >= wo.qty && producedQty < wo.qty);

  const purpose = isManufacture
    ? "Manufacture"
    : "Material Transfer for Manufacture";

  const stockEntryType = isManufacture
    ? "Manufacture"
    : "Material Transfer for Manufacture";

  // ── Generate new Stock Entry name ────────────────────────────────
  const seName = generateShortCode("SE");

  // ── Create Stock Entry header + items atomically ──────────────────
  const result = await prisma.$transaction(async (tx) => {
    const se = await tx.stockEntry.create({
      data: {
        name: seName,
        docstatus: 0,
        naming_series: "STE-.YYYY.-",
        stock_entry_type: stockEntryType,
        purpose,
        company: wo.company,
        work_order: wo.name,
        from_bom: true,
        bom_no: wo.bom_no,
        fg_completed_qty: wo.qty - producedQty,
        use_multi_level_bom: wo.use_multi_level_bom,
        from_warehouse: wo.source_warehouse ?? wo.wip_warehouse,
        to_warehouse: isManufacture ? wo.fg_warehouse : wo.wip_warehouse,
        project: wo.project,
        remarks: `Stock Entry for Work Order ${wo.name}`,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
      } as any,
    });

    // ── Create Stock Entry Detail items ───────────────────────────────
    if (isManufacture) {
      // Manufacture: raw materials (s_warehouse → —) + finished good (— → t_warehouse)

      // Raw material items (source outgoing)
      const rawItemRows = woItems.map((item, i) => ({
        name: generateShortCode("SED"),
        parent: seName,
        parentfield: "items",
        parenttype: "Stock Entry",
        idx: i + 1,
        docstatus: 0,
        s_warehouse: item.source_warehouse ?? wo.source_warehouse ?? wo.wip_warehouse,
        t_warehouse: null,
        item_code: item.item_code ?? "",
        item_name: item.item_name,
        description: item.description,
        qty: (item.required_qty ?? 0) - (item.transferred_qty ?? 0),
        uom: item.stock_uom ?? "",
        stock_uom: item.stock_uom ?? "",
        conversion_factor: 1,
        basic_rate: item.rate,
        basic_amount: item.amount,
        amount: item.amount,
        is_finished_item: false,
        bom_no: null,
        allow_alternative_item: item.allow_alternative_item,
      }));

      // Finished good item (incoming to FG warehouse)
      const fgRow = {
        name: generateShortCode("SED"),
        parent: seName,
        parentfield: "items",
        parenttype: "Stock Entry",
        idx: woItems.length + 1,
        docstatus: 0,
        s_warehouse: null,
        t_warehouse: wo.fg_warehouse,
        item_code: wo.production_item,
        item_name: wo.item_name,
        qty: wo.qty - producedQty,
        uom: wo.stock_uom ?? "",
        stock_uom: wo.stock_uom ?? "",
        conversion_factor: 1,
        is_finished_item: true,
        bom_no: wo.bom_no,
      };

      await tx.stockEntryDetail.createMany({
        data: [...rawItemRows, fgRow] as any,
      });
    } else {
      // Material Transfer for Manufacture: all items from source → WIP
      const transferItemRows = woItems.map((item, i) => ({
        name: generateShortCode("SED"),
        parent: seName,
        parentfield: "items",
        parenttype: "Stock Entry",
        idx: i + 1,
        docstatus: 0,
        s_warehouse: item.source_warehouse ?? wo.source_warehouse,
        t_warehouse: wo.wip_warehouse,
        item_code: item.item_code ?? "",
        item_name: item.item_name,
        description: item.description,
        qty: (item.required_qty ?? 0) - (item.transferred_qty ?? 0),
        uom: item.stock_uom ?? "",
        stock_uom: item.stock_uom ?? "",
        conversion_factor: 1,
        basic_rate: item.rate,
        basic_amount: item.amount,
        amount: item.amount,
        is_finished_item: false,
        allow_alternative_item: item.allow_alternative_item,
      }));

      if (transferItemRows.length > 0) {
        await tx.stockEntryDetail.createMany({ data: transferItemRows as any });
      }
    }

    return se;
  });

  // ── Return the new Stock Entry ────────────────────────────────────
  const seResult = await prisma.stockEntry.findUnique({
    where: { name: seName },
  });

  return NextResponse.json({ data: seResult }, { status: 201 });
}
