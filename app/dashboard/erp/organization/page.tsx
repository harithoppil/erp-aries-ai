import { getSession } from '@/lib/frappe-auth';
import { redirect } from 'next/navigation';
import {
  getOrganizationDashboardData,
  type OrganizationDashboardData,
} from './actions';
import OrganizationDashboardClient from './organization-dashboard-client';

export default async function OrganizationDashboardPage() {
  const session = await getSession();
  if (!session) return redirect('/auth');

  const result = await getOrganizationDashboardData();

  const data: OrganizationDashboardData = result.success
    ? result.data
    : { companyCount: 0, companies: [] };

  return <OrganizationDashboardClient data={data} />;
}
