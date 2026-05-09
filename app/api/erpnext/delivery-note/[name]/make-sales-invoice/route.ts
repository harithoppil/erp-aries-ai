/**
 * Delivery Note → Sales Invoice conversion (make_sales_invoice)
 *
 * Copies customer, company, items (with amounts), addresses, taxes
 * from a submitted Delivery Note into a new Draft Sales Invoice.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Delivery Note ───────────────────────────────────
  const dn = await prisma.deliveryNote.findUnique({ where: { name } });

  if (!dn) {
    return NextResponse.json(
      { error: `Delivery Note ${name} not found` },
      { status: 404 },
    );
  }

  if (dn.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Delivery Notes can be converted" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const dnItems = await prisma.deliveryNoteItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const dnTaxes = await prisma.salesTaxesAndCharges.findMany({
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
        customer: dn.customer,
        customer_name: dn.customer_name,
        company: dn.company,
        posting_date: new Date(),
        due_date: new Date(Date.now() + 30 * 86400000),
        po_no: dn.po_no,
        po_date: dn.po_date,
        customer_address: dn.customer_address,
        address_display: dn.address_display,
        contact_person: dn.contact_person,
        contact_display: dn.contact_display,
        contact_mobile: dn.contact_mobile,
        contact_email: dn.contact_email,
        territory: dn.territory,
        shipping_address_name: dn.shipping_address_name,
        shipping_address: dn.shipping_address,
        company_address: dn.company_address,
        company_address_display: dn.company_address_display,
        currency: dn.currency,
        conversion_rate: dn.conversion_rate,
        selling_price_list: dn.selling_price_list,
        price_list_currency: dn.price_list_currency,
        plc_conversion_rate: dn.plc_conversion_rate,
        ignore_pricing_rule: dn.ignore_pricing_rule,
        set_warehouse: dn.set_warehouse,
        tax_id: dn.tax_id,
        taxes_and_charges: dn.taxes_and_charges,
        other_charges_calculation: dn.other_charges_calculation,
        tax_category: dn.tax_category,
        apply_discount_on: dn.apply_discount_on,
        base_discount_amount: dn.base_discount_amount,
        additional_discount_percentage: dn.additional_discount_percentage,
        discount_amount: dn.discount_amount,
        customer_group: dn.customer_group,
        project: dn.project,
        letter_head: dn.letter_head,
        language: dn.language,
        select_print_heading: dn.select_print_heading,
        is_internal_customer: dn.is_internal_customer,
        represents_company: dn.represents_company,
        disable_rounded_total: dn.disable_rounded_total,
        dispatch_address_name: dn.dispatch_address_name,
        dispatch_address: dn.dispatch_address,
        sales_partner: dn.sales_partner,
        commission_rate: dn.commission_rate,
        total_commission: dn.total_commission,
        incoterm: dn.incoterm,
        named_place: dn.named_place,
        cost_center: dn.cost_center,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as any,
    });

    // ── Create SI items from DN items ─────────────────────────────────
    const siItemRows = dnItems.map((item, i) => ({
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
      target_warehouse: item.target_warehouse,
      item_group: item.item_group,
      brand: item.brand,
      item_tax_rate: item.item_tax_rate,
      item_tax_template: item.item_tax_template,
      cost_center: item.cost_center,
      expense_account: item.expense_account,
      delivery_note: dn.name,
      dn_detail: item.name,
      sales_order: item.against_sales_order,
      so_detail: item.so_detail,
      page_break: item.page_break,
    }));

    if (siItemRows.length > 0) {
      await tx.salesInvoiceItem.createMany({ data: siItemRows as any });
    }

    // ── Copy taxes ────────────────────────────────────────────────────
    const siTaxRows = dnTaxes.map((tax, i) => ({
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
      await tx.salesTaxesAndCharges.createMany({ data: siTaxRows as any });
    }

    return si;
  });

  // ── Return the new SI ─────────────────────────────────────────────
  const siResult = await prisma.salesInvoice.findUnique({
    where: { name: siName },
  });

  return NextResponse.json({ data: siResult }, { status: 201 });
}
