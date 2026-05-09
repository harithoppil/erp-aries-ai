import { prisma } from '@/lib/prisma';
import SalesOrderDetailClient from '@/app/dashboard/erp/sales-orders/[id]/sales-order-detail-client';

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const salesOrder = await prisma.sales_orders.findUnique({
      where: { id },
      include: { sales_order_items: true },
    });

    if (!salesOrder) throw new Error('Not found');

    const items = salesOrder.sales_order_items || [];

    const quotations = await prisma.quotations.findMany({
      where: { customer_name: salesOrder.customer_name },
      orderBy: { created_at: 'desc' },
      take: 5,
    });

    const record = {
      ...salesOrder,
      id: salesOrder.id,
      status: salesOrder.status === 'CANCELLED' ? 'CANCELLED' : salesOrder.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
      delivery_date: salesOrder.delivery_date ? salesOrder.delivery_date.toISOString() : null,
      created_at: salesOrder.created_at.toISOString(),
      sales_order_items: items.map((item) => ({
        id: item.id,
        sales_order_id: id,
        item_code: item.item_code ?? null,
        description: item.description || '',
        quantity: item.quantity || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
        delivered_qty: item.delivered_qty || 0,
      })),
      customers: salesOrder.customer_id ? {
        id: salesOrder.customer_id,
        customer_name: salesOrder.customer_name,
        customer_code: salesOrder.customer_name,
      } : null,
      quotations: quotations.length > 0
        ? { id: quotations[0].id, quotation_number: quotations[0].quotation_number }
        : null,
    };

    return <SalesOrderDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Sales Order not found</div>;
  }
}
