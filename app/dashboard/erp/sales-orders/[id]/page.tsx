export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import SalesOrderDetailClient from '@/app/dashboard/erp/sales-orders/[id]/sales-order-detail-client';

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [salesOrder, items] = await Promise.all([
      prisma.salesOrder.findUnique({ where: { name: id } }),
      prisma.salesOrderItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);

    if (!salesOrder) throw new Error('Not found');

    const quotations = salesOrder.customer
      ? await prisma.quotation.findMany({
          where: { party_name: salesOrder.customer },
          orderBy: { creation: 'desc' },
          take: 5,
        })
      : [];

    const record = {
      id: salesOrder.name,
      order_number: salesOrder.name,
      quotation_id: null,
      customer_id: salesOrder.customer || null,
      customer_name: salesOrder.customer_name || '',
      project_type: salesOrder.order_type || null,
      delivery_date: salesOrder.delivery_date?.toISOString().slice(0, 10) ?? null,
      status: salesOrder.docstatus === 2 ? 'CANCELLED' : salesOrder.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
      subtotal: Number(salesOrder.net_total || 0),
      tax_rate: 0,
      tax_amount: Number(salesOrder.total_taxes_and_charges || 0),
      total: Number(salesOrder.grand_total || 0),
      currency: salesOrder.currency || 'AED',
      notes: salesOrder.terms || null,
      created_at: salesOrder.creation?.toISOString() ?? new Date().toISOString(),
      sales_order_items: items.map((item) => ({
        id: item.name,
        sales_order_id: id,
        item_code: item.item_code || null,
        description: item.description || '',
        quantity: item.qty || 0,
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
        delivered_qty: 0,
      })),
      customers: salesOrder.customer ? {
        id: salesOrder.customer,
        customer_name: salesOrder.customer_name || salesOrder.customer,
        customer_code: salesOrder.customer,
      } : null,
      quotations: quotations.length > 0
        ? { id: quotations[0].name, quotation_number: quotations[0].name }
        : null,
    };

    return <SalesOrderDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Sales Order not found</div>;
  }
}
