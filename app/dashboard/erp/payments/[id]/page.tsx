import { frappeGetDoc, frappeGetList } from '@/lib/frappe-client';
import PaymentDetailClient from '@/app/dashboard/erp/payments/[id]/payment-detail-client';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const payment = await frappeGetDoc<any>('Payment Entry', id);
    const references = payment.references || [];

    const record = {
      ...payment,
      id: payment.name,
      payment_number: payment.name,
      party_type: payment.party_type || 'Customer',
      party_name: payment.party || 'Unknown',
      payment_type: payment.payment_type || 'Receive',
      posting_date: payment.posting_date || new Date().toISOString().slice(0, 10),
      paid_amount: payment.paid_amount || 0,
      received_amount: payment.received_amount || 0,
      reference_no: payment.reference_no || null,
      mode_of_payment: payment.mode_of_payment || null,
      status: payment.docstatus === 1 ? 'SUBMITTED' : payment.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
      sales_invoices: references.map((ref: any) => ({
        id: ref.reference_name,
        invoice_number: ref.reference_name,
        customer_name: payment.party,
        status: 'SUBMITTED',
        total: ref.allocated_amount || 0,
        invoice_items: [],
      })),
    };

    return <PaymentDetailClient record={record} />;
  } catch {
    return <div className="p-8 text-center text-muted-foreground">Payment not found</div>;
  }
}
