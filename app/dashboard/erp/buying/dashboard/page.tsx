import { prisma } from '@/lib/prisma';
import { getDelegateByAccessor } from '@/lib/erpnext/prisma-delegate';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function BuyingDashboardPage() {
  try {
    const [suppliers, purchaseOrders, purchaseInvoices, materialRequests] =
      await Promise.all([
        prisma.supplier.count(),
        prisma.purchaseOrder.count(),
        prisma.purchaseInvoice.count(),
        prisma.materialRequest.count(),
      ]);

    const chartData = await getMonthlyData('purchaseOrder');

    const kpis = {
      suppliers,
      purchaseOrders,
      purchaseInvoices,
      materialRequests,
    };

    return <DashboardClient kpis={kpis} chartData={chartData} />;
  } catch (error) {
    return (
      <DashboardClient
        kpis={{
          suppliers: 0,
          purchaseOrders: 0,
          purchaseInvoices: 0,
          materialRequests: 0,
        }}
        chartData={[]}
      />
    );
  }
}

async function getMonthlyData(
  accessor: string,
): Promise<{ month: string; count: number }[]> {
  const months: { month: string; count: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(
      now.getFullYear(),
      now.getMonth() - i + 1,
      0,
      23,
      59,
      59,
    );
    try {
      const delegate = getDelegateByAccessor(prisma, accessor);
      const count = delegate
        ? await delegate.count({ where: { creation: { gte: start, lte: end } } })
        : 0;
      months.push({
        month: start.toLocaleDateString('en', {
          month: 'short',
          year: '2-digit',
        }),
        count,
      });
    } catch {
      months.push({
        month: start.toLocaleDateString('en', {
          month: 'short',
          year: '2-digit',
        }),
        count: 0,
      });
    }
  }
  return months;
}
