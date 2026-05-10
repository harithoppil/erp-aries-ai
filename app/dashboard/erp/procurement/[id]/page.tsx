export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import PODetailClient from '@/app/dashboard/erp/procurement/[id]/po-detail-client';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [purchaseOrder, items] = await Promise.all([
      prisma.purchaseOrder.findUnique({ where: { name: id } }),
      prisma.purchaseOrderItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);

    if (!purchaseOrder) {
      return <div className="p-8 text-center text-muted-foreground">Purchase Order not found</div>;
    }

    const supplier = purchaseOrder.supplier
      ? await prisma.supplier.findUnique({ where: { name: purchaseOrder.supplier } })
      : null;

    const record = {
      id: purchaseOrder.name,
      po_number: purchaseOrder.name,
      supplier_id: purchaseOrder.supplier || '',
      project_id: null,
      status: purchaseOrder.docstatus === 2 ? 'CANCELLED' : purchaseOrder.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
      order_date: purchaseOrder.transaction_date?.toISOString().slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      expected_delivery: purchaseOrder.schedule_date?.toISOString().slice(0, 10) ?? null,
      subtotal: Number(purchaseOrder.net_total || 0),
      tax_amount: Number(purchaseOrder.total_taxes_and_charges || 0),
      total: Number(purchaseOrder.grand_total || 0),
      currency: purchaseOrder.currency || 'AED',
      notes: null,
      created_at: purchaseOrder.creation?.toISOString() ?? new Date().toISOString(),
      po_items: items.map((item) => ({
        id: item.name,
        po_id: id,
        item_code: item.item_code || '',
        description: item.description || '',
        quantity: item.qty || 0,
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
      })),
      suppliers: supplier ? {
        id: supplier.name,
        supplier_name: supplier.supplier_name || supplier.name,
        supplier_code: supplier.name,
        email: null,
        phone: null,
      } : null,
      projects: null,
    };

    return <PODetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Purchase Order not found</div>;
  }
}
