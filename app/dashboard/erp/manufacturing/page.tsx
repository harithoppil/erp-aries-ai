import { getSession } from '@/lib/frappe-auth';
import { redirect } from 'next/navigation';
import {
  getManufacturingDashboardData,
  getProductionTrends,
} from './actions';
import ManufacturingDashboardClient from './manufacturing-dashboard-client';

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
