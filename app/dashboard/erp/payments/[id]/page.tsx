import { prisma } from '@/lib/prisma';
import PaymentDetailClient, { type PaymentRecord } from '@/app/dashboard/erp/payments/[id]/payment-detail-client';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const payment = await prisma.payment_entries.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const record: PaymentRecord = {
      id: payment.id,
      invoice_id: payment.invoice_id ?? null,
      payment_type: payment.payment_type || 'Receive',
      party_type: payment.party_type || 'Customer',
      party_name: payment.party_name || 'Unknown',
      amount: payment.amount || 0,
      currency: payment.currency ?? 'AED',
      reference_number: payment.reference_number ?? null,
      reference_date: payment.reference_date?.toISOString().slice(0, 10) ?? null,
      posting_date: payment.posting_date.toISOString().slice(0, 10),
      sales_invoices: payment.invoice_id
        ? {
            id: payment.invoice_id,
            invoice_number: payment.invoice_id,
            customer_name: payment.party_name || 'Unknown',
            status: 'SUBMITTED' as const,
            total: payment.amount || 0,
            paid_amount: payment.amount || 0,
            outstanding_amount: 0,
            currency: payment.currency ?? 'AED',
            due_date: null,
            posting_date: payment.posting_date.toISOString().slice(0, 10),
            invoice_items: [],
          }
        : null,
    };

    return <PaymentDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Payment not found</div>;
  }
}
