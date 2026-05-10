import { listContracts, type ClientSafeContract } from './actions';

export const dynamic = 'force-dynamic';
import ContractsClient from './contracts-client';

export default async function ContractsPage() {
  const result = await listContracts();
  const contracts = result.success ? result.contracts : [];
  return <ContractsClient initialRecords={JSON.parse(JSON.stringify(contracts))} />;
}
