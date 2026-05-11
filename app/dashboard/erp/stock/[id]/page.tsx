import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function StockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/item/${encodeURIComponent(id)}`);
}
