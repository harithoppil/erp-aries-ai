import { listRFQs, type ClientSafeRFQ } from '@/app/dashboard/erp/buying/rfq/actions';
import RfqClient from './rfq-client';

export default async function RFQPage() {
  const result = await listRFQs();
  const rfqs = result.success ? result.rfqs : [];
  return <RfqClient initialRfqs={JSON.parse(JSON.stringify(rfqs))} />;
}
