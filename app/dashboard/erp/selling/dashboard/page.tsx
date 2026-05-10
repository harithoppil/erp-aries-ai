import { prisma } from '@/lib/prisma';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function SellingDashboardPage() {
  try {
    const [customers, quotations, salesOrders, salesInvoices] = await Promise.all([
      prisma.customer.count(),
      prisma.quotation.count(),
      prisma.salesOrder.count(),
      prisma.salesInvoice.count(),
    ]);

    const chartData = await getMonthlyData('quotation');

    const kpis = { customers, quotations, salesOrders, salesInvoices };

    return <DashboardClient kpis={kpis} chartData={chartData} />;
  } catch (error) {
    return (
      <DashboardClient
        kpis={{ customers: 0, quotations: 0, salesOrders: 0, salesInvoices: 0 }}
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
