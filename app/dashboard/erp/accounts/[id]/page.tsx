import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import InvoiceDetailClient from '@/app/dashboard/erp/accounts/[id]/invoice-detail-client';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const invoice = await frappeGetDoc<any>('Sales Invoice', id);
    const items = invoice.items || [];
    const payments = await frappeGetList<any>('Payment Entry Reference', {
      filters: { reference_name: id },
      fields: ['name', 'parent', 'allocated_amount'],
      limit_page_length: 50,
    });

    const record = {
      ...invoice,
      id: invoice.name,
      status: invoice.docstatus === 1 ? 'SUBMITTED' : invoice.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
      posting_date: invoice.posting_date || new Date().toISOString().slice(0, 10),
      due_date: invoice.due_date || null,
      created_at: invoice.creation || new Date().toISOString(),
      invoice_items: items.map((item: any) => ({
        id: item.name || `${id}-${item.idx}`,
        invoice_id: id,
        item_code: item.item_code || '',
        description: item.description || item.item_name || '',
        quantity: item.qty || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })),
      payment_entries: payments.map((p: any) => ({
        id: p.name,
        payment_id: p.parent,
        invoice_id: id,
        amount: p.allocated_amount || 0,
        posting_date: invoice.posting_date || new Date().toISOString().slice(0, 10),
        reference_date: null,
      })),
    };

    return <InvoiceDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;
  }
}
