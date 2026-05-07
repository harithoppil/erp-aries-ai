'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeTimesheet = {
  id: string;
  project_id: string;
  personnel_id: string;
  date: Date;
  hours: number;
  activity_type: string;
  description: string | null;
  billable: boolean;
};

export async function listTimesheets(): Promise<
  { success: true; timesheets: ClientSafeTimesheet[] } | { success: false; error: string }
> {
  try {
    const timesheets = await prisma.timesheets.findMany({ orderBy: { date: 'desc' } });
    return { success: true, timesheets: timesheets.map((t) => ({ ...t })) };
  } catch (error) {
    console.error('Error fetching timesheets:', error);
    return { success: false, error: 'Failed to fetch timesheets' };
  }
}

export async function createTimesheet(data: {
  project_id: string;
  personnel_id: string;
  date: Date;
  hours: number;
  activity_type: string;
  description?: string;
  billable?: boolean;
}) {
  try {
    const timesheet = await prisma.timesheets.create({
      data: {
        id: randomUUID(),
        project_id: data.project_id,
        personnel_id: data.personnel_id,
        date: data.date,
        hours: data.hours,
        activity_type: data.activity_type,
        description: data.description || null,
        billable: data.billable ?? true,
      }
    });
    revalidatePath('/erp/timesheets');
    return { success: true as const, timesheet: { ...timesheet } as ClientSafeTimesheet };
  } catch (error) {
    return { success: false as const, error: 'Failed to create timesheet entry' };
  }
}

// ── Timesheet Mutations ───────────────────────────────────────────────────

export async function updateTimesheet(
  id: string,
  data: Partial<{
    hours: number;
    activity_type: string;
    description: string;
    billable: boolean;
    date: Date;
  }>
) {
  try {
    const record = await prisma.timesheets.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/timesheets');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[timesheets] updateTimesheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update timesheet' };
  }
}

export async function deleteTimesheet(id: string) {
  try {
    await prisma.timesheets.delete({ where: { id } });
    revalidatePath('/erp/timesheets');
    return { success: true };
  } catch (error: any) {
    console.error('[timesheets] deleteTimesheet failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete timesheet' };
  }
}
