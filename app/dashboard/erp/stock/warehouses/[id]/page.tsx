import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WarehouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/warehouse/${encodeURIComponent(id)}`);
}
