/**
 * Purchase Receipt → Purchase Invoice conversion (make_purchase_invoice)
 *
 * Copies supplier, company, items (with amounts), addresses, taxes
 * from a submitted Purchase Receipt into a new Draft Purchase Invoice.
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

  // ── Fetch source Purchase Receipt ─────────────────────────────────
  const pr = await prisma.purchaseReceipt.findUnique({ where: { name } });

  if (!pr) {
    return NextResponse.json(
      { error: `Purchase Receipt ${name} not found` },
      { status: 404 },
    );
  }

  if (pr.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Purchase Receipts can be converted" },
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

  // ── Generate new PI name ──────────────────────────────────────────
  const piName = generateShortCode("PI");

  // ── Create Purchase Invoice header + items + taxes atomically ─────
  const result = await prisma.$transaction(async (tx) => {
    const pi = await tx.purchaseInvoice.create({
      data: {
        name: piName,
        docstatus: 0,
        naming_series: "PUR-INV-.YYYY.-",
        supplier: pr.supplier,
        supplier_name: pr.supplier_name,
        company: pr.company,
        cost_center: pr.cost_center,
        posting_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86400000),
        supplier_address: pr.supplier_address,
        address_display: pr.address_display,
        contact_person: pr.contact_person,
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
        is_subcontracted: pr.is_subcontracted,
        supplier_warehouse: pr.supplier_warehouse,
        tax_category: pr.tax_category,
        shipping_rule: pr.shipping_rule,
        taxes_and_charges: pr.taxes_and_charges,
        other_charges_calculation: pr.other_charges_calculation,
        apply_discount_on: pr.apply_discount_on,
        base_discount_amount: pr.base_discount_amount,
        additional_discount_percentage: pr.additional_discount_percentage,
        discount_amount: pr.discount_amount,
        tc_name: pr.tc_name,
        terms: pr.terms,
        letter_head: pr.letter_head,
        select_print_heading: pr.select_print_heading,
        group_same_items: pr.group_same_items,
        language: pr.language,
        is_internal_supplier: pr.is_internal_supplier,
        represents_company: pr.represents_company,
        project: pr.project,
        set_from_warehouse: pr.set_from_warehouse,
        incoterm: pr.incoterm,
        named_place: pr.named_place,
        billing_address: pr.billing_address,
        billing_address_display: pr.billing_address_display,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.PurchaseInvoiceCreateInput,
    });

    // ── Create PI items from PR items ─────────────────────────────────
    const piItemRows = prItems.map((item, i) => ({
      name: generateShortCode("PII"),
      parent: piName,
      parentfield: "items",
      parenttype: "Purchase Invoice",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      received_qty: item.received_qty,
      qty: item.qty ?? item.received_qty,
      rejected_qty: item.rejected_qty,
      stock_uom: item.stock_uom,
      uom: item.uom,
      conversion_factor: item.conversion_factor,
      stock_qty: item.stock_qty ?? 0,
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
      item_tax_template: item.item_tax_template,
      item_tax_rate: item.item_tax_rate,
      item_group: item.item_group,
      brand: item.brand,
      cost_center: item.cost_center,
      expense_account: item.expense_account,
      project: item.project,
      purchase_order: item.purchase_order,
      po_detail: item.purchase_order_item,
      purchase_receipt: pr.name,
      pr_detail: item.name,
      page_break: item.page_break,
    }));

    if (piItemRows.length > 0) {
      await tx.purchaseInvoiceItem.createMany({ data: piItemRows as unknown as Prisma.PurchaseInvoiceItemCreateManyInput[] });
    }

    // ── Copy taxes ────────────────────────────────────────────────────
    const piTaxRows = prTaxes.map((tax, i) => ({
      name: generateShortCode("PITX"),
      parent: piName,
      parentfield: "taxes",
      parenttype: "Purchase Invoice",
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

    if (piTaxRows.length > 0) {
      await tx.purchaseTaxesAndCharges.createMany({ data: piTaxRows as any });
    }

    return pi;
  });

  // ── Return the new PI ─────────────────────────────────────────────
  const piResult = await prisma.purchaseInvoice.findUnique({
    where: { name: piName },
  });

  return NextResponse.json({ data: piResult }, { status: 201 });
}
