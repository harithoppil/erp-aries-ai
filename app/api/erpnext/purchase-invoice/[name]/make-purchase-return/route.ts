/**
 * Purchase Invoice → Purchase Return conversion (make_purchase_return)
 *
 * Creates a return Purchase Invoice (is_return=true) with negative qty items
 * from a submitted Purchase Invoice.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateShortCode } from "@/lib/uuid";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  // ── Fetch source Purchase Invoice ──────────────────────────────────
  const pi = await prisma.purchaseInvoice.findUnique({ where: { name } });

  if (!pi) {
    return NextResponse.json(
      { error: `Purchase Invoice ${name} not found` },
      { status: 404 },
    );
  }

  if (pi.docstatus !== 1) {
    return NextResponse.json(
      { error: "Only submitted Purchase Invoices can be returned" },
      { status: 400 },
    );
  }

  // ── Fetch child rows ──────────────────────────────────────────────
  const piItems = await prisma.purchaseInvoiceItem.findMany({
    where: { parent: name, parentfield: "items" },
    orderBy: { idx: "asc" },
  });

  const piTaxes = await prisma.purchaseTaxesAndCharges.findMany({
    where: { parent: name, parentfield: "taxes" },
    orderBy: { idx: "asc" },
  });

  // ── Generate new PI name ──────────────────────────────────────────
  const retName = generateShortCode("PRET");

  // ── Create return Purchase Invoice header + items + taxes atomically ─
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await prisma.$transaction(async (tx) => {
    const ret = await tx.purchaseInvoice.create({
      data: {
        name: retName,
        docstatus: 0,
        naming_series: "PUR-RET-.YYYY.-",
        supplier: pi.supplier,
        supplier_name: pi.supplier_name,
        company: pi.company,
        posting_date: new Date(),
        posting_time: new Date().toTimeString().slice(0, 8),
        is_return: true,
        return_against: pi.name,
        bill_no: pi.bill_no,
        bill_date: pi.bill_date,
        supplier_address: pi.supplier_address,
        address_display: pi.address_display,
        contact_person: pi.contact_person,
        contact_display: pi.contact_display,
        contact_mobile: pi.contact_mobile,
        contact_email: pi.contact_email,
        shipping_address: pi.shipping_address,
        shipping_address_display: pi.shipping_address_display,
        currency: pi.currency,
        conversion_rate: pi.conversion_rate,
        buying_price_list: pi.buying_price_list,
        price_list_currency: pi.price_list_currency,
        plc_conversion_rate: pi.plc_conversion_rate,
        ignore_pricing_rule: pi.ignore_pricing_rule,
        set_warehouse: pi.set_warehouse,
        rejected_warehouse: pi.rejected_warehouse,
        tax_category: pi.tax_category,
        shipping_rule: pi.shipping_rule,
        taxes_and_charges: pi.taxes_and_charges,
        other_charges_calculation: pi.other_charges_calculation,
        apply_discount_on: pi.apply_discount_on,
        base_discount_amount: pi.base_discount_amount,
        additional_discount_percentage: pi.additional_discount_percentage,
        discount_amount: pi.discount_amount,
        project: pi.project,
        cost_center: pi.cost_center,
        letter_head: pi.letter_head,
        select_print_heading: pi.select_print_heading,
        language: pi.language,
        billing_address: pi.billing_address,
        billing_address_display: pi.billing_address_display,
        represents_company: pi.represents_company,
        incoterm: pi.incoterm,
        named_place: pi.named_place,
        creation: new Date(),
        modified: new Date(),
        owner: "Administrator",
        modified_by: "Administrator",
        status: "Draft",
      } as any,
    });

    // ── Create return items with NEGATIVE qty ──────────────────────────
    const retItemRows = piItems.map((item, i) => ({
      name: generateShortCode("PRI"),
      parent: retName,
      parentfield: "items",
      parenttype: "Purchase Invoice",
      idx: i + 1,
      docstatus: 0,
      item_code: item.item_code,
      item_name: item.item_name,
      description: item.description,
      image: item.image,
      image_view: item.image_view,
      qty: -1 * item.qty,
      stock_uom: item.stock_uom,
      uom: item.uom,
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
      rejected_warehouse: item.rejected_warehouse,
      quality_inspection: item.quality_inspection,
      batch_no: item.batch_no,
      expense_account: item.expense_account,
      item_tax_template: item.item_tax_template,
      project: item.project,
      cost_center: item.cost_center,
      brand: item.brand,
      item_group: item.item_group,
      item_tax_rate: item.item_tax_rate,
      pi_detail: item.name,
      page_break: item.page_break,
    }));

    if (retItemRows.length > 0) {
      await tx.purchaseInvoiceItem.createMany({ data: retItemRows as any });
    }

    // ── Copy taxes ──────────────────────────────────────────────────────
    const retTaxRows = piTaxes.map((tax, i) => ({
      name: generateShortCode("PRTX"),
      parent: retName,
      parentfield: "taxes",
      parenttype: "Purchase Invoice",
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
        data: retTaxRows as any,
      });
    }

    return ret;
  });

  // ── Return the new return PI with items ────────────────────────────
  const [piResult, piRetItems] = await Promise.all([
    prisma.purchaseInvoice.findUnique({ where: { name: retName } }),
    prisma.purchaseInvoiceItem.findMany({
      where: { parent: retName, parentfield: "items" },
      orderBy: { idx: "asc" },
    }),
  ]);

  const finalResult = { ...piResult, items: piRetItems };

  return NextResponse.json({ data: finalResult }, { status: 201 });
}
