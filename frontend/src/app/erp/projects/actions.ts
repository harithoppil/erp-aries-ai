'use server';

import { prisma } from '@/lib/prisma';
import { projectstatus, taskstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeProject = {
  id: string;
  project_name: string;
  project_code: string;
  project_type: string;
  status: string;
  customer_name: string;
  expected_start: Date | null;
  expected_end: Date | null;
  project_location: string | null;
  vessel_name: string | null;
  estimated_cost: number | null;
  day_rate: number | null;
  currency: string;
  notes: string | null;
  created_at: Date;
};

export type ClientSafeTask = {
  id: string;
  project_id: string;
  subject: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  start_date: Date | null;
  end_date: Date | null;
  progress: number;
};

export async function listProjects(): Promise<
  { success: true; projects: ClientSafeProject[] } | { success: false; error: string }
> {
  try {
    const projects = await prisma.projects.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, projects: projects.map((p) => ({ ...p, status: String(p.status) })) };
  } catch (error) {
    console.error('Error fetching projects:', error);
    return { success: false, error: 'Failed to fetch projects' };
  }
}

export async function listTasks(): Promise<
  { success: true; tasks: ClientSafeTask[] } | { success: false; error: string }
> {
  try {
    const tasks = await prisma.tasks.findMany({ orderBy: { start_date: 'desc' } });
    return { success: true, tasks: tasks.map((t) => ({ ...t, status: String(t.status) })) };
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return { success: false, error: 'Failed to fetch tasks' };
  }
}

export async function createProject(data: {
  project_name: string;
  project_type: string;
  customer_name: string;
  project_location?: string;
  vessel_name?: string;
  estimated_cost?: number;
  day_rate?: number;
  expected_start?: Date;
  expected_end?: Date;
  notes?: string;
}) {
  try {
    const projectCode = `PRJ-${Date.now().toString().slice(-6)}`;
    const project = await prisma.projects.create({
      data: {
        id: randomUUID(),
        project_code: projectCode,
        project_name: data.project_name,
        project_type: data.project_type,
        customer_name: data.customer_name,
        status: projectstatus.PLANNING,
        project_location: data.project_location || null,
        vessel_name: data.vessel_name || null,
        estimated_cost: data.estimated_cost || null,
        day_rate: data.day_rate || null,
        expected_start: data.expected_start || null,
        expected_end: data.expected_end || null,
        notes: data.notes || null,
        currency: 'AED',
        actual_cost: 0,
      }
    });
    revalidatePath('/erp/projects');
    return { success: true as const, project: { ...project, status: String(project.status) } as ClientSafeProject };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'Project code already exists' };
    return { success: false as const, error: 'Failed to create project' };
  }
}

export async function createTask(data: {
  project_id: string;
  subject: string;
  description?: string;
  assigned_to?: string;
  start_date?: Date;
  end_date?: Date;
}) {
  try {
    const task = await prisma.tasks.create({
      data: {
        id: randomUUID(),
        project_id: data.project_id,
        subject: data.subject,
        description: data.description || null,
        status: taskstatus.TODO,
        assigned_to: data.assigned_to || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        progress: 0,
      }
    });
    revalidatePath('/erp/projects');
    return { success: true as const, task: { ...task, status: String(task.status) } as ClientSafeTask };
  } catch (error) {
    return { success: false as const, error: 'Failed to create task' };
  }
}

export async function assignPersonnel(
  projectId: string,
  personnelId: string,
  role: string,
): Promise<
  { success: true; assigned: boolean; compliance_passed: boolean; issues: string[] } | { success: false; error: string }
> {
  try {
    // Validate project
    const project = await prisma.projects.findUnique({ where: { id: projectId } });
    if (!project) return { success: false, error: 'Project not found' };

    // Validate personnel
    const person = await prisma.personnel.findUnique({ where: { id: personnelId } });
    if (!person) return { success: false, error: 'Personnel not found' };

    // Compliance check — find expired certs
    const expiredCerts = await prisma.certifications.findMany({
      where: { personnel_id: personnelId, status: 'EXPIRED' },
    });
    const issues = expiredCerts.map(c => `${c.cert_type} expired on ${c.expiry_date?.toISOString().split('T')[0] || 'N/A'}`);
    const compliancePassed = issues.length === 0;

    await prisma.project_assignments.create({
      data: {
        id: randomUUID(),
        project_id: projectId,
        personnel_id: personnelId,
        role,
        compliance_checked: true,
        compliance_passed: compliancePassed,
        compliance_issues: issues.length > 0 ? issues.join('; ') : null,
      },
    });
    revalidatePath('/erp/projects');
    return { success: true, assigned: true, compliance_passed: compliancePassed, issues };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to assign personnel' };
  }
}

// ── Project Mutations ──────────────────────────────────────────────────────

export async function updateProjectStatus(id: string, status: projectstatus) {
  try {
    const record = await prisma.projects.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/projects');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[projects] updateProjectStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update project status' };
  }
}

export async function updateProject(
  id: string,
  data: Partial<{
    project_name: string;
    project_type: string;
    customer_name: string;
    project_location: string;
    vessel_name: string;
    estimated_cost: number;
    day_rate: number;
    expected_start: Date;
    expected_end: Date;
    notes: string;
  }>
) {
  try {
    const record = await prisma.projects.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/projects');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[projects] updateProject failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update project' };
  }
}

export async function deleteProject(id: string) {
  try {
    await prisma.projects.update({
      where: { id },
      data: { status: projectstatus.CANCELLED },
    });
    revalidatePath('/erp/projects');
    return { success: true };
  } catch (error: any) {
    console.error('[projects] deleteProject failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete project' };
  }
}

// ── Task Mutations ─────────────────────────────────────────────────────────

export async function updateTaskStatus(id: string, status: taskstatus) {
  try {
    const record = await prisma.tasks.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/projects');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[projects] updateTaskStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update task status' };
  }
}

export async function updateTask(
  id: string,
  data: Partial<{ subject: string; description: string; assigned_to: string; start_date: Date; end_date: Date; progress: number }>
) {
  try {
    const record = await prisma.tasks.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/projects');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[projects] updateTask failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update task' };
  }
}

export async function deleteTask(id: string) {
  try {
    await prisma.tasks.delete({ where: { id } });
    revalidatePath('/erp/projects');
    return { success: true };
  } catch (error: any) {
    console.error('[projects] deleteTask failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete task' };
  }
}

// ── Project Assignment Mutations ───────────────────────────────────────────

export async function unassignPersonnel(projectId: string, personnelId: string) {
  try {
    await prisma.project_assignments.deleteMany({
      where: { project_id: projectId, personnel_id: personnelId },
    });
    revalidatePath('/erp/projects');
    return { success: true };
  } catch (error: any) {
    console.error('[projects] unassignPersonnel failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to unassign personnel' };
  }
}
