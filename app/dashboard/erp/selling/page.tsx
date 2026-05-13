import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getSellingDashboardData,
  getSalesOrderTrends,
  type SellingDashboardData,
  type SalesTrendPoint,
} from '@/app/dashboard/erp/selling/actions';
import SellingDashboardClient from '@/app/dashboard/erp/selling/selling-dashboard-client';

export default async function SellingDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const [dashboardData, trendData] = await Promise.all([
    getSellingDashboardData(),
    getSalesOrderTrends(),
  ]);

  return (
    <SellingDashboardClient
      dashboardData={dashboardData}
      trendData={trendData}
    />
  );
}
