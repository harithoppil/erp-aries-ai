import { prisma } from '@/lib/prisma';
import SalesOrderDetailClient from '@/app/erp/sales-orders/[id]/sales-order-detail-client';

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const salesOrder = await prisma.sales_orders.findUnique({
    where: { id },
    include: {
      sales_order_items: true,
      customers: true,
      quotations: true,
    },
  });

  if (!salesOrder) {
    return <div className="p-8 text-center text-muted-foreground">Sales Order not found</div>;
  }

  const record = {
    ...salesOrder,
    status: String(salesOrder.status),
    delivery_date: salesOrder.delivery_date?.toISOString() ?? null,
    created_at: salesOrder.created_at.toISOString(),
    sales_order_items: salesOrder.sales_order_items,
    customers: salesOrder.customers ? {
      id: salesOrder.customers.id,
      customer_name: salesOrder.customers.customer_name,
      customer_code: salesOrder.customers.customer_code,
    } : null,
    quotations: salesOrder.quotations ? {
      id: salesOrder.quotations.id,
      quotation_number: salesOrder.quotations.quotation_number,
    } : null,
  };

  return <SalesOrderDetailClient record={record} />;
}
