import { prisma } from '@/lib/prisma';
import { getDelegateByAccessor } from '@/lib/erpnext/prisma-delegate';
import DashboardClient from '@/app/dashboard/erp/projects/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function ProjectsDashboardPage() {
  try {
    const [projects, tasks, timesheets, activityTypes] = await Promise.all([
      prisma.project.count(),
      prisma.task.count(),
      prisma.timesheet.count(),
      prisma.activityType.count(),
    ]);

    const chartData = await getMonthlyData('project');

    const kpis = { projects, tasks, timesheets, activityTypes };

    return <DashboardClient kpis={kpis} chartData={chartData} />;
  } catch (error) {
    return (
      <DashboardClient
        kpis={{ projects: 0, tasks: 0, timesheets: 0, activityTypes: 0 }}
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
