import { getProfitAndLoss, type PLData } from "../actions";
import ProfitAndLossClient from "./profit-and-loss-client";

export default async function ProfitAndLossPage() {
  const result = await getProfitAndLoss({ from_date: "2026-01-01", to_date: "2026-12-31" });
  return <ProfitAndLossClient initialData={result.success ? result.data : null} />;
}
