import { listCostCenters, type ClientSafeCostCenter } from './actions';

export const dynamic = 'force-dynamic';
import CostCentersClient from './cost-centers-client';

export default async function CostCentersPage() {
  const result = await listCostCenters();
  const costCenters = result.success ? result.costCenters : [];
  return <CostCentersClient initialRecords={JSON.parse(JSON.stringify(costCenters))} />;
}
