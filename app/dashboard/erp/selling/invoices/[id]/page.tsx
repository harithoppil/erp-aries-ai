import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SalesInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/sales-invoice/${encodeURIComponent(id)}`);
}
