import { listContracts, type ClientSafeContract } from './actions';
import ContractsClient from './contracts-client';

export default async function ContractsPage() {
  const result = await listContracts();
  const contracts = result.success ? result.contracts : [];
  return <ContractsClient initialRecords={JSON.parse(JSON.stringify(contracts))} />;
}
