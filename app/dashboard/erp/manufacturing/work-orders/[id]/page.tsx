import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function WorkOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/work-order/${encodeURIComponent(id)}`);
}
