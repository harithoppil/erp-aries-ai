import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getManufacturingDashboardData,
  getProductionTrends,
} from '@/app/dashboard/erp/manufacturing/actions';
import ManufacturingDashboardClient from '@/app/dashboard/erp/manufacturing/manufacturing-dashboard-client';

export default async function ManufacturingDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const [dashboardData, trendData] = await Promise.all([
    getManufacturingDashboardData(),
    getProductionTrends(),
  ]);

  return (
    <ManufacturingDashboardClient
      dashboardData={dashboardData}
      trendData={trendData}
    />
  );
}
