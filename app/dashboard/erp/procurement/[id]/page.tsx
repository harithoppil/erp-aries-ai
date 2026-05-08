import { prisma } from '@/lib/prisma';
import PODetailClient from '@/app/dashboard/erp/procurement/[id]/po-detail-client';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const purchaseOrder = await prisma.purchase_orders.findUnique({
    where: { id },
    include: {
      po_items: true,
      suppliers: true,
      projects: true,
    },
  });

  if (!purchaseOrder) {
    return <div className="p-8 text-center text-muted-foreground">Purchase Order not found</div>;
  }

  const record = {
    ...purchaseOrder,
    status: String(purchaseOrder.status),
    order_date: purchaseOrder.order_date.toISOString(),
    expected_delivery: purchaseOrder.expected_delivery?.toISOString() ?? null,
    created_at: purchaseOrder.created_at.toISOString(),
    po_items: purchaseOrder.po_items,
    suppliers: purchaseOrder.suppliers ? {
      id: purchaseOrder.suppliers.id,
      supplier_name: purchaseOrder.suppliers.supplier_name,
      supplier_code: purchaseOrder.suppliers.supplier_code,
      email: purchaseOrder.suppliers.email,
      phone: purchaseOrder.suppliers.phone,
    } : null,
    projects: purchaseOrder.projects ? {
      id: purchaseOrder.projects.id,
      project_name: purchaseOrder.projects.project_name,
      project_code: purchaseOrder.projects.project_code,
    } : null,
  };

  return <PODetailClient record={record} />;
}
