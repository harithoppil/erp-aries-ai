import { listOpportunities, type ClientSafeOpportunity } from '@/app/dashboard/erp/crm/opportunities/actions';

export const dynamic = 'force-dynamic';
import OpportunitiesClient from './opportunities-client';

export default async function OpportunitiesPage() {
  const result = await listOpportunities();
  const opportunities = result.success ? result.opportunities : [];
  return <OpportunitiesClient initialOpportunities={JSON.parse(JSON.stringify(opportunities))} />;
}
