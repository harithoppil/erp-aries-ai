'use server';

import { prisma } from '@/lib/prisma';

export type ClientSafeTimesheet = {
  id: string;
  employee_name: string;
  activity_type: string;
  from_time: Date;
  to_time: Date;
  hours: number;
  project: string;
  status: string;
  created_at: Date;
  date?: string;
  description?: string;
  billable?: boolean;
};

export async function listTimesheets(): Promise<
  { success: true; timesheets: ClientSafeTimesheet[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.timesheets.findMany({
      include: { personnel: true, projects: true },
      orderBy: { date: 'desc' },
      take: 200,
    });

    return {
      success: true,
      timesheets: rows.map((ts) => ({
        id: ts.id,
        employee_name: (ts.personnel as Record<string, unknown> | null)?.name as string || 'Unknown',
        activity_type: ts.activity_type || 'General',
        from_time: ts.date,
        to_time: ts.date,
        hours: ts.hours || 0,
        project: (ts.projects as Record<string, unknown> | null)?.name as string || '',
        status: 'Draft',
        created_at: ts.date,
        date: ts.date.toISOString().slice(0, 10),
        description: ts.description || undefined,
        billable: ts.billable ?? true,
      })),
    };
  } catch (error:any) {
    console.error('[timesheets] list failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to load timesheets' };
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
    const date = data.date ? new Date(data.date) : new Date();
    const record = await prisma.timesheets.create({
      data: {
        id: crypto.randomUUID(),
        project_id: data.project_id || '00000000-0000-0000-0000-000000000000',
        personnel_id: data.personnel_id || '00000000-0000-0000-0000-000000000000',
        date,
        hours: data.hours || 0,
        activity_type: data.activity_type || 'General',
        description: data.description || null,
        billable: data.billable ?? true,
      },
    });

    return {
      success: true,
      timesheet: {
        id: record.id,
        employee_name: data.employee_name || 'Unknown',
        activity_type: record.activity_type,
        from_time: record.date,
        to_time: record.date,
        hours: record.hours,
        project: data.project || '',
        status: 'Draft',
        created_at: record.date,
        date: record.date.toISOString().slice(0, 10),
        description: record.description || undefined,
        billable: record.billable,
      },
    };
  } catch (error:any) {
    console.error('[timesheets] create failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create timesheet' };
  }
}
