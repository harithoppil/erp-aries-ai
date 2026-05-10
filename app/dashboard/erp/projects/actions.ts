'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Dashboard Types ─────────────────────────────────────────────────────────

export type ProjectsDashboardData = {
  openProjects: number;
  nonCompletedTasks: number;
  workingHours: number;
};

export type ProjectTrendPoint = {
  month: string;
  completedCount: number;
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

export async function getProjectsDashboardData(): Promise<ProjectsDashboardData> {
  await requirePermission('Project', 'read');

  const [openProjects, nonCompletedTasks, timesheets] = await Promise.all([
    prisma.project.count({
      where: {
        status: { in: ['Open', 'In Progress', 'Planning'] },
        docstatus: { lte: 1 },
      },
    }),
    prisma.task.count({
      where: {
        status: { notIn: ['Completed', 'Cancelled'] },
        docstatus: { lte: 1 },
      },
    }),
    prisma.timesheet.findMany({
      where: { docstatus: 1 },
      select: { total_hours: true },
    }),
  ]);

  const workingHours = timesheets.reduce(
    (sum, ts) => sum + Number(ts.total_hours || 0),
    0,
  );

  return {
    openProjects,
    nonCompletedTasks,
    workingHours,
  };
}

// ── Project Trends (last 12 months) ────────────────────────────────────────

export async function getProjectTrends(): Promise<ProjectTrendPoint[]> {
  await requirePermission('Project', 'read');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const completedProjects = await prisma.project.findMany({
    where: {
      status: 'Completed',
      creation: { gte: twelveMonthsAgo },
    },
    select: {
      creation: true,
    },
    orderBy: { creation: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, number>();

  // Initialize last 12 months with zeros
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, 0);
  }

  for (const project of completedProjects) {
    const date = project.creation ? new Date(project.creation) : null;
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
  }

  return Array.from(monthMap.entries()).map(([key, completedCount]) => {
    const [year, month] = key.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    return {
      month: label,
      completedCount,
    };
  });
}

// ── List Types ─────────────────────────────────────────────────────────────

export type ClientSafeProject = {
  id: string;
  project_name: string;
  project_code: string;
  status: string;
  customer_name: string;
  expected_start_date: Date | null;
  expected_end_date: Date | null;
  estimated_costing: number;
  total_sales_cost: number;
  total_purchase_cost: number;
  gross_margin: number;
  notes: string | null;
  created_at: Date | null;
  project_type?: string | null;
  project_location?: string | null;
  day_rate?: number | null;
};

export type ClientSafeTask = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  project: string;
  project_id?: string;
  exp_start_date: Date | null;
  exp_end_date: Date | null;
  progress: number;
  assigned_to?: string | null;
  description?: string | null;
};

export type ClientSafeTimesheet = {
  id: string;
  employee_name: string;
  activity_type: string;
  from_time: Date | null;
  to_time: Date | null;
  hours: number;
  project: string;
  status: string;
};

// ── Projects CRUD ───────────────────────────────────────────────────────────

export async function listProjects(): Promise<
  { success: true; projects: ClientSafeProject[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Project", "read");
    const rows = await prisma.project.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      projects: rows.map((p) => ({
        id: p.name,
        project_name: p.project_name,
        project_code: p.name,
        status: p.status || 'Open',
        customer_name: p.customer || 'Internal',
        expected_start_date: p.expected_start_date || null,
        expected_end_date: p.expected_end_date || null,
        estimated_costing: Number(p.estimated_costing || 0),
        total_sales_cost: Number(p.total_sales_amount || 0),
        total_purchase_cost: Number(p.total_purchase_cost || 0),
        gross_margin: Number(p.gross_margin || 0),
        notes: p.notes || null,
        created_at: p.creation,
        project_type: p.project_type || null,
        project_location: null,
        day_rate: null,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching projects:', msg);
    return { success: false, error: msg || 'Failed to fetch projects' };
  }
}

export async function createProject(data: {
  project_name: string;
  project_type?: string;
  customer?: string;
  customer_name?: string;
  project_location?: string;
  vessel_name?: string;
  expected_start_date?: Date;
  expected_end_date?: Date;
  expected_start?: Date;
  expected_end?: Date;
  estimated_costing?: number;
  estimated_cost?: number;
  day_rate?: number;
  notes?: string;
}) {
  try {
    await requirePermission("Project", "create");
    const name = `PRJ-${Date.now()}`;
    const record = await prisma.project.create({
      data: {
        name,
        project_name: data.project_name,
        project_type: data.project_type || 'General',
        customer: data.customer_name || data.customer || 'Internal',
        expected_start_date: data.expected_start || data.expected_start_date || null,
        expected_end_date: data.expected_end || data.expected_end_date || null,
        estimated_costing: data.estimated_cost || data.estimated_costing || 0,
        notes: data.notes || null,
        status: 'Open',
        company: 'Aries',
        naming_series: 'PRJ-',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    revalidatePath('/erp/projects');
    return {
      success: true as const,
      project: {
        id: record.name,
        project_name: record.project_name,
        project_code: record.name,
        status: 'Open',
        customer_name: data.customer_name || data.customer || 'Internal',
        expected_start_date: record.expected_start_date || null,
        expected_end_date: record.expected_end_date || null,
        estimated_costing: Number(record.estimated_costing || 0),
        total_sales_cost: 0,
        total_purchase_cost: 0,
        gross_margin: 0,
        notes: data.notes || null,
        created_at: record.creation,
        project_type: data.project_type || null,
        project_location: null,
        day_rate: null,
      } as ClientSafeProject,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating project:', msg);
    return { success: false as const, error: msg || 'Failed to create project' };
  }
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export async function listTasks(projectId?: string): Promise<
  { success: true; tasks: ClientSafeTask[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Project", "read");
    const where: Record<string, unknown> = {};
    if (projectId) {
      where.project = projectId;
    }
    const rows = await prisma.task.findMany({
      where,
      orderBy: { creation: 'desc' },
      take: 500,
    });
    return {
      success: true,
      tasks: rows.map((t) => ({
        id: t.name,
        subject: t.subject || t.name,
        status: t.status || 'Open',
        priority: t.priority || 'Medium',
        project: t.project || '',
        project_id: t.project || '',
        exp_start_date: t.exp_start_date || null,
        exp_end_date: t.exp_end_date || null,
        progress: t.progress || 0,
        assigned_to: null,
        description: t.description || null,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching tasks:', msg);
    return { success: false, error: msg || 'Failed to fetch tasks' };
  }
}

export async function listTimesheets(_projectId?: string): Promise<
  { success: true; timesheets: ClientSafeTimesheet[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Project", "read");
    const where: Record<string, unknown> = {};
    if (_projectId) {
      where.parent_project = _projectId;
    }
    const rows = await prisma.timesheet.findMany({
      where,
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      timesheets: rows.map((ts) => ({
        id: ts.name,
        employee_name: ts.employee_name || 'Unknown',
        activity_type: 'General',
        from_time: ts.start_date,
        to_time: ts.end_date,
        hours: ts.total_hours || 0,
        project: ts.parent_project || '',
        status: ts.status || 'Draft',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching timesheets:', msg);
    return { success: false, error: msg || 'Failed to fetch timesheets' };
  }
}

export async function createTask(data: {
  project_id?: string;
  subject: string;
  description?: string;
  assigned_to?: string;
  start_date?: Date;
  end_date?: Date;
}): Promise<{ success: true; task: ClientSafeTask } | { success: false; error: string }> {
  try {
    await requirePermission("Project", "create");
    const name = `TASK-${Date.now()}`;
    const record = await prisma.task.create({
      data: {
        name,
        subject: data.subject,
        project: data.project_id || null,
        description: data.description || null,
        exp_start_date: data.start_date || null,
        exp_end_date: data.end_date || null,
        status: 'Open',
        priority: 'Medium',
        progress: 0,
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    revalidatePath('/erp/projects');
    return {
      success: true,
      task: {
        id: record.name,
        subject: record.subject || data.subject,
        status: 'Open',
        priority: 'Medium',
        project: data.project_id || '',
        project_id: data.project_id || '',
        exp_start_date: data.start_date || null,
        exp_end_date: data.end_date || null,
        progress: 0,
        assigned_to: null,
        description: data.description || null,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating task:', msg);
    return { success: false, error: msg || 'Failed to create task' };
  }
}
