/**
 * Sales Invoice → Sales Return conversion (make_sales_return)
 *
 * Creates a return Sales Invoice (is_return=true) with negative qty items
 * from a submitted Sales Invoice.
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

  // ── Fetch source Sales Invoice ──────────────────────────────────────
  const si = await prisma.salesInvoice.findUnique({ where: { name } });

  if (!si) {
    return NextResponse.json(
      { error: `Sales Invoice ${name} not found` },
      { status: 404 },
    );
  }

  if (si.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Sales Invoices can be returned" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const siItems = await prisma.salesInvoiceItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const siTaxes = await prisma.salesTaxesAndCharges.findMany({
    where: { parent: name, parentfield: "taxes" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new SI name ──────────────────────────────────────────
  const retName = generateShortCode("SRET");

  // ── Create return Sales Invoice header + items + taxes atomically ──
  const result = await prisma.$transaction(async (tx) => {
    const ret = await tx.salesInvoice.create({
      data: {
        name: retName,
        docstatus: 0,
        naming_series: "SAL-RET-.YYYY.-",
        customer: si.customer,
        customer_name: si.customer_name,
        company: si.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        is_return: true,
        return_against: si.name,
        po_no: si.po_no,
        po_date: si.po_date,
        customer_address: si.customer_address,
        address_display: si.address_display,
        contact_person: si.contact_person,
        contact_display: si.contact_display,
        contact_mobile: si.contact_mobile,
        contact_email: si.contact_email,
        shipping_address_name: si.shipping_address_name,
        shipping_address: si.shipping_address,
        company_address: si.company_address,
        company_address_display: si.company_address_display,
        currency: si.currency,
        conversion_rate: si.conversion_rate,
        selling_price_list: si.selling_price_list,
        price_list_currency: si.price_list_currency,
        plc_conversion_rate: si.plc_conversion_rate,
        ignore_pricing_rule: si.ignore_pricing_rule,
        set_warehouse: si.set_warehouse,
        tax_id: si.tax_id,
        tax_category: si.tax_category,
        shipping_rule: si.shipping_rule,
        taxes_and_charges: si.taxes_and_charges,
        other_charges_calculation: si.other_charges_calculation,
        apply_discount_on: si.apply_discount_on,
        base_discount_amount: si.base_discount_amount,
        additional_discount_percentage: si.additional_discount_percentage,
        discount_amount: si.discount_amount,
        customer_group: si.customer_group,
        territory: si.territory,
        project: si.project,
        cost_center: si.cost_center,
        letter_head: si.letter_head,
        select_print_heading: si.select_print_heading,
        language: si.language,
        incoterm: si.incoterm,
        named_place: si.named_place,
        sales_partner: si.sales_partner,
        commission_rate: si.commission_rate,
        total_commission: si.total_commission,
        is_internal_customer: si.is_internal_customer,
        represents_company: si.represents_company,
        disable_rounded_total: si.disable_rounded_total,
        dispatch_address_name: si.dispatch_address_name,
        dispatch_address: si.dispatch_address,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as unknown as Prisma.SalesInvoiceCreateInput,
    });

    // ── Create return items with NEGATIVE qty ──────────────────────────
    const retItemRows = siItems.map((item, i) => ({
      name: generateShortCode("SRI"),
      parent: retName,
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
      qty: -1 * (item.qty ?? 0),
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
      si_detail: item.name,
      page_break: item.page_break,
    }));

    if (retItemRows.length > 0) {
      await tx.salesInvoiceItem.createMany({ data: retItemRows as unknown as Prisma.SalesInvoiceItemCreateManyInput[] });
    }

    // ── Copy taxes ──────────────────────────────────────────────────────
    const retTaxRows = siTaxes.map((tax, i) => ({
      name: generateShortCode("SRTX"),
      parent: retName,
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

    if (retTaxRows.length > 0) {
      await tx.salesTaxesAndCharges.createMany({
        data: retTaxRows as unknown as Prisma.SalesTaxesAndChargesCreateManyInput[],
      });
    }

    return ret;
  });

  // ── Return the new return SI with items ────────────────────────────
  const [siResult, siRetItems] = await Promise.all([
    prisma.salesInvoice.findUnique({ where: { name: retName } }),
    prisma.salesInvoiceItem.findMany({
      where: { parent: retName, parentfield: "items" },
      orderBy: { idx: "asc" },
    }),
  ]);

  const finalResult = { ...siResult, items: siRetItems };

  return NextResponse.json({ data: finalResult }, { status: 201 });
}
