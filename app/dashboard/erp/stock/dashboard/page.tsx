import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function StockDashboardPage() {
  try {
    const [items, warehouses, stockEntries, deliveryNotes] = await Promise.all([
      prisma.item.count(),
      prisma.warehouse.count(),
      prisma.stockEntry.count(),
      prisma.deliveryNote.count(),
    ]);

    const chartData = await getMonthlyData('stockEntry');

    const kpis = { items, warehouses, stockEntries, deliveryNotes };

    return <DashboardClient kpis={kpis} chartData={chartData} />;
  } catch (error) {
    return (
      <DashboardClient
        kpis={{ items: 0, warehouses: 0, stockEntries: 0, deliveryNotes: 0 }}
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
      const count = await (prisma as any)[accessor].count({
        where: { creation: { gte: start, lte: end } },
      });
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
