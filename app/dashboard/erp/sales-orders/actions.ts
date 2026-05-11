'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeSalesOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  project_type: string | null;
  delivery_date: Date | null;
  status: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  notes: string | null;
  created_at: Date | null;
};

export interface SalesOrderItemInput {
  description: string;
  quantity: number;
  rate: number;
  item_code?: string;
}

export interface SalesOrderValidateInput {
  customer: string;
  delivery_date?: string;
  items: SalesOrderItemInput[];
  grand_total?: number;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listSalesOrders(params?: {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; orders: ClientSafeSalesOrder[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Sales Order", "read");
    const where: Record<string, unknown> = {};
    if (params?.status) {
      if (params.status === 'DRAFT') {
        where.docstatus = 0;
      } else if (params.status === 'SUBMITTED') {
        where.docstatus = 1;
      } else if (params.status === 'CANCELLED') {
        where.docstatus = 2;
      } else {
        where.status = params.status;
      }
    }
    if (params?.from_date || params?.to_date) {
      where.transaction_date = {
        ...(params.from_date ? { gte: new Date(params.from_date) } : {}),
        ...(params.to_date ? { lte: new Date(params.to_date) } : {}),
      };
    }
    if (params?.search) {
      where.OR = [
        { customer_name: { contains: params.search, mode: 'insensitive' as const } },
        { name: { contains: params.search, mode: 'insensitive' as const } },
      ];
    }

    const orders = await prisma.salesOrder.findMany({
      where,
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.name,
        order_number: o.name,
        customer_name: o.customer_name || 'Unknown',
        project_type: null,
        delivery_date: o.delivery_date || null,
        status: o.docstatus === 1 ? 'Submitted' : o.docstatus === 2 ? 'Cancelled' : (o.status || 'Draft'),
        subtotal: Number(o.net_total || 0),
        tax_rate: 0,
        tax_amount: Number(o.total_taxes_and_charges || 0),
        total: Number(o.grand_total || 0),
        currency: o.currency || 'AED',
        notes: o.terms || null,
        created_at: o.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching sales orders:', msg);
    return { success: false, error: msg || 'Failed to fetch sales orders' };
  }
}

export async function createSalesOrder(data: {
  customer_id?: string;
  customer_name: string;
  project_type?: string;
  quotation_id?: string;
  delivery_date?: Date;
  tax_rate?: number;
  notes?: string;
  items: SalesOrderItemInput[];
}) {
  try {
    await requirePermission("Sales Order", "create");
    const items = data.items.map((item) => ({
      item_code: item.item_code || 'Services',
      item_name: item.description,
      qty: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
    }));
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;

    const name = `SO-${Date.now()}`;
    const order = await prisma.salesOrder.create({
      data: {
        name,
        customer: data.customer_id || data.customer_name,
        customer_name: data.customer_name,
        company: 'Aries',
        transaction_date: new Date(),
        delivery_date: data.delivery_date || null,
        currency: 'AED',
        conversion_rate: 1,
        selling_price_list: 'Standard Selling',
        price_list_currency: 'AED',
        plc_conversion_rate: 1,
        net_total: subtotal,
        total: subtotal,
        base_total: subtotal,
        base_net_total: subtotal,
        total_taxes_and_charges: taxAmount,
        base_total_taxes_and_charges: taxAmount,
        grand_total: total,
        base_grand_total: total,
        total_qty: data.items.reduce((s, i) => s + i.quantity, 0),
        total_net_weight: 0,
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
        terms: data.notes || null,
        status: 'Draft',
        naming_series: 'SO-',
        order_type: 'Sales',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    // Create child SO items
    for (const item of items) {
      await prisma.salesOrderItem.create({
        data: {
          name: `SOI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          parent: name,
          parentfield: 'items',
          parenttype: 'Sales Order',
          item_code: item.item_code,
          item_name: item.item_name,
          qty: item.qty,
          uom: 'Nos',
          conversion_factor: 1,
          stock_uom: 'Nos',
          stock_qty: item.qty,
          price_list_rate: item.rate,
          base_price_list_rate: item.rate,
          margin_rate_or_amount: 0,
          rate_with_margin: item.rate,
          discount_percentage: 0,
          discount_amount: 0,
          base_rate_with_margin: item.rate,
          rate: item.rate,
          amount: item.amount,
          base_rate: item.rate,
          base_amount: item.amount,
          net_rate: item.rate,
          net_amount: item.amount,
          base_net_rate: item.rate,
          base_net_amount: item.amount,
          weight_per_unit: 0,
          total_weight: 0,
          billed_amt: 0,
          valuation_rate: item.rate,
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
          stock_uom_rate: item.rate,
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
    return {
      success: true as const,
      order: {
        id: order.name,
        order_number: order.name,
        customer_name: order.customer_name,
        project_type: null,
        delivery_date: order.delivery_date || null,
        status: 'Draft',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: 'AED',
        notes: data.notes || null,
        created_at: order.creation,
      } as ClientSafeSalesOrder,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating sales order:', msg);
    return { success: false as const, error: msg || 'Failed to create sales order' };
  }
}

export async function updateSalesOrderStatus(id: string, status: string) {
  try {
    await requirePermission("Sales Order", "update");
    const docstatus = status === 'CANCELLED' ? 2 : status === 'SUBMITTED' ? 1 : 0;
    await prisma.salesOrder.update({
      where: { name: id },
      data: { status, docstatus },
    });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sales-orders] updateSalesOrderStatus failed:', msg);
    return { success: false, error: msg || 'Failed to update sales order status' };
  }
}

export async function updateSalesOrder(
  id: string,
  data: Partial<{ customer_name: string; project_type: string; delivery_date: Date; tax_rate: number; notes: string }>
) {
  try {
    await requirePermission("Sales Order", "update");
    const updateData: Record<string, unknown> = {
      modified: new Date(),
      modified_by: 'Administrator',
    };
    if (data.customer_name !== undefined) updateData.customer_name = data.customer_name;
    if (data.delivery_date !== undefined) updateData.delivery_date = data.delivery_date;
    if (data.notes !== undefined) updateData.terms = data.notes;

    await prisma.salesOrder.update({
      where: { name: id },
      data: updateData,
    });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sales-orders] updateSalesOrder failed:', msg);
    return { success: false, error: msg || 'Failed to update sales order' };
  }
}

export async function deleteSalesOrder(id: string) {
  try {
    await requirePermission("Sales Order", "delete");
    await prisma.salesOrder.update({
      where: { name: id },
      data: { status: 'Cancelled', docstatus: 2 },
    });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sales-orders] deleteSalesOrder failed:', msg);
    return { success: false, error: msg || 'Failed to delete sales order' };
  }
}

// ── Submit / Cancel ─────────────────────────────────────────────────────────

export async function submitSalesOrder(id: string): Promise<SubmitResult> {
  await requirePermission("Sales Order", "submit");
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Sales Order", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/sales-orders');
  return result;
}

export async function cancelSalesOrder(id: string): Promise<CancelResult> {
  await requirePermission("Sales Order", "cancel");
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Sales Order", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/sales-orders');
  return result;
}

// ── Validation & Business Logic ─────────────────────────────────────────────

export async function validateSalesOrder(
  data: SalesOrderValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    await requirePermission("Sales Order", "read");
    if (!data.customer || data.customer.trim().length === 0) {
      return { success: false, error: 'Customer is required' };
    }
    const customers = await prisma.customer.findMany({
      where: { customer_name: data.customer },
      take: 1,
    });
    if (customers.length === 0) {
      return { success: false, error: `Customer "${data.customer}" not found` };
    }

    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'At least one item is required' };
    }
    for (const item of data.items) {
      if (!item.description || item.description.trim().length === 0) {
        return { success: false, error: 'Item description is required for all items' };
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return { success: false, error: `Item "${item.description}" must have quantity > 0` };
      }
      if (typeof item.rate !== 'number' || item.rate < 0) {
        return { success: false, error: `Item "${item.description}" must have a valid rate` };
      }
    }

    if (!data.delivery_date) {
      return { success: false, error: 'Delivery Date is required' };
    }
    const deliveryDate = new Date(data.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      return { success: false, error: 'Expected Delivery Date should be after Sales Order Date' };
    }

    // Credit limit check via CustomerCreditLimit child table
    const customer = customers[0];
    const creditLimitRow = await prisma.customerCreditLimit.findFirst({
      where: { parent: customer.name, company: 'Aries' },
      select: { credit_limit: true },
    });
    const creditLimit = Number(creditLimitRow?.credit_limit || 0);
    if (creditLimit > 0 && data.grand_total !== undefined) {
      const outstandingInvoices = await prisma.salesInvoice.findMany({
        where: {
          customer_name: data.customer,
          outstanding_amount: { gt: 0 },
          docstatus: 1,
        },
        select: { outstanding_amount: true },
      });
      const totalOutstanding = outstandingInvoices.reduce(
        (sum, inv) => sum + Number(inv.outstanding_amount || 0),
        0
      );
      const projectedOutstanding = totalOutstanding + data.grand_total;
      if (projectedOutstanding > creditLimit) {
        return {
          success: false,
          error: `Credit limit has been crossed for customer ${data.customer} (${projectedOutstanding.toFixed(2)}/${creditLimit.toFixed(2)})`,
        };
      }
    }

    return { success: true, valid: true };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sales-orders] validateSalesOrder failed:', msg);
    return { success: false, error: msg || 'Validation failed' };
  }
}

export async function makeDeliveryNote(
  _salesOrderId: string
): Promise<{ success: true; deliveryNote: { name: string } } | { success: false; error: string }> {
  await requirePermission("Sales Order", "create");
  return {
    success: false,
    error: 'Delivery Notes are not supported in the Prisma schema',
  };
}

export async function getSalesOrderStatus(
  soId: string
): Promise<
  | { success: true; status: string; deliveryStatus: string; billingStatus: string; perDelivered: number; perBilled: number }
  | { success: false; error: string }
> {
  try {
    await requirePermission("Sales Order", "read");
    const so = await prisma.salesOrder.findUnique({
      where: { name: soId },
    });
    if (!so) {
      return { success: false, error: 'Sales Order not found' };
    }

    return {
      success: true,
      status: so.docstatus === 1 ? 'Submitted' : so.docstatus === 2 ? 'Cancelled' : 'Draft',
      deliveryStatus: so.delivery_status || 'Not Delivered',
      billingStatus: so.billing_status || 'Not Billed',
      perDelivered: so.per_delivered || 0,
      perBilled: so.per_billed || 0,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[sales-orders] getSalesOrderStatus failed:', msg);
    return { success: false, error: msg || 'Failed to get sales order status' };
  }
}
