import { listNonConformances, type ClientSafeNC } from './actions';
import NonConformanceClient from './non-conformance-client';

export default async function NonConformancePage() {
  const result = await listNonConformances();
  const ncs = result.success ? result.ncs : [];
  return <NonConformanceClient initialNCs={ncs} />;
}
