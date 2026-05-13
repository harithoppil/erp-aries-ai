import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getCRMDashboardData,
  getLeadConversionTrends,
  type CRMDashboardData,
  type LeadConversionTrendPoint,
} from '@/app/dashboard/erp/crm/actions';
import CRMDashboardClient from '@/app/dashboard/erp/crm/crm-dashboard-client';

export default async function CRMDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const [dashboardData, trendData] = await Promise.all([
    getCRMDashboardData(),
    getLeadConversionTrends(),
  ]);

  return (
    <CRMDashboardClient
      dashboardData={dashboardData}
      trendData={trendData}
    />
  );
}
