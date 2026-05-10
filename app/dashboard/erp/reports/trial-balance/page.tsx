import { getTrialBalance, type TBAccount } from "@/app/dashboard/erp/reports/actions";

export const dynamic = 'force-dynamic';
import TrialBalanceClient from "@/app/dashboard/erp/reports/trial-balance/trial-balance-client";

export default async function TrialBalancePage() {
  const result = await getTrialBalance({ from_date: `${new Date().getFullYear()}-01-01`, to_date: `${new Date().getFullYear()}-12-31` });
  return <TrialBalanceClient initialAccounts={result.success ? result.accounts : []} />;
}
