'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeQuotation = {
  id: string;
  quotation_number: string;
  customer_name: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  valid_till: Date | null;
  valid_until?: Date | null;
  created_at: Date | null;
  project_type?: string | null;
  notes?: string | null;
};

export interface QuotationItemInput {
  item_code?: string;
  description?: string;
  qty?: number;
  quantity?: number;
  rate: number;
}

export interface QuotationValidateInput {
  party_name: string;
  valid_till?: string;
  transaction_date?: string;
  items: QuotationItemInput[];
}

export interface FrappeSalesOrder {
  name: string;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listQuotations(): Promise<
  { success: true; quotations: ClientSafeQuotation[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Quotation", "read");
    const rows = await prisma.quotation.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      quotations: rows.map((q) => ({
        id: q.name,
        quotation_number: q.name,
        customer_name: q.customer_name || q.party_name || 'Unknown',
        status: q.docstatus === 1 ? 'Submitted' : q.docstatus === 2 ? 'Cancelled' : (q.status || 'Draft'),
        subtotal: Number(q.net_total || 0),
        tax_amount: Number(q.total_taxes_and_charges || 0),
        total: Number(q.grand_total || 0),
        currency: q.currency || 'AED',
        valid_till: q.valid_till || null,
        valid_until: q.valid_till || null,
        created_at: q.creation,
        project_type: null,
        notes: q.terms || null,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching quotations:', msg);
    return { success: false, error: msg || 'Failed to fetch quotations' };
  }
}

export async function createQuotation(data: {
  customer_id?: string;
  customer_name?: string;
  project_type?: string;
  tax_rate?: number;
  valid_until?: Date;
  notes?: string;
  items: QuotationItemInput[];
}) {
  try {
    await requirePermission("Quotation", "create");
    const customer = data.customer_name || data.customer_id || '';
    const subtotal = data.items.reduce((s, i) => s + (i.qty ?? i.quantity ?? 1) * i.rate, 0);
    const tax_amount = subtotal * (data.tax_rate || 0) / 100;
    const total = subtotal + tax_amount;

    const name = `QTN-${Date.now()}`;
    const record = await prisma.quotation.create({
      data: {
        name,
        party_name: customer,
        customer_name: customer,
        company: 'Aries',
        transaction_date: new Date(),
        valid_till: data.valid_until || null,
        currency: 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        net_total: subtotal,
        total: subtotal,
        total_taxes_and_charges: tax_amount,
        grand_total: total,
        base_net_total: subtotal,
        base_total: subtotal,
        base_total_taxes_and_charges: tax_amount,
        base_grand_total: total,
        total_qty: data.items.reduce((s, i) => s + (i.qty ?? i.quantity ?? 1), 0),
        total_net_weight: 0,
        base_discount_amount: 0,
        additional_discount_percentage: 0,
        discount_amount: 0,
        base_rounding_adjustment: 0,
        base_rounded_total: total,
        rounding_adjustment: 0,
        rounded_total: total,
        terms: data.notes || null,
        status: 'Draft',
        naming_series: 'QTN-',
        order_type: 'Sales',
        quotation_to: 'Customer',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    // Create child Quotation Items
    for (const item of data.items) {
      const qty = item.qty ?? item.quantity ?? 1;
      await prisma.quotationItem.create({
        data: {
          name: `QI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          parent: name,
          parentfield: 'items',
          parenttype: 'Quotation',
          item_code: item.item_code || 'Services',
          item_name: item.description || item.item_code || 'Services',
          qty,
          uom: 'Nos',
          conversion_factor: 1,
          stock_uom: 'Nos',
          stock_qty: qty,
          price_list_rate: item.rate,
          base_price_list_rate: item.rate,
          margin_rate_or_amount: 0,
          rate_with_margin: item.rate,
          discount_percentage: 0,
          discount_amount: 0,
          base_rate_with_margin: item.rate,
          weight_per_unit: 0,
          total_weight: 0,
          projected_qty: 0,
          actual_qty: 0,
          blanket_order_rate: 0,
          valuation_rate: item.rate,
          gross_profit: 0,
          stock_uom_rate: item.rate,
          distributed_discount_amount: 0,
          company_total_stock: 0,
          rate: item.rate,
          amount: qty * item.rate,
          net_rate: item.rate,
          net_amount: qty * item.rate,
          base_rate: item.rate,
          base_amount: qty * item.rate,
          base_net_rate: item.rate,
          base_net_amount: qty * item.rate,
          creation: new Date(),
          modified: new Date(),
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    }

    revalidatePath('/erp/quotations');
    return {
      success: true as const,
      quotation: {
        id: record.name,
        quotation_number: record.name,
        customer_name: customer,
        status: 'Draft',
        subtotal,
        tax_amount,
        total,
        currency: 'AED',
        valid_till: data.valid_until || null,
        valid_until: data.valid_until || null,
        created_at: record.creation,
        project_type: data.project_type || null,
        notes: data.notes || null,
      } as ClientSafeQuotation,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create quotation' };
  }
}

// ── Submit / Cancel ─────────────────────────────────────────────────────────

export async function submitQuotation(id: string): Promise<SubmitResult> {
  await requirePermission("Quotation", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Quotation", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/quotations');
  return result;
}

export async function cancelQuotation(id: string): Promise<CancelResult> {
  await requirePermission("Quotation", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Quotation", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/quotations');
  return result;
}

// ── Validation & Business Logic ─────────────────────────────────────────────

export async function validateQuotation(
  data: QuotationValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    await requirePermission("Quotation", "read");
    if (!data.party_name || data.party_name.trim().length === 0) {
      return { success: false, error: 'Party Name is required' };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'At least one item is required' };
    }
    for (const item of data.items) {
      const qty = item.qty ?? item.quantity ?? 0;
      if (qty <= 0) {
        return { success: false, error: `Item "${item.item_code || item.description || ''}" must have quantity > 0` };
      }
      if (typeof item.rate !== 'number' || item.rate < 0) {
        return { success: false, error: `Item "${item.item_code || item.description || ''}" must have a valid rate` };
      }
    }

    if (data.valid_till && data.transaction_date) {
      const validTill = new Date(data.valid_till);
      const transactionDate = new Date(data.transaction_date);
      if (validTill < transactionDate) {
        return { success: false, error: 'Valid till date cannot be before transaction date' };
      }
    }

    if (data.valid_till) {
      const validTill = new Date(data.valid_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validTill < today) {
        return { success: false, error: 'Validity period of this quotation has ended' };
      }
    }

    return { success: true, valid: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[quotations] validateQuotation failed:', msg);
    return { success: false, error: msg || 'Quotation validation failed' };
  }
}

export async function makeSalesOrder(
  quotationId: string
): Promise<{ success: true; salesOrder: FrappeSalesOrder } | { success: false; error: string }> {
  try {
    await requirePermission("Quotation", "create");
    const qtn = await prisma.quotation.findUnique({
      where: { name: quotationId },
    });
    if (!qtn) {
      return { success: false, error: 'Quotation not found' };
    }
    if (qtn.docstatus !== 1) {
      return { success: false, error: 'Quotation must be submitted before creating a Sales Order' };
    }

    if (qtn.valid_till) {
      const validTill = new Date(qtn.valid_till);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (validTill < today) {
        return { success: false, error: 'Validity period of this quotation has ended' };
      }
    }

    // Fetch quotation items from child table
    const qtnItems = await prisma.quotationItem.findMany({
      where: { parent: quotationId, parenttype: 'Quotation' },
    });

    const soName = `SO-${Date.now()}`;
    const subtotal = qtnItems.reduce((s, i) => s + Number(i.amount || 0), 0);
    const taxAmount = Number(qtn.total_taxes_and_charges || 0);
    const total = subtotal + taxAmount;

    const so = await prisma.salesOrder.create({
      data: {
        name: soName,
        customer: qtn.party_name || qtn.customer_name || '',
        customer_name: qtn.customer_name || qtn.party_name || '',
        company: 'Aries',
        transaction_date: new Date(),
        currency: qtn.currency || 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        net_total: subtotal,
        total: subtotal,
        base_total: subtotal,
        base_net_total: subtotal,
        grand_total: total,
        base_grand_total: total,
        total_qty: qtnItems.reduce((s, i) => s + Number(i.qty || 0), 0),
        total_net_weight: 0,
        base_total_taxes_and_charges: taxAmount,
        total_taxes_and_charges: taxAmount,
        loyalty_points: 0,
        loyalty_amount: 0,
        base_discount_amount: 0,
        additional_discount_percentage: 0,
        discount_amount: 0,
        base_rounding_adjustment: 0,
        base_rounded_total: total,
        rounding_adjustment: 0,
        rounded_total: total,
        advance_paid: 0,
        per_delivered: 0,
        per_billed: 0,
        commission_rate: 0,
        total_commission: 0,
        amount_eligible_for_commission: 0,
        per_picked: 0,
        status: 'Draft',
        naming_series: 'SO-',
        order_type: 'Sales',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    // Create SO items from quotation items
    for (const item of qtnItems) {
      const itemQty = Number(item.qty || 1);
      const itemRate = Number(item.rate || 0);
      const itemAmount = Number(item.amount || 0);
      await prisma.salesOrderItem.create({
        data: {
          name: `SOI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          parent: soName,
          parentfield: 'items',
          parenttype: 'Sales Order',
          item_code: item.item_code || 'Services',
          item_name: item.item_name || 'Services',
          qty: itemQty,
          uom: item.uom || 'Nos',
          conversion_factor: Number(item.conversion_factor || 1),
          stock_uom: item.stock_uom || 'Nos',
          stock_qty: itemQty,
          price_list_rate: itemRate,
          base_price_list_rate: itemRate,
          margin_rate_or_amount: 0,
          rate_with_margin: itemRate,
          discount_percentage: 0,
          discount_amount: 0,
          base_rate_with_margin: itemRate,
          rate: itemRate,
          amount: itemAmount,
          base_rate: Number(item.base_rate || itemRate),
          base_amount: Number(item.base_amount || itemAmount),
          net_rate: itemRate,
          net_amount: itemAmount,
          base_net_rate: itemRate,
          base_net_amount: itemAmount,
          weight_per_unit: 0,
          total_weight: 0,
          billed_amt: 0,
          valuation_rate: itemRate,
          gross_profit: 0,
          blanket_order_rate: 0,
          projected_qty: 0,
          actual_qty: 0,
          ordered_qty: 0,
          delivered_qty: 0,
          work_order_qty: 0,
          returned_qty: 0,
          planned_qty: 0,
          produced_qty: 0,
          stock_uom_rate: itemRate,
          picked_qty: 0,
          production_plan_qty: 0,
          distributed_discount_amount: 0,
          company_total_stock: 0,
          fg_item_qty: 0,
          requested_qty: 0,
          creation: new Date(),
          modified: new Date(),
          owner: 'Administrator',
          modified_by: 'Administrator',
        },
      });
    }

    revalidatePath('/erp/sales-orders');
    revalidatePath('/erp/quotations');
    return { success: true, salesOrder: { name: so.name } };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[quotations] makeSalesOrder failed:', msg);
    return { success: false, error: msg || 'Failed to create Sales Order from Quotation' };
  }
}

export async function getQuotationMargin(
  quotationId: string
): Promise<
  | { success: true; total: number; cost: number; margin: number; marginPercent: number }
  | { success: false; error: string }
> {
  try {
    await requirePermission("Quotation", "read");
    const qtn = await prisma.quotation.findUnique({
      where: { name: quotationId },
    });
    if (!qtn) {
      return { success: false, error: 'Quotation not found' };
    }

    const total = Number(qtn.grand_total || 0);
    const qtnItems = await prisma.quotationItem.findMany({
      where: { parent: quotationId, parenttype: 'Quotation' },
    });

    if (qtnItems.length === 0) {
      return { success: true, total, cost: 0, margin: 0, marginPercent: 0 };
    }

    const itemCodes = Array.from(new Set(
      qtnItems.map((i) => i.item_code).filter((code): code is string => typeof code === 'string' && code.length > 0)
    ));
    const itemDocs = await prisma.item.findMany({
      where: { item_code: { in: itemCodes } },
      select: { item_code: true, standard_rate: true },
    });

    const costMap: Record<string, number> = {};
    for (const it of itemDocs) {
      costMap[it.item_code] = Number(it.standard_rate || 0);
    }

    let cost = 0;
    for (const item of qtnItems) {
      const unitCost = costMap[item.item_code || ''] || 0;
      cost += unitCost * (item.qty || 1);
    }

    const margin = total - cost;
    const marginPercent = total > 0 ? Math.round((margin / total) * 10000) / 100 : 0;

    return {
      success: true,
      total: Math.round(total * 100) / 100,
      cost: Math.round(cost * 100) / 100,
      margin: Math.round(margin * 100) / 100,
      marginPercent: Math.round(marginPercent * 100) / 100,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[quotations] getQuotationMargin failed:', msg);
    return { success: false, error: msg || 'Failed to calculate quotation margin' };
  }
}
