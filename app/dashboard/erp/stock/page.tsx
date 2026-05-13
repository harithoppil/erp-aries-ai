import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
import { getSession } from '@/lib/frappe-auth';
import { getStockDashboardData, type StockDashboardData } from '@/app/dashboard/erp/stock/actions';
import StockDashboardClient from '@/app/dashboard/erp/stock/stock-dashboard-client';

export default async function StockDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const result = await getStockDashboardData();
  const data: StockDashboardData = result.success
    ? result.data
    : {
        totalStockValue: 0,
        warehouseCount: 0,
        itemCount: 0,
        stockByItemGroup: [],
      };

  return (
    <StockDashboardClient
      totalStockValue={data.totalStockValue}
      warehouseCount={data.warehouseCount}
      itemCount={data.itemCount}
      stockByItemGroup={data.stockByItemGroup}
    />
  );
}
