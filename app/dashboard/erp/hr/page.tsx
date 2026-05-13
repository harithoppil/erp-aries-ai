import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getHRDashboardData,
  type HRDashboardData,
} from '@/app/dashboard/erp/hr/actions';
import HRDashboardClient from '@/app/dashboard/erp/hr/hr-dashboard-client';

export default async function HRDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const dashboardData = await getHRDashboardData();

  return (
    <HRDashboardClient
      dashboardData={dashboardData}
    />
  );
}
