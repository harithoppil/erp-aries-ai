import { getTrialBalance, type TBAccount } from "@/app/erp/reports/actions";
import TrialBalanceClient from "@/app/erp/reports/trial-balance/trial-balance-client";

export default async function TrialBalancePage() {
  const result = await getTrialBalance({ from_date: `${new Date().getFullYear()}-01-01`, to_date: `${new Date().getFullYear()}-12-31` });
  return <TrialBalanceClient initialAccounts={result.success ? result.accounts : []} />;
}
