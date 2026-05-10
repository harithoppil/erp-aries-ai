import { getInvoicingDashboardData, getAccountsReceivableAgeing, getAccountsPayableAgeing } from "@/app/dashboard/erp/accounts/actions";

export const dynamic = 'force-dynamic';
import InvoicingDashboardClient from "@/app/dashboard/erp/accounts/invoicing-dashboard-client";

export default async function InvoicingDashboardPage() {
  const [dashboardData, arAgeing, apAgeing] = await Promise.all([
    getInvoicingDashboardData(),
    getAccountsReceivableAgeing(),
    getAccountsPayableAgeing(),
  ]);

  return (
    <InvoicingDashboardClient
      dashboardData={dashboardData}
      arAgeing={arAgeing}
      apAgeing={apAgeing}
    />
  );
}
