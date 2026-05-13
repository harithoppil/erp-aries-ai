import { getSession } from '@/lib/frappe-auth';

export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import {
  getProjectsDashboardData,
  getProjectTrends,
} from '@/app/dashboard/erp/projects/actions';
import ProjectsDashboardClient from '@/app/dashboard/erp/projects/projects-dashboard-client';

export default async function ProjectsDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const [dashboardData, trendData] = await Promise.all([
    getProjectsDashboardData(),
    getProjectTrends(),
  ]);

  return (
    <ProjectsDashboardClient
      dashboardData={dashboardData}
      trendData={trendData}
    />
  );
}
