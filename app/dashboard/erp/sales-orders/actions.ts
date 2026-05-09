'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument } from '@/lib/erpnext/document-orchestrator';

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
  created_at: Date;
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

// ── Existing CRUD functions ─────────────────────────────────────────────────

export async function listSalesOrders(params?: {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; orders: ClientSafeSalesOrder[] } | { success: false; error: string }
> {
  try {
    const orders = await prisma.sales_orders.findMany({
      where: {
        ...(params?.status
          ? { status: params.status as 'DRAFT' | 'TO_DELIVER' | 'TO_BILL' | 'COMPLETED' | 'CANCELLED' }
          : {}),
        ...(params?.from_date || params?.to_date
          ? {
              delivery_date: {
                ...(params.from_date ? { gte: new Date(params.from_date) } : {}),
                ...(params.to_date ? { lte: new Date(params.to_date) } : {}),
              },
            }
          : {}),
        ...(params?.search
          ? {
              OR: [
                { customer_name: { contains: params.search, mode: 'insensitive' } },
                { order_number: { contains: params.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { sales_order_items: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        customer_name: o.customer_name || 'Unknown',
        project_type: o.project_type || null,
        delivery_date: o.delivery_date || null,
        status: o.status,
        subtotal: o.subtotal || 0,
        tax_rate: o.tax_rate || 0,
        tax_amount: o.tax_amount || 0,
        total: o.total || 0,
        currency: o.currency || 'AED',
        notes: o.notes || null,
        created_at: o.created_at || new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching sales orders:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch sales orders' };
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
    const items = data.items.map((item) => ({
      id: crypto.randomUUID(),
      item_code: item.item_code || 'Services',
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
      delivered_qty: 0,
    }));
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;

    const order = await prisma.sales_orders.create({
      data: {
        id: crypto.randomUUID(),
        order_number: `SO-${Date.now()}`,
        customer_name: data.customer_name,
        customer_id: data.customer_id || null,
        quotation_id: data.quotation_id || null,
        project_type: data.project_type || null,
        delivery_date: data.delivery_date || null,
        status: 'DRAFT',
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: 'AED',
        notes: data.notes || null,
        sales_order_items: {
          create: items,
        },
      },
      include: { sales_order_items: true },
    });

    revalidatePath('/erp/sales-orders');
    return {
      success: true as const,
      order: {
        id: order.id,
        order_number: order.order_number,
        customer_name: order.customer_name,
        project_type: order.project_type || null,
        delivery_date: order.delivery_date || null,
        status: order.status,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total,
        currency: 'AED',
        notes: data.notes || null,
        created_at: new Date(),
      } as ClientSafeSalesOrder,
    };
  } catch (error: any) {
    console.error('Error creating sales order:', error?.message);
    return { success: false as const, error: error?.message || 'Failed to create sales order' };
  }
}

export async function updateSalesOrderStatus(id: string, status: string) {
  try {
    if (status === 'CANCELLED') {
      await prisma.sales_orders.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
    } else {
      await prisma.sales_orders.update({
        where: { id },
        data: {
          status: status as 'DRAFT' | 'TO_DELIVER' | 'TO_BILL' | 'COMPLETED' | 'CANCELLED',
        },
      });
    }
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] updateSalesOrderStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update sales order status' };
  }
}

export async function updateSalesOrder(
  id: string,
  data: Partial<{ customer_name: string; project_type: string; delivery_date: Date; tax_rate: number; notes: string }>
) {
  try {
    await prisma.sales_orders.update({
      where: { id },
      data: {
        ...(data.customer_name !== undefined ? { customer_name: data.customer_name } : {}),
        ...(data.project_type !== undefined ? { project_type: data.project_type } : {}),
        ...(data.delivery_date !== undefined ? { delivery_date: data.delivery_date } : {}),
        ...(data.tax_rate !== undefined ? { tax_rate: data.tax_rate } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
    });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] updateSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update sales order' };
  }
}

export async function deleteSalesOrder(id: string) {
  try {
    await prisma.sales_orders.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] deleteSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete sales order' };
  }
}

// ── Submit / Cancel (via document orchestrator) ─────────────────────────────────

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function submitSalesOrder(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const result = await submitDocument("Sales Order", id);
  if (result.success) revalidatePath('/dashboard/erp/sales-orders');
  return result;
}

// TODO: Dual-schema — this action creates in public schema but orchestrator queries erpnext_port
export async function cancelSalesOrder(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const result = await cancelDocument("Sales Order", id);
  if (result.success) revalidatePath('/dashboard/erp/sales-orders');
  return result;
}

// ── NEW: Validation & Business Logic ────────────────────────────────────────

/**
 * Validate a Sales Order before submission.
 * Checks: customer exists, items present, delivery_date after transaction_date,
 * credit limit against outstanding + order total.
 */
export async function validateSalesOrder(
  data: SalesOrderValidateInput
): Promise<{ success: true; valid: true } | { success: false; error: string }> {
  try {
    // 1. Customer must exist
    if (!data.customer || data.customer.trim().length === 0) {
      return { success: false, error: 'Customer is required' };
    }
    const customers = await prisma.customers.findMany({
      where: { customer_name: data.customer },
      take: 1,
    });
    if (customers.length === 0) {
      return { success: false, error: `Customer "${data.customer}" not found` };
    }

    // 2. Items must not be empty
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

    // 3. Delivery date must be present and in the future
    if (!data.delivery_date) {
      return { success: false, error: 'Delivery Date is required' };
    }
    const deliveryDate = new Date(data.delivery_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (deliveryDate < today) {
      return { success: false, error: 'Expected Delivery Date should be after Sales Order Date' };
    }

    // 4. Credit limit check
    const customer = customers[0];
    const creditLimit = customer.credit_limit || 0;
    if (creditLimit > 0 && data.grand_total !== undefined) {
      const outstandingInvoices = await prisma.sales_invoices.findMany({
        where: {
          customer_name: data.customer,
          outstanding_amount: { gt: 0 },
          status: 'SUBMITTED',
        },
        select: { outstanding_amount: true },
      });
      const totalOutstanding = outstandingInvoices.reduce(
        (sum, inv) => sum + (inv.outstanding_amount || 0),
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
  } catch (error: any) {
    console.error('[sales-orders] validateSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Validation failed' };
  }
}

/**
 * Create a Delivery Note from a submitted Sales Order.
 * Not supported in the Prisma schema (no delivery_notes model).
 */
export async function makeDeliveryNote(
  _salesOrderId: string
): Promise<{ success: true; deliveryNote: { name: string } } | { success: false; error: string }> {
  return {
    success: false,
    error: 'Delivery Notes are not supported in the Prisma schema',
  };
}

/**
 * Compute the effective status of a Sales Order.
 * Prisma schema does not track delivered/billed percentages.
 */
export async function getSalesOrderStatus(
  soId: string
): Promise<
  | { success: true; status: string; deliveryStatus: string; billingStatus: string; perDelivered: number; perBilled: number }
  | { success: false; error: string }
> {
  try {
    const so = await prisma.sales_orders.findUnique({
      where: { id: soId },
    });
    if (!so) {
      return { success: false, error: 'Sales Order not found' };
    }

    return {
      success: true,
      status: so.status,
      deliveryStatus: 'Not Delivered',
      billingStatus: 'Not Billed',
      perDelivered: 0,
      perBilled: 0,
    };
  } catch (error: any) {
    console.error('[sales-orders] getSalesOrderStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to get sales order status' };
  }
}
