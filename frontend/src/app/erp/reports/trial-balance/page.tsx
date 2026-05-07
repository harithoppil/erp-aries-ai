import { getTrialBalance, type TBAccount } from "../actions";
import TrialBalanceClient from "./trial-balance-client";

export default async function TrialBalancePage() {
  const result = await getTrialBalance({ from_date: "2026-01-01", to_date: "2026-12-31" });
  return <TrialBalanceClient initialAccounts={result.success ? result.accounts : []} />;
}
