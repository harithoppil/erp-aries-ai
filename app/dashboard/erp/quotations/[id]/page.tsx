import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import QuotationDetailClient from '@/app/dashboard/erp/quotations/[id]/quotation-detail-client';

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const quotation = await frappeGetDoc<any>('Quotation', id);
    const items = quotation.items || [];

    const salesOrders = await frappeGetList<any>('Sales Order', {
      filters: { quotation: id },
      fields: ['name', 'status', 'docstatus', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 10,
    });

    const record = {
      ...quotation,
      id: quotation.name,
      quotation_number: quotation.name,
      status: quotation.docstatus === 1 ? 'SUBMITTED' : quotation.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
      valid_until: quotation.valid_till || null,
      created_at: quotation.creation || new Date().toISOString(),
      quotation_items: items.map((item: any) => ({
        id: item.name || `${id}-${item.idx}`,
        quotation_id: id,
        item_code: item.item_code || '',
        description: item.description || item.item_name || '',
        quantity: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })),
      customers: quotation.party_name ? {
        id: quotation.party_name,
        customer_name: quotation.party_name,
      } : null,
      sales_orders: salesOrders.map((o: any) => ({
        id: o.name,
        order_number: o.name,
        status: o.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
        created_at: o.creation || new Date().toISOString(),
      })),
    };

    return <QuotationDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Quotation not found</div>;
  }
}
