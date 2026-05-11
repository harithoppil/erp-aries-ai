import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CostCenterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/cost-center/${encodeURIComponent(id)}`);
}
