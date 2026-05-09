import { prisma } from '@/lib/prisma';
import InvoiceDetailClient, { type InvoiceRecord } from '@/app/dashboard/erp/accounts/[id]/invoice-detail-client';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const invoice = await prisma.sales_invoices.findUnique({
      where: { id },
      include: { invoice_items: true },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const payments = await prisma.payment_entries.findMany({
      where: { invoice_id: id },
    });

    const record: InvoiceRecord = {
      id: invoice.id,
      invoice_number: invoice.invoice_number ?? invoice.id,
      enquiry_id: invoice.enquiry_id ?? null,
      customer_name: invoice.customer_name ?? '',
      customer_email: invoice.customer_email ?? null,
      posting_date: invoice.posting_date.toISOString().slice(0, 10),
      due_date: invoice.due_date?.toISOString().slice(0, 10) ?? null,
      status: invoice.status ?? 'DRAFT',
      subtotal: invoice.subtotal ?? 0,
      tax_rate: invoice.tax_rate ?? 0,
      tax_amount: invoice.tax_amount ?? 0,
      total: invoice.total ?? 0,
      currency: invoice.currency ?? 'AED',
      paid_amount: invoice.paid_amount ?? 0,
      outstanding_amount: invoice.outstanding_amount ?? 0,
      document_id: invoice.document_id ?? null,
      created_at: invoice.created_at.toISOString(),
      invoice_items: invoice.invoice_items.map((item) => ({
        id: item.id,
        invoice_id: item.invoice_id,
        item_code: item.item_code || '',
        description: item.description || '',
        quantity: item.quantity || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
      })),
      payment_entries: payments.map((p) => ({
        id: p.id,
        invoice_id: id,
        payment_type: p.payment_type ?? 'Receive',
        party_type: p.party_type ?? 'Customer',
        party_name: p.party_name ?? '',
        amount: p.amount || 0,
        currency: p.currency ?? 'AED',
        reference_number: p.reference_number ?? null,
        reference_date: p.reference_date?.toISOString().slice(0, 10) ?? null,
        posting_date: p.posting_date.toISOString().slice(0, 10),
      })),
    };

    return <InvoiceDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;
  }
}
