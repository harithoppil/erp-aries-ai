'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeTimesheet = {
  id: string;
  employee_name: string;
  activity_type: string;
  from_time: Date | null;
  to_time: Date | null;
  hours: number;
  project: string;
  status: string;
  created_at: Date | null;
  date?: string;
  description?: string;
  billable?: boolean;
};

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listTimesheets(): Promise<
  { success: true; timesheets: ClientSafeTimesheet[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Employee", "read");
    const rows = await prisma.timesheet.findMany({
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
        created_at: ts.creation,
        date: ts.start_date ? ts.start_date.toISOString().slice(0, 10) : undefined,
        description: ts.note || undefined,
        billable: (ts.total_billable_hours ?? 0) > 0,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[timesheets] list failed:', msg);
    return { success: false, error: msg || 'Failed to load timesheets' };
  }
}

export async function createTimesheet(data: {
  employee_name?: string;
  activity_type?: string;
  hours?: number;
  project?: string;
  project_id?: string;
  personnel_id?: string;
  date?: string;
  description?: string;
  billable?: boolean;
}): Promise<{ success: true; timesheet: ClientSafeTimesheet } | { success: false; error: string }> {
  try {
    await requirePermission("Employee", "create");
    const name = `TS-${Date.now()}`;
    const startDate = data.date ? new Date(data.date) : new Date();
    const record = await prisma.timesheet.create({
      data: {
        name,
        employee: data.personnel_id || null,
        employee_name: data.employee_name || 'Unknown',
        start_date: startDate,
        total_hours: data.hours || 0,
        total_billable_hours: data.billable ? (data.hours || 0) : 0,
        parent_project: data.project_id || data.project || null,
        note: data.description || null,
        status: 'Draft',
        naming_series: 'TS-',
        company: 'Aries',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });

    return {
      success: true,
      timesheet: {
        id: record.name,
        employee_name: record.employee_name || data.employee_name || 'Unknown',
        activity_type: data.activity_type || 'General',
        from_time: record.start_date,
        to_time: record.end_date,
        hours: record.total_hours || 0,
        project: data.project || '',
        status: record.status || 'Draft',
        created_at: record.creation,
        date: record.start_date ? record.start_date.toISOString().slice(0, 10) : undefined,
        description: record.note || undefined,
        billable: (record.total_billable_hours ?? 0) > 0,
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[timesheets] create failed:', msg);
    return { success: false, error: msg || 'Failed to create timesheet' };
  }
}
