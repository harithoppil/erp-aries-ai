import { getSession } from '@/lib/frappe-auth';
import { redirect } from 'next/navigation';
import {
  getProjectsDashboardData,
  getProjectTrends,
} from './actions';
import ProjectsDashboardClient from './projects-dashboard-client';

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
