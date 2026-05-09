import { prisma } from '@/lib/prisma';
import PODetailClient from '@/app/dashboard/erp/procurement/[id]/po-detail-client';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const purchaseOrder = await prisma.purchase_orders.findUnique({
      where: { id },
      include: { po_items: true, suppliers: true },
    });

    if (!purchaseOrder) {
      return <div className="p-8 text-center text-muted-foreground">Purchase Order not found</div>;
    }

    const items = purchaseOrder.po_items || [];

    const record = {
      ...purchaseOrder,
      id: purchaseOrder.id,
      po_number: purchaseOrder.po_number,
      status:
        purchaseOrder.status === 'CANCELLED'
          ? 'CANCELLED'
          : purchaseOrder.status === 'DRAFT'
            ? 'DRAFT'
            : 'SUBMITTED',
      order_date: purchaseOrder.order_date
        ? purchaseOrder.order_date.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      expected_delivery: purchaseOrder.expected_delivery
        ? purchaseOrder.expected_delivery.toISOString().slice(0, 10)
        : null,
      created_at: purchaseOrder.created_at
        ? purchaseOrder.created_at.toISOString()
        : new Date().toISOString(),
      po_items: items.map((item: any) => ({
        id: item.id,
        po_id: item.po_id,
        item_code: item.item_code || '',
        description: item.description || '',
        quantity: item.quantity || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })),
      suppliers: purchaseOrder.suppliers
        ? {
            id: purchaseOrder.suppliers.id,
            supplier_name: purchaseOrder.suppliers.supplier_name,
            supplier_code: purchaseOrder.suppliers.supplier_code,
            email: purchaseOrder.suppliers.email || null,
            phone: purchaseOrder.suppliers.phone || null,
          }
        : null,
      projects: null,
    };

    return <PODetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Purchase Order not found</div>;
  }
}
