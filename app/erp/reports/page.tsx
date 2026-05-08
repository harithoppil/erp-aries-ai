import { getReportsSummary, type ReportsSummary } from "@/app/erp/reports/actions";
import ReportsClient from "@/app/erp/reports/reports-client";

export default async function ReportsPage() {
  const result = await getReportsSummary();
  const data = result.success ? result.data : null;
  return <ReportsClient initialData={data} />;
}
