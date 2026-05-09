'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeTask {
  name: string;
  subject: string;
  status: string;
  priority: string | null;
  project: string | null;
  exp_start_date: Date | null;
  exp_end_date: Date | null;
  progress: number | null;
  is_milestone: boolean;
  assigned_to: string | null;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeTaskDetail extends ClientSafeTask {
  type: string | null;
  is_group: boolean;
  description: string | null;
  actual_time: number | null;
  act_start_date: Date | null;
  act_end_date: Date | null;
  department: string | null;
  company: string | null;
}

export interface CreateTaskInput {
  subject: string;
  project?: string;
  priority?: string;
  status?: string;
  exp_start_date?: string;
  exp_end_date?: string;
  type?: string;
  description?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listTasks(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; tasks: ClientSafeTask[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Project", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { subject: { contains: search, mode: 'insensitive' as const } },
            { project: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      success: true,
      total,
      tasks: tasks.map((t) => ({
        name: t.name,
        subject: t.subject,
        status: t.status || 'Open',
        priority: t.priority,
        project: t.project,
        exp_start_date: t.exp_start_date,
        exp_end_date: t.exp_end_date,
        progress: t.progress ? Number(t.progress) : null,
        is_milestone: t.is_milestone || false,
        assigned_to: t.completed_by,
        docstatus: t.docstatus || 0,
        creation: t.creation,
      })),
    };
  } catch (error: any) {
    console.error('[tasks] listTasks failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch tasks' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getTask(
  id: string
): Promise<{ success: true; task: ClientSafeTaskDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Project", "read");
    const t = await prisma.task.findUnique({ where: { name: id } });
    if (!t) return { success: false, error: 'Task not found' };

    return {
      success: true,
      task: {
        name: t.name,
        subject: t.subject,
        status: t.status || 'Open',
        priority: t.priority,
        project: t.project,
        exp_start_date: t.exp_start_date,
        exp_end_date: t.exp_end_date,
        progress: t.progress ? Number(t.progress) : null,
        is_milestone: t.is_milestone || false,
        assigned_to: t.completed_by,
        docstatus: t.docstatus || 0,
        creation: t.creation,
        type: t.type,
        is_group: t.is_group || false,
        description: t.description,
        actual_time: t.actual_time ? Number(t.actual_time) : null,
        act_start_date: t.act_start_date,
        act_end_date: t.act_end_date,
        department: t.department,
        company: t.company,
      },
    };
  } catch (error: any) {
    console.error('[tasks] getTask failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch task' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createTask(
  data: CreateTaskInput
): Promise<{ success: true; task: ClientSafeTask } | { success: false; error: string }> {
  try {
    await requirePermission("Project", "create");
    if (!data.subject) return { success: false, error: 'Subject is required' };

    const name = `TASK-${Date.now()}`;
    const t = await prisma.task.create({
      data: {
        name,
        subject: data.subject,
        project: data.project || null,
        priority: data.priority || 'Medium',
        status: data.status || 'Open',
        exp_start_date: data.exp_start_date ? new Date(data.exp_start_date) : null,
        exp_end_date: data.exp_end_date ? new Date(data.exp_end_date) : null,
        type: data.type || null,
        description: data.description || null,
        docstatus: 0,
        company: 'Aries',
      },
    });

    revalidatePath('/dashboard/erp/projects/tasks');
    return {
      success: true,
      task: {
        name: t.name,
        subject: t.subject,
        status: t.status || 'Open',
        priority: t.priority,
        project: t.project,
        exp_start_date: t.exp_start_date,
        exp_end_date: t.exp_end_date,
        progress: t.progress ? Number(t.progress) : null,
        is_milestone: t.is_milestone || false,
        assigned_to: t.completed_by,
        docstatus: t.docstatus || 0,
        creation: t.creation,
      },
    };
  } catch (error: any) {
    console.error('[tasks] createTask failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create task' };
  }
}

// ── Update ──────────────────────────────────────────────────────────────────────

export async function updateTask(
  id: string,
  data: Partial<CreateTaskInput & { status?: string; progress?: number }>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Project", "update");
    const existing = await prisma.task.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Task not found' };

    await prisma.task.update({
      where: { name: id },
      data: {
        ...(data.subject && { subject: data.subject }),
        ...(data.status && { status: data.status }),
        ...(data.priority && { priority: data.priority }),
        ...(data.project !== undefined && { project: data.project || null }),
        ...(data.progress !== undefined && { progress: data.progress }),
        ...(data.exp_start_date && { exp_start_date: new Date(data.exp_start_date) }),
        ...(data.exp_end_date && { exp_end_date: new Date(data.exp_end_date) }),
        ...(data.type !== undefined && { type: data.type || null }),
        ...(data.description !== undefined && { description: data.description || null }),
      },
    });

    revalidatePath('/dashboard/erp/projects/tasks');
    return { success: true };
  } catch (error: any) {
    console.error('[tasks] updateTask failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update task' };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteTask(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Project", "delete");
    const existing = await prisma.task.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Task not found' };
    if (existing.docstatus !== 0) return { success: false, error: 'Only draft tasks can be deleted' };

    await prisma.task.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/projects/tasks');
    return { success: true };
  } catch (error: any) {
    console.error('[tasks] deleteTask failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete task' };
  }
}
