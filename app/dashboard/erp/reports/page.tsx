import { getReportsSummary, type ReportsSummary } from "@/app/dashboard/erp/reports/actions";
import ReportsClient from "@/app/dashboard/erp/reports/reports-client";

export default async function ReportsPage() {
  const result = await getReportsSummary();
  const data = result.success ? result.data : null;
  return <ReportsClient initialData={data} />;
}
