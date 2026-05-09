import { prisma } from '@/lib/prisma';
import InvoiceDetailClient from '@/app/dashboard/erp/accounts/[id]/invoice-detail-client';

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

    const record = {
      ...invoice,
      id: invoice.id,
      status: invoice.status,
      posting_date: invoice.posting_date.toISOString().slice(0, 10),
      due_date: invoice.due_date?.toISOString().slice(0, 10) ?? null,
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
        payment_id: p.id,
        invoice_id: id,
        amount: p.amount || 0,
        posting_date: p.posting_date.toISOString().slice(0, 10),
        reference_date: p.reference_date?.toISOString().slice(0, 10) ?? null,
      })),
    };

    return <InvoiceDetailClient record={record as any} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;
  }
}
