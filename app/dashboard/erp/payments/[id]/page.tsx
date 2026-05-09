import { prisma } from '@/lib/prisma';
import PaymentDetailClient from '@/app/dashboard/erp/payments/[id]/payment-detail-client';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const payment = await prisma.payment_entries.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new Error('Payment not found');
    }

    const record = {
      ...payment,
      id: payment.id,
      payment_number: payment.id,
      party_type: payment.party_type || 'Customer',
      party_name: payment.party_name || 'Unknown',
      payment_type: payment.payment_type || 'Receive',
      posting_date: payment.posting_date.toISOString().slice(0, 10),
      paid_amount: payment.amount || 0,
      received_amount: payment.amount || 0,
      reference_no: payment.reference_number || null,
      mode_of_payment: null,
      reference_date: payment.reference_date?.toISOString().slice(0, 10) ?? null,
      status: 'SUBMITTED' as const,
      sales_invoices: payment.invoice_id
        ? [
            {
              id: payment.invoice_id,
              invoice_number: payment.invoice_id,
              customer_name: payment.party_name || 'Unknown',
              status: 'SUBMITTED' as const,
              total: payment.amount || 0,
              invoice_items: [],
            },
          ]
        : [],
    };

    return <PaymentDetailClient record={record as any} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Payment not found</div>;
  }
}
