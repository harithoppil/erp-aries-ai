'use server';

import { revalidatePath } from 'next/cache';
import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeCallMethod } from '@/lib/frappe-client';

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
    const projects = await frappeGetList<any>('Project', {
      fields: ['name', 'project_name', 'status', 'customer', 'expected_start_date', 'expected_end_date', 'estimated_costing', 'total_sales_cost', 'total_purchase_cost', 'gross_margin', 'notes', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      projects: projects.map((p: any) => ({
        id: p.name,
        project_name: p.project_name || p.name,
        project_code: p.name,
        status: p.status || 'Open',
        customer_name: p.customer || 'Internal',
        expected_start_date: p.expected_start_date ? new Date(p.expected_start_date) : null,
        expected_end_date: p.expected_end_date ? new Date(p.expected_end_date) : null,
        estimated_costing: p.estimated_costing || 0,
        total_sales_cost: p.total_sales_cost || 0,
        total_purchase_cost: p.total_purchase_cost || 0,
        gross_margin: p.gross_margin || 0,
        notes: p.notes || null,
        created_at: p.creation ? new Date(p.creation) : new Date(),
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
    const project = await frappeInsertDoc<any>('Project', {
      project_name: data.project_name,
      project_type: data.project_type || undefined,
      customer: data.customer_name || data.customer || undefined,
      project_location: data.project_location || undefined,
      vessel_name: data.vessel_name || undefined,
      expected_start_date: (data.expected_start || data.expected_start_date) ? (data.expected_start || data.expected_start_date)!.toISOString().slice(0, 10) : undefined,
      expected_end_date: (data.expected_end || data.expected_end_date) ? (data.expected_end || data.expected_end_date)!.toISOString().slice(0, 10) : undefined,
      estimated_costing: data.estimated_cost || data.estimated_costing || 0,
      day_rate: data.day_rate || undefined,
      notes: data.notes || undefined,
    });
    revalidatePath('/erp/projects');
    return {
      success: true as const,
      project: {
        id: project.name,
        project_name: project.project_name,
        project_code: project.name,
        status: 'Open',
        customer_name: data.customer_name || data.customer || 'Internal',
        expected_start_date: (data.expected_start || data.expected_start_date) || null,
        expected_end_date: (data.expected_end || data.expected_end_date) || null,
        estimated_costing: data.estimated_cost || data.estimated_costing || 0,
        total_sales_cost: 0,
        total_purchase_cost: 0,
        gross_margin: 0,
        notes: data.notes || null,
        created_at: new Date(),
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
    const filters: Record<string, unknown> = {};
    if (projectId) filters.project = projectId;
    const tasks = await frappeGetList<any>('Task', {
      fields: ['name', 'subject', 'status', 'priority', 'project', 'exp_start_date', 'exp_end_date', 'progress'],
      filters,
      order_by: 'creation desc',
      limit_page_length: 500,
    });
    return {
      success: true,
      tasks: tasks.map((t: any) => ({
        id: t.name,
        subject: t.subject || t.name,
        status: t.status || 'Open',
        priority: t.priority || 'Medium',
        project: t.project || '',
        exp_start_date: t.exp_start_date ? new Date(t.exp_start_date) : null,
        exp_end_date: t.exp_end_date ? new Date(t.exp_end_date) : null,
        progress: t.progress || 0,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching tasks:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch tasks' };
  }
}

export async function listTimesheets(projectId?: string): Promise<
  { success: true; timesheets: ClientSafeTimesheet[] } | { success: false; error: string }
> {
  try {
    const filters: Record<string, unknown> = {};
    if (projectId) filters.project = projectId;
    const timesheets = await frappeGetList<any>('Timesheet', {
      fields: ['name', 'employee_name', 'status', 'creation'],
      filters,
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    // Timesheet details are in child table; fetch summary only
    return {
      success: true,
      timesheets: timesheets.map((ts: any) => ({
        id: ts.name,
        employee_name: ts.employee_name || 'Unknown',
        activity_type: 'General',
        from_time: ts.creation ? new Date(ts.creation) : new Date(),
        to_time: ts.creation ? new Date(ts.creation) : new Date(),
        hours: 0,
        project: projectId || '',
        status: ts.status || 'Draft',
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
    const task = await frappeInsertDoc<any>('Task', {
      subject: data.subject,
      project: data.project_id || undefined,
      description: data.description || undefined,
      exp_start_date: data.start_date ? data.start_date.toISOString().slice(0, 10) : undefined,
      exp_end_date: data.end_date ? data.end_date.toISOString().slice(0, 10) : undefined,
    });
    revalidatePath('/erp/projects');
    return {
      success: true,
      task: {
        id: task.name,
        subject: task.subject || data.subject,
        status: 'Open',
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
