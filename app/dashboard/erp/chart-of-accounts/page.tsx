import { getAccountTree, type AccountTreeNode } from "@/app/dashboard/erp/accounts/actions";

export const dynamic = 'force-dynamic';
import ChartOfAccountsClient from "@/app/dashboard/erp/chart-of-accounts/chart-of-accounts-client";

export default async function ChartOfAccountsPage() {
  const result = await getAccountTree();
  const accounts = result.success ? result.accounts : [];
  const roots = new Set<string>();
  accounts.forEach((a) => { if (a.level === 0) roots.add(a.id); });

  return <ChartOfAccountsClient />;
}
