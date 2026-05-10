export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import PaymentDetailClient, { type PaymentRecord } from '@/app/dashboard/erp/payments/[id]/payment-detail-client';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const payment = await prisma.paymentEntry.findUnique({ where: { name: id } });
    if (!payment) throw new Error('Payment not found');

    const record: PaymentRecord = {
      id: payment.name,
      invoice_id: null,
      payment_type: payment.payment_type || 'Receive',
      party_type: payment.party_type || 'Customer',
      party_name: payment.party_name || 'Unknown',
      amount: Number(payment.paid_amount || 0),
      currency: payment.paid_from_account_currency || 'AED',
      reference_number: payment.reference_no ?? null,
      reference_date: payment.reference_date?.toISOString().slice(0, 10) ?? null,
      posting_date: payment.posting_date?.toISOString().slice(0, 10) ?? '',
      sales_invoices: null,
    };

    return <PaymentDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Payment not found</div>;
  }
}
