import { prisma } from '@/lib/prisma';
import PaymentDetailClient from '@/app/erp/payments/[id]/payment-detail-client';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.payment_entries.findUnique({
    where: { id },
    include: {
      sales_invoices: {
        include: {
          invoice_items: true,
        },
      },
    },
  });
  if (!record) return <div className="p-8 text-center text-muted-foreground">Payment not found</div>;
  return <PaymentDetailClient record={JSON.parse(JSON.stringify(record))} />;
}
