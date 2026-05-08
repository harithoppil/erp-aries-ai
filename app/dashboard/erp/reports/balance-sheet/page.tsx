import { getBalanceSheet, type BSData } from "@/app/dashboard/erp/reports/actions";
import BalanceSheetClient from "@/app/dashboard/erp/reports/balance-sheet/balance-sheet-client";

export default async function BalanceSheetPage() {
  const today = new Date().toISOString().split("T")[0];
  const result = await getBalanceSheet({ as_of_date: today });
  return <BalanceSheetClient initialData={result.success ? result.data : null} />;
}
