'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProjectsDashboardData {
  openProjects: number;
  nonCompletedTasks: number;
  workingHours: number;
}

export interface ProjectTrendPoint {
  month: string;
  completedCount: number;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getProjectsDashboardData(): Promise<ProjectsDashboardData> {
  try {
    const openProjects = await prisma.project.count({
      where: { status: { in: ['Open', 'In Progress', 'Planning'] } },
    }).catch(() => 0);

    // Tasks and timesheets may not be available yet
    return {
      openProjects,
      nonCompletedTasks: 0,
      workingHours: 0,
    };
  } catch {
    return { openProjects: 0, nonCompletedTasks: 0, workingHours: 0 };
  }
}

// ── Trends ──────────────────────────────────────────────────────────────────

export async function getProjectTrends(): Promise<ProjectTrendPoint[]> {
  // Stub trend data — replace with real time-series query
  return [];
}
