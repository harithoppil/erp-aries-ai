'use server';

import { prisma } from '@/lib/prisma';
import { salesorderstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { generateId, generateShortCode } from '@/lib/uuid';

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

export async function listSalesOrders(params?: {
  search?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; orders: ClientSafeSalesOrder[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (params?.search) {
      where.OR = [
        { order_number: { contains: params.search, mode: 'insensitive' } },
        { customer_name: { contains: params.search, mode: 'insensitive' } },
        { project_type: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.status) {
      where.status = params.status;
    }
    const orders = await prisma.sales_orders.findMany({ where, orderBy: { created_at: 'desc' } });
    return { success: true, orders: orders.map((o) => ({ ...o, status: String(o.status) })) };
  } catch (error) {
    console.error('Error fetching sales orders:', error);
    return { success: false, error: 'Failed to fetch sales orders' };
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
  items: { description: string; quantity: number; rate: number; item_code?: string }[];
}) {
  try {
    const subtotal = data.items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxRate = data.tax_rate || 5;
    const taxAmount = subtotal * taxRate / 100;
    const total = subtotal + taxAmount;
    const orderNumber = `SO-${Date.now().toString().slice(-6)}`;

    const order = await prisma.$transaction(async (tx) => {
      const so = await tx.sales_orders.create({
        data: {
          id: generateId(),
          order_number: orderNumber,
          customer_id: data.customer_id || null,
          customer_name: data.customer_name,
          project_type: data.project_type || null,
          quotation_id: data.quotation_id || null,
          delivery_date: data.delivery_date || null,
          status: salesorderstatus.DRAFT,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total,
          currency: 'AED',
          notes: data.notes || null,
        }
      });

      for (const item of data.items) {
        await tx.sales_order_items.create({
          data: {
            id: generateId(),
            sales_order_id: so.id,
            item_code: item.item_code || null,
            description: item.description,
            quantity: item.quantity,
            rate: item.rate,
            amount: item.quantity * item.rate,
            delivered_qty: 0,
          }
        });
      }

      return so;
    });

    revalidatePath('/erp/sales-orders');
    return { success: true as const, order: { ...order, status: String(order.status) } as ClientSafeSalesOrder };
  } catch (error: any) {
    console.error('Error creating sales order:', error);
    if (error.code === 'P2002') return { success: false as const, error: 'Order number already exists' };
    return { success: false as const, error: 'Failed to create sales order' };
  }
}

// ── Sales Order Mutations ──────────────────────────────────────────────────

export async function updateSalesOrderStatus(id: string, status: salesorderstatus) {
  try {
    const record = await prisma.sales_orders.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/sales-orders');
    return { success: true, data: record };
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
    const record = await prisma.sales_orders.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/sales-orders');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[sales-orders] updateSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update sales order' };
  }
}

export async function deleteSalesOrder(id: string) {
  try {
    await prisma.sales_orders.update({
      where: { id },
      data: { status: salesorderstatus.CANCELLED },
    });
    revalidatePath('/erp/sales-orders');
    return { success: true };
  } catch (error: any) {
    console.error('[sales-orders] deleteSalesOrder failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete sales order' };
  }
}
