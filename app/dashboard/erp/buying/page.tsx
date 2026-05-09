import { getBuyingDashboardData } from "@/app/dashboard/erp/buying/actions";
import BuyingDashboardClient from "@/app/dashboard/erp/buying/buying-dashboard-client";

export default async function BuyingPage() {
  const data = await getBuyingDashboardData();
  return <BuyingDashboardClient data={data} />;
}
