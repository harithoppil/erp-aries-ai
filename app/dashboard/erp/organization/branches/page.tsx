import { listBranches, type ClientSafeBranch } from './actions';
import BranchesClient from './branches-client';

export default async function BranchesPage() {
  const result = await listBranches();
  const branches = result.success ? result.branches : [];
  return <BranchesClient initialBranches={branches} />;
}
