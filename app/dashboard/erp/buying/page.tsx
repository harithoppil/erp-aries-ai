import { getBuyingDashboardData } from "@/app/dashboard/erp/buying/actions";

export const dynamic = 'force-dynamic';
import BuyingDashboardClient from "@/app/dashboard/erp/buying/buying-dashboard-client";

export default async function BuyingPage() {
  const data = await getBuyingDashboardData();
  return <BuyingDashboardClient data={data} />;
}
