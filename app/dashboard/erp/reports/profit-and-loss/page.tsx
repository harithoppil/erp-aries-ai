import { getProfitAndLoss, type PLData } from "@/app/dashboard/erp/reports/actions";
import ProfitAndLossClient from "@/app/dashboard/erp/reports/profit-and-loss/profit-and-loss-client";

export default async function ProfitAndLossPage() {
  const result = await getProfitAndLoss({ from_date: `${new Date().getFullYear()}-01-01`, to_date: `${new Date().getFullYear()}-12-31` });
  return <ProfitAndLossClient initialData={result.success ? result.data : null} />;
}
