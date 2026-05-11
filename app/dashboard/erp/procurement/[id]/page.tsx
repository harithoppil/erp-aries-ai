import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/purchase-order/${encodeURIComponent(id)}`);
}
