import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/payment-entry/${encodeURIComponent(id)}`);
}
