import { getAccountTree, type AccountTreeNode } from "../accounts/actions";
import ChartOfAccountsClient from "./chart-of-accounts-client";

export default async function ChartOfAccountsPage() {
  const result = await getAccountTree();
  const accounts = result.success ? result.accounts : [];
  const roots = new Set<string>();
  accounts.forEach((a) => { if (a.level === 0) roots.add(a.id); });

  return <ChartOfAccountsClient initialAccounts={accounts} initialExpanded={roots} />;
}
