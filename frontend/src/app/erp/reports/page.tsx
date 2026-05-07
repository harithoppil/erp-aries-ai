import { getReportsSummary, type ReportsSummary } from "./actions";
import ReportsClient from "./reports-client";

export default async function ReportsPage() {
  const result = await getReportsSummary();
  const data = result.success ? result.data : null;
  return <ReportsClient initialData={data} />;
}
