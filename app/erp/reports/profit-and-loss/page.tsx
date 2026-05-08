import { getProfitAndLoss, type PLData } from "../actions";
import ProfitAndLossClient from "./profit-and-loss-client";

export default async function ProfitAndLossPage() {
  const result = await getProfitAndLoss({ from_date: `${new Date().getFullYear()}-01-01`, to_date: `${new Date().getFullYear()}-12-31` });
  return <ProfitAndLossClient initialData={result.success ? result.data : null} />;
}
