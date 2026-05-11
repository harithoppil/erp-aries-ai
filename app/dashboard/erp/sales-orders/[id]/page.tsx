import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/sales-order/${encodeURIComponent(id)}`);
}
