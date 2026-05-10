import { prisma } from '@/lib/prisma';
import { getDelegateByAccessor } from '@/lib/erpnext/prisma-delegate';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function AssetsDashboardPage() {
  try {
    const [assets, assetCategories, assetDepreciationSchedules, assetMaintenances] =
      await Promise.all([
        prisma.asset.count(),
        prisma.assetCategory.count(),
        prisma.assetDepreciationSchedule.count(),
        prisma.assetMaintenance.count(),
      ]);

    const chartData = await getMonthlyData('asset');

    const kpis = {
      assets,
      assetCategories,
      assetDepreciationSchedules,
      assetMaintenances,
    };

    return <DashboardClient kpis={kpis} chartData={chartData} />;
  } catch (error) {
    return (
      <DashboardClient
        kpis={{
          assets: 0,
          assetCategories: 0,
          assetDepreciationSchedules: 0,
          assetMaintenances: 0,
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
