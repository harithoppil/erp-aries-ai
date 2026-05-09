/**
 * Purchase Receipt → Purchase Return conversion (make_purchase_return)
 *
 * Creates a return Purchase Receipt (is_return=true) with negative qty items
 * from a submitted Purchase Receipt.
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

  // ── Fetch source Purchase Receipt ──────────────────────────────────
  const pr = await prisma.purchaseReceipt.findUnique({ where: { name } });

  if (!pr) {
    return NextResponse.json(
      { error: `Purchase Receipt ${name} not found` },
      { status: 404 },
    );
  }

  if (pr.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Purchase Receipts can be returned" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const prItems = await prisma.purchaseReceiptItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const prTaxes = await prisma.purchaseTaxesAndCharges.findMany({
    where: { parent: name, parentfield: "taxes" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new PR name ──────────────────────────────────────────
  const retName = generateShortCode("PRRET");

  // ── Create return Purchase Receipt header + items + taxes atomically ─
  const result = await prisma.$transaction(async (tx) => {
    const ret = await tx.purchaseReceipt.create({
      data: {
        name: retName,
        docstatus: 0,
        naming_series: "PUR-RET-REC-.YYYY.-",
        supplier: pr.supplier,
        supplier_name: pr.supplier_name,
        company: pr.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        is_return: true,
        return_against: pr.name,
        supplier_address: pr.supplier_address,
        contact_person: pr.contact_person,
        address_display: pr.address_display,
        contact_display: pr.contact_display,
        contact_mobile: pr.contact_mobile,
        contact_email: pr.contact_email,
        shipping_address: pr.shipping_address,
        shipping_address_display: pr.shipping_address_display,
        currency: pr.currency,
        conversion_rate: pr.conversion_rate,
        buying_price_list: pr.buying_price_list,
        price_list_currency: pr.price_list_currency,
        plc_conversion_rate: pr.plc_conversion_rate,
        ignore_pricing_rule: pr.ignore_pricing_rule,
        set_warehouse: pr.set_warehouse,
        rejected_warehouse: pr.rejected_warehouse,
        supplier_warehouse: pr.supplier_warehouse,
        tax_category: pr.tax_category,
        shipping_rule: pr.shipping_rule,
        taxes_and_charges: pr.taxes_and_charges,
        other_charges_calculation: pr.other_charges_calculation,
        apply_discount_on: pr.apply_discount_on,
        base_discount_amount: pr.base_discount_amount,
        additional_discount_percentage: pr.additional_discount_percentage,
        discount_amount: pr.discount_amount,
        project: pr.project,
        letter_head: pr.letter_head,
        select_print_heading: pr.select_print_heading,
        language: pr.language,
        billing_address: pr.billing_address,
        billing_address_display: pr.billing_address_display,
        represents_company: pr.represents_company,
        cost_center: pr.cost_center,
        incoterm: pr.incoterm,
        named_place: pr.named_place,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.PurchaseReceiptCreateInput,
    });

    // ── Create return items with NEGATIVE qty ──────────────────────────
    const retItemRows = prItems.map((item, i) => ({
      name: generateShortCode("PRRI"),
      parent: retName,
      parentfield: "items",
      parenttype: "Purchase Receipt",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      received_qty: item.received_qty,
      qty: -1 * (item.qty ?? 0),
      rejected_qty: item.rejected_qty,
      uom: item.uom,
      stock_uom: item.stock_uom,
      conversion_factor: item.conversion_factor,
      retain_sample: item.retain_sample,
      sample_quantity: item.sample_quantity,
      price_list_rate: item.price_list_rate,
      discount_percentage: item.discount_percentage,
      discount_amount: item.discount_amount,
      base_price_list_rate: item.base_price_list_rate,
      rate: item.rate,
      amount: item.amount,
      base_rate: item.base_rate,
      base_amount: item.base_amount,
      net_rate: item.net_rate,
      net_amount: item.net_amount,
      base_net_rate: item.base_net_rate,
      base_net_amount: item.base_net_amount,
      weight_per_unit: item.weight_per_unit,
      total_weight: item.total_weight,
      weight_uom: item.weight_uom,
      warehouse: item.warehouse,
      rejected_warehouse: item.rejected_warehouse,
      quality_inspection: item.quality_inspection,
      purchase_order: item.purchase_order,
      schedule_date: item.schedule_date,
      stock_qty: item.stock_qty,
      item_tax_template: item.item_tax_template,
      project: item.project,
      cost_center: item.cost_center,
      purchase_order_item: item.purchase_order_item,
      brand: item.brand,
      item_group: item.item_group,
      item_tax_rate: item.item_tax_rate,
      expense_account: item.expense_account,
      material_request: item.material_request,
      material_request_item: item.material_request_item,
      pr_detail: item.name,
      page_break: item.page_break,
    }));

    if (retItemRows.length > 0) {
      await tx.purchaseReceiptItem.createMany({ data: retItemRows as unknown as Prisma.PurchaseReceiptItemCreateManyInput[] });
    }

    // ── Copy taxes ──────────────────────────────────────────────────────
    const retTaxRows = prTaxes.map((tax, i) => ({
      name: generateShortCode("PRTX"),
      parent: retName,
      parentfield: "taxes",
      parenttype: "Purchase Receipt",
      idx: i + 1,
      docstatus: 0,
      charge_type: tax.charge_type,
      row_id: tax.row_id,
      account_head: tax.account_head,
      cost_center: tax.cost_center,
      description: tax.description,
      included_in_print_rate: tax.included_in_print_rate,
      rate: tax.rate,
      tax_amount: tax.tax_amount,
      total: tax.total,
      tax_amount_after_discount_amount: tax.tax_amount_after_discount_amount,
      base_tax_amount: tax.base_tax_amount,
      base_total: tax.base_total,
      base_tax_amount_after_discount_amount:
        tax.base_tax_amount_after_discount_amount,
      category: tax.category,
      add_deduct_tax: tax.add_deduct_tax,
      included_in_paid_amount: tax.included_in_paid_amount,
      dont_recompute_tax: tax.dont_recompute_tax,
      account_currency: tax.account_currency,
    }));

    if (retTaxRows.length > 0) {
      await tx.purchaseTaxesAndCharges.createMany({
        data: retTaxRows as unknown as Prisma.PurchaseTaxesAndChargesCreateManyInput[],
      });
    }

    return ret;
  });

  // ── Return the new return PR with items ────────────────────────────
  const [prResult, prRetItems] = await Promise.all([
    prisma.purchaseReceipt.findUnique({ where: { name: retName } }),
    prisma.purchaseReceiptItem.findMany({
      where: { parent: retName, parentfield: "items" },
      orderBy: { idx: "asc" },
    }),
  ]);

  const finalResult = { ...prResult, items: prRetItems };

  return NextResponse.json({ data: finalResult }, { status: 201 });
}
