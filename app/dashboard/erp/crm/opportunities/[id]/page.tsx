import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/erp/opportunity/${encodeURIComponent(id)}`);
}
