/**
 * Purchase Order → Purchase Receipt conversion (make_purchase_receipt)
 *
 * Copies supplier, company, items (qty to receive), addresses, taxes
 * from a submitted Purchase Order into a new Draft Purchase Receipt.
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

  // ── Fetch source Purchase Order ───────────────────────────────────
  const po = await prisma.purchaseOrder.findUnique({ where: { name } });

  if (!po) {
    return NextResponse.json(
      { error: `Purchase Order ${name} not found` },
      { status: 404 },
    );
  }

  if (po.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Purchase Orders can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const poItems = await prisma.purchaseOrderItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const poTaxes = await prisma.purchaseTaxesAndCharges.findMany({
    where: { parent: name, parentfield: "taxes" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new PR name ──────────────────────────────────────────
  const prName = generateShortCode("PR");

  // ── Create Purchase Receipt header + items + taxes atomically ─────
  const txResult = await safeTransaction(async (tx) => {
    const pr = await tx.purchaseReceipt.create({
      data: {
        name: prName,
        docstatus: 0,
        naming_series: "PUR-RCPT-.YYYY.-",
        supplier: po.supplier,
        supplier_name: po.supplier_name,
        company: po.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        supplier_address: po.supplier_address,
        contact_person: po.contact_person,
        address_display: po.address_display,
        contact_display: po.contact_display,
        contact_mobile: po.contact_mobile,
        contact_email: po.contact_email,
        shipping_address: po.shipping_address,
        shipping_address_display: po.shipping_address_display,
        currency: po.currency,
        conversion_rate: po.conversion_rate,
        buying_price_list: po.buying_price_list,
        price_list_currency: po.price_list_currency,
        plc_conversion_rate: po.plc_conversion_rate,
        ignore_pricing_rule: po.ignore_pricing_rule,
        set_warehouse: po.set_warehouse,
        is_subcontracted: po.is_subcontracted,
        supplier_warehouse: po.supplier_warehouse,
        tax_category: po.tax_category,
        shipping_rule: po.shipping_rule,
        taxes_and_charges: po.taxes_and_charges,
        other_charges_calculation: po.other_charges_calculation,
        apply_discount_on: po.apply_discount_on,
        base_discount_amount: po.base_discount_amount,
        additional_discount_percentage: po.additional_discount_percentage,
        discount_amount: po.discount_amount,
        project: po.project,
        tc_name: po.tc_name,
        terms: po.terms,
        letter_head: po.letter_head,
        select_print_heading: po.select_print_heading,
        group_same_items: po.group_same_items,
        language: po.language,
        is_internal_supplier: po.is_internal_supplier,
        represents_company: po.represents_company,
        cost_center: po.cost_center,
        incoterm: po.incoterm,
        named_place: po.named_place,
        billing_address: po.billing_address,
        billing_address_display: po.billing_address_display,
        set_from_warehouse: po.set_from_warehouse,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.PurchaseReceiptCreateInput,
    });

    // ── Create PR items from PO items ─────────────────────────────────
    const prItemRows = poItems.map((item, i) => ({
      name: generateShortCode("PRI"),
      parent: prName,
      parentfield: "items",
      parenttype: "Purchase Receipt",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      received_qty: Math.max(0, item.qty - (item.received_qty ?? 0)), // qty to receive
      qty: Math.max(0, item.qty - (item.received_qty ?? 0)),
      uom: item.uom,
      stock_uom: item.stock_uom,
      conversion_factor: item.conversion_factor,
      stock_qty: item.stock_qty,
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
      item_tax_template: item.item_tax_template,
      project: item.project,
      cost_center: item.cost_center,
      purchase_order: po.name,
      purchase_order_item: item.name,
      schedule_date: item.schedule_date,
      brand: item.brand,
      item_group: item.item_group,
      item_tax_rate: item.item_tax_rate,
      expense_account: item.expense_account,
      manufacturer: item.manufacturer,
      manufacturer_part_no: item.manufacturer_part_no,
      page_break: item.page_break,
      material_request: item.material_request,
      material_request_item: item.material_request_item,
    }));

    if (prItemRows.length > 0) {
      await tx.purchaseReceiptItem.createMany({ data: prItemRows as unknown as Prisma.PurchaseReceiptItemCreateManyInput[] });
    }

    // ── Copy taxes ────────────────────────────────────────────────────
    const prTaxRows = poTaxes.map((tax, i) => ({
      name: generateShortCode("PRTX"),
      parent: prName,
      parentfield: "taxes",
      parenttype: "Purchase Receipt",
      idx: i + 1,
      docstatus: 0,
      category: tax.category,
      add_deduct_tax: tax.add_deduct_tax,
      charge_type: tax.charge_type,
      row_id: tax.row_id,
      included_in_print_rate: tax.included_in_print_rate,
      account_head: tax.account_head,
      cost_center: tax.cost_center,
      description: tax.description,
      rate: tax.rate,
      tax_amount: tax.tax_amount,
      tax_amount_after_discount_amount: tax.tax_amount_after_discount_amount,
      total: tax.total,
      base_tax_amount: tax.base_tax_amount,
      base_total: tax.base_total,
      base_tax_amount_after_discount_amount:
        tax.base_tax_amount_after_discount_amount,
      project: tax.project,
      included_in_paid_amount: tax.included_in_paid_amount,
      account_currency: tax.account_currency,
      net_amount: tax.net_amount,
      base_net_amount: tax.base_net_amount,
    }));

    if (prTaxRows.length > 0) {
      await tx.purchaseTaxesAndCharges.createMany({ data: prTaxRows as unknown as Prisma.PurchaseTaxesAndChargesCreateManyInput[] });
    }

    return pr;
  });
  if (!txResult.success) {
    return NextResponse.json(
      { error: txResult.error ?? "Transaction failed" },
      { status: 500 },
    );
  }


  // ── Return the new PR ─────────────────────────────────────────────
  const prResult = await prisma.purchaseReceipt.findUnique({
    where: { name: prName },
  });

  return NextResponse.json({ data: prResult }, { status: 201 });
}
