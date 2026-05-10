import { listLeads, type ClientSafeLead } from '@/app/dashboard/erp/crm/leads/actions';

export const dynamic = 'force-dynamic';
import LeadsClient from './leads-client';

export default async function LeadsPage() {
  const result = await listLeads();
  const leads = result.success ? result.leads : [];
  return <LeadsClient initialLeads={JSON.parse(JSON.stringify(leads))} />;
}
