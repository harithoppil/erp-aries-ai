import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import PODetailClient from '@/app/dashboard/erp/procurement/[id]/po-detail-client';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const purchaseOrder = await frappeGetDoc<any>('Purchase Order', id);
    const items = purchaseOrder.items || [];

    const record = {
      ...purchaseOrder,
      id: purchaseOrder.name,
      po_number: purchaseOrder.name,
      status: purchaseOrder.docstatus === 1 ? 'SUBMITTED' : purchaseOrder.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
      order_date: purchaseOrder.transaction_date || new Date().toISOString().slice(0, 10),
      expected_delivery: purchaseOrder.schedule_date || null,
      created_at: purchaseOrder.creation || new Date().toISOString(),
      po_items: items.map((item: any) => ({
        id: item.name || `${id}-${item.idx}`,
        po_id: id,
        item_code: item.item_code || '',
        description: item.description || item.item_name || '',
        quantity: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })),
      suppliers: purchaseOrder.supplier ? {
        id: purchaseOrder.supplier,
        supplier_name: purchaseOrder.supplier,
        supplier_code: purchaseOrder.supplier,
        email: null,
        phone: null,
      } : null,
      projects: null,
    };

    return <PODetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Purchase Order not found</div>;
  }
}
