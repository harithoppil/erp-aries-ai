'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
  created_at: Date;
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
  from_time: Date;
  to_time: Date;
  hours: number;
  project: string;
  status: string;
};

export async function listProjects(): Promise<
  { success: true; projects: ClientSafeProject[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.projects.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      projects: rows.map((p) => ({
        id: p.id,
        project_name: p.project_name || p.project_code,
        project_code: p.project_code,
        status: p.status || 'Open',
        customer_name: p.customer_name || 'Internal',
        expected_start_date: p.expected_start,
        expected_end_date: p.expected_end,
        estimated_costing: p.estimated_cost || 0,
        total_sales_cost: 0,
        total_purchase_cost: 0,
        gross_margin: 0,
        notes: p.notes || null,
        created_at: p.created_at,
        project_type: p.project_type || null,
        project_location: p.project_location || null,
        day_rate: p.day_rate || null,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching projects:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch projects' };
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
    const record = await prisma.projects.create({
      data: {
        id: crypto.randomUUID(),
        project_code: `PRJ-${Date.now()}`,
        project_name: data.project_name,
        project_type: data.project_type || 'General',
        customer_name: data.customer_name || data.customer || 'Internal',
        project_location: data.project_location || null,
        vessel_name: data.vessel_name || null,
        expected_start: data.expected_start || data.expected_start_date || null,
        expected_end: data.expected_end || data.expected_end_date || null,
        estimated_cost: data.estimated_cost || data.estimated_costing || 0,
        day_rate: data.day_rate || null,
        notes: data.notes || null,
        status: 'PLANNING',
        currency: 'USD',
        actual_cost: 0,
      },
    });
    revalidatePath('/erp/projects');
    return {
      success: true as const,
      project: {
        id: record.id,
        project_name: record.project_name,
        project_code: record.project_code,
        status: 'TODO',
        customer_name: data.customer_name || data.customer || 'Internal',
        expected_start_date: data.expected_start || data.expected_start_date || null,
        expected_end_date: data.expected_end || data.expected_end_date || null,
        estimated_costing: data.estimated_cost || data.estimated_costing || 0,
        total_sales_cost: 0,
        total_purchase_cost: 0,
        gross_margin: 0,
        notes: data.notes || null,
        created_at: record.created_at,
        project_type: data.project_type || null,
        project_location: data.project_location || null,
        day_rate: data.day_rate || null,
      } as ClientSafeProject,
    };
  } catch (error: any) {
    console.error('Error creating project:', error?.message);
    return { success: false as const, error: error?.message || 'Failed to create project' };
  }
}

export async function listTasks(projectId?: string): Promise<
  { success: true; tasks: ClientSafeTask[] } | { success: false; error: string }
> {
  try {
    const where = projectId ? { project_id: projectId } : {};
    const rows = await prisma.tasks.findMany({
      where,
      orderBy: { id: 'desc' },
      take: 500,
    });
    return {
      success: true,
      tasks: rows.map((t) => ({
        id: t.id,
        subject: t.subject || t.id,
        status: t.status || 'Open',
        priority: 'Medium',
        project: t.project_id || '',
        exp_start_date: t.start_date,
        exp_end_date: t.end_date,
        progress: t.progress || 0,
        assigned_to: t.assigned_to || null,
        description: t.description || null,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching tasks:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch tasks' };
  }
}

export async function listTimesheets(_projectId?: string): Promise<
  { success: true; timesheets: ClientSafeTimesheet[] } | { success: false; error: string }
> {
  try {
    // Note: prisma.timesheets does not have project_id filter directly in this model shape
    const rows = await prisma.timesheets.findMany({
      orderBy: { date: 'desc' },
      take: 200,
    });

    return {
      success: true,
      timesheets: rows.map((ts) => ({
        id: ts.id,
        employee_name: 'Unknown',
        activity_type: ts.activity_type || 'General',
        from_time: ts.date,
        to_time: ts.date,
        hours: ts.hours || 0,
        project: _projectId || '',
        status: 'Draft',
      })),
    };
  } catch (error: any) {
    console.error('Error fetching timesheets:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch timesheets' };
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
    const record = await prisma.tasks.create({
      data: {
        id: crypto.randomUUID(),
        project_id: data.project_id || '00000000-0000-0000-0000-000000000000',
        subject: data.subject,
        description: data.description || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        status: 'TODO',
        progress: 0,
        assigned_to: data.assigned_to || null,
      },
    });
    revalidatePath('/erp/projects');
    return {
      success: true,
      task: {
        id: record.id,
        subject: record.subject || data.subject,
        status: 'ACTIVE',
        priority: 'Medium',
        project: data.project_id || '',
        project_id: data.project_id || '',
        exp_start_date: data.start_date || null,
        exp_end_date: data.end_date || null,
        progress: 0,
        assigned_to: data.assigned_to || null,
        description: data.description || null,
      },
    };
  } catch (error: any) {
    console.error('Error creating task:', error?.message);
    return { success: false, error: error?.message || 'Failed to create task' };
  }
}
