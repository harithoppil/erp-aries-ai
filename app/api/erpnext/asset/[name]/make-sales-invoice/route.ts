/**
 * Asset → Sales Invoice conversion (make_sales_invoice)
 *
 * Creates a Sales Invoice with a single item to sell an Asset.
 * Validates that the Asset exists and is not already sold.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";
import type { Prisma } from "@/prisma/client";
import { safeTransaction } from "@/lib/erpnext/transaction-wrapper";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Asset ─────────────────────────────────────────────
  const asset = await prisma.asset.findUnique({ where: { name } });

  if (!asset) {
    return NextResponse.json(
      { error: `Asset ${name} not found` },
      { status: 404 },
    );
  }

  if (asset.status === "Sold") {
    return NextResponse.json(
      { error: "Asset is already sold" },
      { status: 400 },
    );
  }

  // ── Generate new SI name ───────────────────────────────────────────
  const siName = generateShortCode("SINV");

  // ── Create Sales Invoice header + single item atomically ───────────
  const txResult = await safeTransaction(async (tx) => {
    const si = await tx.salesInvoice.create({
      data: {
        name: siName,
        docstatus: 0,
        naming_series: "SAL-INV-.YYYY.-",
        customer: asset.customer ?? "",
        company: asset.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        cost_center: asset.cost_center,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.SalesInvoiceCreateInput,
    });

    // ── Create single item row for the asset ────────────────────────────
    const siItemName = generateShortCode("SII");
    await tx.salesInvoiceItem.create({
      data: {
        name: siItemName,
        parent: siName,
        parentfield: "items",
        parenttype: "Sales Invoice",
        idx: 1,
        docstatus: 0,
        item_code: asset.item_code,
        item_name: asset.item_name ?? "",
        qty: 1,
        rate: asset.purchase_amount,
        amount: asset.purchase_amount,
        is_fixed_asset: true,
        asset: asset.name,
        warehouse: asset.location,
        income_account: "",
        cost_center: asset.cost_center ?? "",
      } as unknown as Prisma.SalesInvoiceItemCreateInput,
    });

    return si;
  });
  if (!txResult.success) {
    return NextResponse.json(
      { error: txResult.error ?? "Transaction failed" },
      { status: 500 },
    );
  }


  // ── Return the new SI with items ───────────────────────────────────
  const [siResult, siItems] = await Promise.all([
    prisma.salesInvoice.findUnique({ where: { name: siName } }),
    prisma.salesInvoiceItem.findMany({
      where: { parent: siName, parentfield: "items" },
      orderBy: { idx: "asc" },
    }),
  ]);

  const finalResult = { ...siResult, items: siItems };

  return NextResponse.json({ data: finalResult }, { status: 201 });
}
