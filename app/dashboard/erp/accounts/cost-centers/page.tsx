import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function CostCentersPage() {
  redirect('/dashboard/erp/cost-center');
}
