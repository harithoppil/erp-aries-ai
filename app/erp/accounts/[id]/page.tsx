import { prisma } from '@/lib/prisma';
import InvoiceDetailClient from '@/app/erp/accounts/[id]/invoice-detail-client';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.sales_invoices.findUnique({
    where: { id },
    include: {
      invoice_items: true,
      payment_entries: { orderBy: { posting_date: 'desc' } },
    },
  });

  if (!invoice) {
    return <div className="p-8 text-center text-muted-foreground">Invoice not found</div>;
  }

  const record = {
    ...invoice,
    status: String(invoice.status),
    posting_date: invoice.posting_date?.toISOString() ?? '',
    due_date: invoice.due_date?.toISOString() ?? null,
    created_at: invoice.created_at.toISOString(),
    invoice_items: invoice.invoice_items,
    payment_entries: invoice.payment_entries.map(p => ({
      ...p,
      posting_date: p.posting_date.toISOString(),
      reference_date: p.reference_date?.toISOString() ?? null,
    })),
  };

  return <InvoiceDetailClient record={record} />;
}
