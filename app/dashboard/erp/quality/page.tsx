import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getQualityDashboardData,
  getQualityInspectionTrends,
  type QualityDashboardData,
  type QualityInspectionTrend,
} from '@/app/dashboard/erp/quality/actions';
import QualityDashboardClient from '@/app/dashboard/erp/quality/quality-dashboard-client';

export default async function QualityDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const [dashboardResult, trendResult] = await Promise.all([
    getQualityDashboardData(),
    getQualityInspectionTrends(),
  ]);

  const dashboardData: QualityDashboardData = dashboardResult.success
    ? dashboardResult.data
    : { inspectionCount: 0, goalCount: 0, procedureCount: 0, reviewCount: 0 };

  const trendData: QualityInspectionTrend[] = trendResult.success
    ? trendResult.data
    : [];

  return (
    <QualityDashboardClient
      dashboardData={dashboardData}
      trendData={trendData}
    />
  );
}
