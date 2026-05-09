/**
 * Purchase Order → Purchase Invoice conversion (make_purchase_invoice)
 *
 * Copies supplier, company, items (with amounts), addresses, taxes
 * from a submitted Purchase Order into a new Draft Purchase Invoice.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

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

  // ── Generate new PI name ──────────────────────────────────────────
  const piName = generateShortCode("PI");

  // ── Create Purchase Invoice header + items + taxes atomically ─────
  const result = await prisma.$transaction(async (tx) => {
    const pi = await tx.purchaseInvoice.create({
      data: {
        name: piName,
        docstatus: 0,
        naming_series: "PUR-INV-.YYYY.-",
        supplier: po.supplier,
        supplier_name: po.supplier_name,
        company: po.company,
        cost_center: po.cost_center,
        posting_date: new Date(),
        due_date: po.schedule_date ?? new Date(Date.now() + 30 * 86400000),
        supplier_address: po.supplier_address,
        address_display: po.address_display,
        contact_person: po.contact_person,
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
        tax_category: po.tax_category,
        shipping_rule: po.shipping_rule,
        taxes_and_charges: po.taxes_and_charges,
        other_charges_calculation: po.other_charges_calculation,
        apply_discount_on: po.apply_discount_on,
        base_discount_amount: po.base_discount_amount,
        additional_discount_percentage: po.additional_discount_percentage,
        discount_amount: po.discount_amount,
        tc_name: po.tc_name,
        terms: po.terms,
        letter_head: po.letter_head,
        select_print_heading: po.select_print_heading,
        group_same_items: po.group_same_items,
        language: po.language,
        is_internal_supplier: po.is_internal_supplier,
        represents_company: po.represents_company,
        project: po.project,
        set_from_warehouse: po.set_from_warehouse,
        supplier_warehouse: po.supplier_warehouse,
        incoterm: po.incoterm,
        named_place: po.named_place,
        billing_address: po.billing_address,
        billing_address_display: po.billing_address_display,
        supplier_group: po.supplier_group,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as any,
    });

    // ── Create PI items from PO items ─────────────────────────────────
    const piItemRows = poItems.map((item, i) => ({
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
      qty: item.qty,
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
      item_tax_template: item.item_tax_template,
      item_tax_rate: item.item_tax_rate,
      item_group: item.item_group,
      brand: item.brand,
      cost_center: item.cost_center,
      expense_account: item.expense_account,
      project: item.project,
      purchase_order: po.name,
      po_detail: item.name,
      page_break: item.page_break,
    }));

    if (piItemRows.length > 0) {
      await tx.purchaseInvoiceItem.createMany({ data: piItemRows as any });
    }

    // ── Copy taxes ────────────────────────────────────────────────────
    const piTaxRows = poTaxes.map((tax, i) => ({
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
