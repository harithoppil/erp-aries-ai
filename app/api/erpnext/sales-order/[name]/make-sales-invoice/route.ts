/**
 * Sales Order → Sales Invoice conversion (make_sales_invoice)
 *
 * Copies customer, company, items (with amounts), addresses, taxes
 * from a submitted Sales Order into a new Draft Sales Invoice.
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

  // ── Fetch source Sales Order ──────────────────────────────────────
  const so = await prisma.salesOrder.findUnique({ where: { name } });

  if (!so) {
    return NextResponse.json(
      { error: `Sales Order ${name} not found` },
      { status: 404 },
    );
  }

  if (so.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Sales Orders can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const soItems = await prisma.salesOrderItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const soTaxes = await prisma.salesTaxesAndCharges.findMany({
    where: { parent: name, parentfield: "taxes" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new SI name ──────────────────────────────────────────
  const siName = generateShortCode("SI");

  // ── Create Sales Invoice header + items + taxes atomically ─────────
  const result = await prisma.$transaction(async (tx) => {
    const si = await tx.salesInvoice.create({
      data: {
        name: siName,
        docstatus: 0,
        naming_series: "SAL-SINV-.YYYY.-",
        customer: so.customer,
        customer_name: so.customer_name,
        company: so.company,
        cost_center: so.cost_center,
        posting_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86400000), // 30 days
        po_no: so.po_no,
        po_date: so.po_date,
        customer_address: so.customer_address,
        address_display: so.address_display,
        contact_person: so.contact_person,
        contact_display: so.contact_display,
        contact_mobile: so.contact_mobile,
        contact_email: so.contact_email,
        territory: so.territory,
        shipping_address_name: so.shipping_address_name,
        shipping_address: so.shipping_address,
        company_address: so.company_address,
        company_address_display: so.company_address_display,
        currency: so.currency,
        conversion_rate: so.conversion_rate,
        selling_price_list: so.selling_price_list,
        price_list_currency: so.price_list_currency,
        plc_conversion_rate: so.plc_conversion_rate,
        ignore_pricing_rule: so.ignore_pricing_rule,
        set_warehouse: so.set_warehouse,
        tax_id: so.tax_id,
        taxes_and_charges: so.taxes_and_charges,
        other_charges_calculation: so.other_charges_calculation,
        tax_category: so.tax_category,
        apply_discount_on: so.apply_discount_on,
        base_discount_amount: so.base_discount_amount,
        additional_discount_percentage: so.additional_discount_percentage,
        discount_amount: so.discount_amount,
        customer_group: so.customer_group,
        project: so.project,
        letter_head: so.letter_head,
        language: so.language,
        select_print_heading: so.select_print_heading,
        is_internal_customer: so.is_internal_customer,
        represents_company: so.represents_company,
        disable_rounded_total: so.disable_rounded_total,
        dispatch_address_name: so.dispatch_address_name,
        dispatch_address: so.dispatch_address,
        sales_partner: so.sales_partner,
        commission_rate: so.commission_rate,
        total_commission: so.total_commission,
        incoterm: so.incoterm,
        named_place: so.named_place,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.SalesInvoiceCreateInput,
    });

    // ── Create SI items from SO items ─────────────────────────────────
    const siItemRows = soItems.map((item, i) => ({
      name: generateShortCode("SII"),
      parent: siName,
      parentfield: "items",
      parenttype: "Sales Invoice",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      customer_item_code: item.customer_item_code,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      qty: item.qty, // full qty for billing
      stock_uom: item.stock_uom ?? item.uom,
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
      target_warehouse: item.target_warehouse,
      item_group: item.item_group,
      brand: item.brand,
      item_tax_rate: item.item_tax_rate,
      item_tax_template: item.item_tax_template,
      cost_center: item.cost_center,
      sales_order: so.name,
      so_detail: item.name,
      page_break: item.page_break,
    }));

    if (siItemRows.length > 0) {
      await tx.salesInvoiceItem.createMany({ data: siItemRows as unknown as Prisma.SalesInvoiceItemCreateManyInput[] });
    }

    // ── Copy taxes ────────────────────────────────────────────────────
    const siTaxRows = soTaxes.map((tax, i) => ({
      name: generateShortCode("SITX"),
      parent: siName,
      parentfield: "taxes",
      parenttype: "Sales Invoice",
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

    if (siTaxRows.length > 0) {
      await tx.salesTaxesAndCharges.createMany({ data: siTaxRows as unknown as Prisma.SalesTaxesAndChargesCreateManyInput[] });
    }

    return si;
  });

  // ── Return the new SI with items ───────────────────────────────────
  const siResult = await prisma.salesInvoice.findUnique({
    where: { name: siName },
  });

  return NextResponse.json({ data: siResult }, { status: 201 });
}
