export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import InvoiceDetailClient, { type InvoiceRecord } from '@/app/dashboard/erp/accounts/[id]/invoice-detail-client';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const [invoice, items] = await Promise.all([
      prisma.salesInvoice.findUnique({ where: { name: id } }),
      prisma.salesInvoiceItem.findMany({ where: { parent: id }, orderBy: { idx: 'asc' } }),
    ]);

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const record: InvoiceRecord = {
      id: invoice.name,
      invoice_number: invoice.name,
      enquiry_id: null,
      customer_name: invoice.customer_name ?? '',
      customer_email: null,
      posting_date: invoice.posting_date?.toISOString().slice(0, 10) ?? '',
      due_date: invoice.due_date?.toISOString().slice(0, 10) ?? null,
      status: invoice.docstatus === 2 ? 'CANCELLED' : invoice.docstatus === 1 ? 'SUBMITTED' : 'DRAFT',
      subtotal: Number(invoice.net_total || 0),
      tax_rate: 0,
      tax_amount: Number(invoice.total_taxes_and_charges || 0),
      total: Number(invoice.grand_total || 0),
      currency: invoice.currency ?? 'AED',
      paid_amount: Number(invoice.paid_amount || 0),
      outstanding_amount: Number(invoice.outstanding_amount || 0),
      document_id: null,
      created_at: invoice.creation?.toISOString() ?? new Date().toISOString(),
      invoice_items: items.map((item) => ({
        id: item.name,
        invoice_id: id,
        item_code: item.item_code || '',
        description: item.description || '',
        quantity: item.qty || 0,
        rate: Number(item.rate || 0),
        amount: Number(item.amount || 0),
      })),
      payment_entries: [],
    };

    return <InvoiceDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;
  }
}
