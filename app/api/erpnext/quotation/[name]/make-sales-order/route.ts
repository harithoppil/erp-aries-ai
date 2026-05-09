/**
 * Quotation → Sales Order conversion (make_sales_order)
 *
 * Copies party (customer), company, items (with rates), addresses, taxes
 * from a submitted Quotation into a new Draft Sales Order.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Quotation ────────────────────────────────────────
  const qtn = await prisma.quotation.findUnique({ where: { name } });

  if (!qtn) {
    return NextResponse.json(
      { error: `Quotation ${name} not found` },
      { status: 404 },
    );
  }

  if (qtn.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Quotations can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const qtnItems = await prisma.quotationItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const qtnTaxes = await prisma.salesTaxesAndCharges.findMany({
    where: { parent: name, parentfield: "taxes" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new SO name ──────────────────────────────────────────
  const soName = generateShortCode("SO");

  // Determine the customer: if quotation_to is "Customer", party_name is customer
  const customer =
    qtn.quotation_to === "Customer" ? qtn.party_name ?? "" : "";

  // ── Create Sales Order header + items + taxes atomically ─────────
  const result = await prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.create({
      data: {
        name: soName,
        docstatus: 0,
        naming_series: "SAL-ORD-.YYYY.-",
        customer: customer,
        customer_name: qtn.customer_name,
        order_type: qtn.order_type,
        company: qtn.company,
        transaction_date: new Date(),
        delivery_date: qtn.valid_till,
        customer_address: qtn.customer_address,
        address_display: qtn.address_display,
        contact_person: qtn.contact_person,
        contact_display: qtn.contact_display,
        contact_mobile: qtn.contact_mobile,
        contact_email: qtn.contact_email,
        shipping_address_name: qtn.shipping_address_name,
        shipping_address: qtn.shipping_address,
        customer_group: qtn.customer_group,
        territory: qtn.territory,
        currency: qtn.currency,
        conversion_rate: qtn.conversion_rate,
        selling_price_list: qtn.selling_price_list,
        price_list_currency: qtn.price_list_currency,
        plc_conversion_rate: qtn.plc_conversion_rate,
        ignore_pricing_rule: qtn.ignore_pricing_rule,
        tax_category: qtn.tax_category,
        shipping_rule: qtn.shipping_rule,
        taxes_and_charges: qtn.taxes_and_charges,
        other_charges_calculation: qtn.other_charges_calculation,
        apply_discount_on: qtn.apply_discount_on,
        base_discount_amount: qtn.base_discount_amount,
        additional_discount_percentage: qtn.additional_discount_percentage,
        discount_amount: qtn.discount_amount,
        coupon_code: qtn.coupon_code,
        payment_terms_template: qtn.payment_terms_template,
        tc_name: qtn.tc_name,
        terms: qtn.terms,
        letter_head: qtn.letter_head,
        group_same_items: qtn.group_same_items,
        select_print_heading: qtn.select_print_heading,
        language: qtn.language,
        company_address: qtn.company_address,
        company_address_display: qtn.company_address_display,
        incoterm: qtn.incoterm,
        named_place: qtn.named_place,
        disable_rounded_total: qtn.disable_rounded_total,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as any,
    });

    // ── Create SO items from Quotation items ───────────────────────────
    const soItemRows = qtnItems.map((item, i) => ({
      name: generateShortCode("SOI"),
      parent: soName,
      parentfield: "items",
      parenttype: "Sales Order",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code ?? "",
      item_name: item.item_name,
      customer_item_code: item.customer_item_code,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      qty: item.qty,
      stock_uom: item.stock_uom,
      uom: item.uom,
      conversion_factor: item.conversion_factor,
      stock_qty: item.stock_qty,
      price_list_rate: item.price_list_rate,
      base_price_list_rate: item.base_price_list_rate,
      margin_type: item.margin_type,
      margin_rate_or_amount: item.margin_rate_or_amount,
      rate_with_margin: item.rate_with_margin,
      discount_percentage: item.discount_percentage,
      discount_amount: item.discount_amount,
      base_rate_with_margin: item.base_rate_with_margin,
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
      item_group: item.item_group,
      brand: item.brand,
      item_tax_rate: item.item_tax_rate,
      item_tax_template: item.item_tax_template,
      page_break: item.page_break,
      prevdoc_docname: qtn.name, // reference to source quotation
      valuation_rate: item.valuation_rate,
      gross_profit: item.gross_profit,
      stock_uom_rate: item.stock_uom_rate,
    }));

    if (soItemRows.length > 0) {
      await tx.salesOrderItem.createMany({ data: soItemRows as any });
    }

    // ── Copy taxes ────────────────────────────────────────────────────
    const soTaxRows = qtnTaxes.map((tax, i) => ({
      name: generateShortCode("SOTX"),
      parent: soName,
      parentfield: "taxes",
      parenttype: "Sales Order",
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
      project: tax.project,
      included_in_paid_amount: tax.included_in_paid_amount,
      dont_recompute_tax: tax.dont_recompute_tax,
      account_currency: tax.account_currency,
      net_amount: tax.net_amount,
      base_net_amount: tax.base_net_amount,
    }));

    if (soTaxRows.length > 0) {
      await tx.salesTaxesAndCharges.createMany({ data: soTaxRows as any });
    }

    return so;
  });

  // ── Return the new SO ─────────────────────────────────────────────
  const soResult = await prisma.salesOrder.findUnique({
    where: { name: soName },
  });

  return NextResponse.json({ data: soResult }, { status: 201 });
}
