import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import SalesOrderDetailClient from '@/app/dashboard/erp/sales-orders/[id]/sales-order-detail-client';

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const salesOrder = await frappeGetDoc<any>('Sales Order', id);
    const items = salesOrder.items || [];

    const quotations = await frappeGetList<any>('Quotation', {
      filters: { party_name: salesOrder.customer },
      fields: ['name', 'status', 'docstatus', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 5,
    });

    const record = {
      ...salesOrder,
      id: salesOrder.name,
      status: salesOrder.docstatus === 1 ? 'SUBMITTED' : salesOrder.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
      delivery_date: salesOrder.delivery_date || null,
      created_at: salesOrder.creation || new Date().toISOString(),
      sales_order_items: items.map((item: any) => ({
        id: item.name || `${id}-${item.idx}`,
        sales_order_id: id,
        item_code: item.item_code || '',
        description: item.description || item.item_name || '',
        quantity: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
        delivered_qty: item.delivered_qty || 0,
      })),
      customers: salesOrder.customer ? {
        id: salesOrder.customer,
        customer_name: salesOrder.customer,
        customer_code: salesOrder.customer,
      } : null,
      quotations: quotations.map((q: any) => ({
        id: q.name,
        quotation_number: q.name,
        status: q.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        created_at: q.creation || new Date().toISOString(),
      })),
    };

    return <SalesOrderDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Sales Order not found</div>;
  }
}
