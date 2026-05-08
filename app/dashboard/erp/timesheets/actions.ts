'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc } from '@/lib/frappe-client';

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
    const timesheets = await frappeGetList<Record<string, unknown>>('Timesheet', {
      fields: ['name', 'employee_name', 'status', 'total_hours', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      timesheets: timesheets.map((ts) => ({
        id: String(ts.name),
        employee_name: String(ts.employee_name || 'Unknown'),
        activity_type: 'General',
        from_time: ts.creation ? new Date(String(ts.creation)) : new Date(),
        to_time: ts.creation ? new Date(String(ts.creation)) : new Date(),
        hours: Number(ts.total_hours || 0),
        project: '',
        status: String(ts.status || 'Draft'),
        created_at: ts.creation ? new Date(String(ts.creation)) : new Date(),
        date: ts.creation ? new Date(String(ts.creation)).toISOString().slice(0, 10) : undefined,
        description: undefined,
        billable: true,
      })),
    };
  } catch (error: any) {
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
    const now = new Date();
    const ts: ClientSafeTimesheet = {
      id: crypto.randomUUID(),
      employee_name: data.employee_name || 'Unknown',
      activity_type: data.activity_type || 'General',
      from_time: now,
      to_time: now,
      hours: data.hours || 0,
      project: data.project || '',
      status: 'Draft',
      created_at: now,
      date: data.date,
      description: data.description,
      billable: data.billable ?? true,
    };
    return { success: true, timesheet: ts };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to create timesheet' };
  }
}
