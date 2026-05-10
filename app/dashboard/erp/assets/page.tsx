import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getAssetsDashboardData,
  getAssetTrends,
  type AssetsDashboardData,
  type AssetTrendPoint,
} from './actions';
import AssetsDashboardClient from './assets-dashboard-client';

export default async function AssetsDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const [dashboardData, trendData] = await Promise.all([
    getAssetsDashboardData(),
    getAssetTrends(),
  ]);

  return (
    <AssetsDashboardClient
      dashboardData={dashboardData}
      trendData={trendData}
    />
  );
}
