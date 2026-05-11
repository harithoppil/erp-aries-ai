import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PurchaseInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/purchase-invoice/${encodeURIComponent(id)}`);
}
