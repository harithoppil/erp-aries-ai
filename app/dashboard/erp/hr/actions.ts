'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface DepartmentHeadcount {
  department: string;
  count: number;
}

export interface HRDashboardData {
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  headcountByDepartment: DepartmentHeadcount[];
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getHRDashboardData(): Promise<HRDashboardData> {
  try {
    const [totalEmployees, activeEmployees, deptResult] = await Promise.all([
      prisma.employee.count(),
      prisma.employee.count({ where: { status: 'Active' } }),
      prisma.employee.groupBy({
        by: ['department'],
        _count: { department: true },
        where: { status: 'Active', department: { not: null } },
      }),
    ]);

    const headcountByDepartment: DepartmentHeadcount[] = deptResult.map((d) => ({
      department: d.department ?? 'Unassigned',
      count: d._count.department,
    }));

    const departmentCount = new Set(headcountByDepartment.map((d) => d.department)).size;

    return {
      totalEmployees,
      activeEmployees,
      departmentCount,
      headcountByDepartment,
    };
  } catch {
    return { totalEmployees: 0, activeEmployees: 0, departmentCount: 0, headcountByDepartment: [] };
  }
}
