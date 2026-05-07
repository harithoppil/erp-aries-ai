'use server';

import { prisma } from '@/lib/prisma';
import { salesorderstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

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

export async function listSalesOrders(): Promise<
  { success: true; orders: ClientSafeSalesOrder[] } | { success: false; error: string }
> {
  try {
    const orders = await prisma.sales_orders.findMany({ orderBy: { created_at: 'desc' } });
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
          id: randomUUID(),
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
            id: randomUUID(),
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
