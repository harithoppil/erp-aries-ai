'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color?: string;
  doctype: string;
  name: string;
  status?: string;
}

export interface CalendarConfig {
  doctype: string;
  doctypeLabel: string;
  dateField: string;
  dateFieldEnd?: string;
  titleField: string;
  colorField?: string;
}

export interface CalendarResult {
  success: true;
  events: CalendarEvent[];
  config: CalendarConfig;
}
export interface CalendarError {
  success: false;
  error: string;
}
export type FetchCalendarResult = CalendarResult | CalendarError;

// Calendar view configs per doctype
const CALENDAR_CONFIGS: Record<string, {
  dateField: string;
  dateFieldEnd?: string;
  titleField: string;
  colorField?: string;
}> = {
  'task': { dateField: 'exp_start_date', dateFieldEnd: 'exp_end_date', titleField: 'subject', colorField: 'status' },
  'project': { dateField: 'expected_start_date', dateFieldEnd: 'expected_end_date', titleField: 'project_name', colorField: 'status' },
  'lead': { dateField: 'creation', titleField: 'lead_name', colorField: 'status' },
  'opportunity': { dateField: 'creation', titleField: 'customer_name', colorField: 'status' },
  'sales-order': { dateField: 'transaction_date', titleField: 'customer_name', colorField: 'docstatus' },
  'purchase-order': { dateField: 'transaction_date', titleField: 'supplier_name', colorField: 'docstatus' },
  'sales-invoice': { dateField: 'posting_date', titleField: 'customer_name', colorField: 'docstatus' },
  'purchase-invoice': { dateField: 'posting_date', titleField: 'supplier_name', colorField: 'docstatus' },
  'quotation': { dateField: 'transaction_date', titleField: 'customer_name', colorField: 'docstatus' },
  'delivery-note': { dateField: 'posting_date', titleField: 'customer_name', colorField: 'docstatus' },
  'payment-entry': { dateField: 'posting_date', titleField: 'party_name', colorField: 'docstatus' },
  'journal-entry': { dateField: 'posting_date', titleField: 'user_remark', colorField: 'docstatus' },
  'leave-application': { dateField: 'from_date', dateFieldEnd: 'to_date', titleField: 'employee_name', colorField: 'status' },
  'leave-allocation': { dateField: 'from_date', dateFieldEnd: 'to_date', titleField: 'leave_type', colorField: 'docstatus' },
  'holiday-list': { dateField: 'creation', titleField: 'holiday_list_name' },
  'employee': { dateField: 'date_of_joining', titleField: 'employee_name', colorField: 'status' },
};

const STATUS_COLORS: Record<string, string> = {
  'Open': '#3b82f6',
  'In Progress': '#f59e0b',
  'Completed': '#10b981',
  'Closed': '#6b7280',
  'Cancelled': '#ef4444',
  'Draft': '#94a3b8',
  'Submitted': '#10b981',
  '0': '#94a3b8',
  '1': '#10b981',
  '2': '#ef4444',
  'Overdue': '#ef4444',
  'Active': '#10b981',
  'Inactive': '#6b7280',
  'Left': '#ef4444',
};

function resolveColor(value: string | number | unknown): string | undefined {
  const str = String(value ?? '');
  return STATUS_COLORS[str] ?? undefined;
}

export async function fetchCalendarEvents(
  doctype: string,
  startDate?: string,
  endDate?: string,
): Promise<FetchCalendarResult> {
  try {
    const config = CALENDAR_CONFIGS[doctype];
    if (!config) {
      return { success: false, error: `No calendar configuration for ${toDisplayLabel(doctype)}` };
    }

    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const { dateField, dateFieldEnd, titleField, colorField } = config;

    // Build where clause with date range filter if provided
    const where: Record<string, unknown> = { docstatus: { not: 2 } };
    if (startDate && endDate) {
      where.OR = [
        { [dateField]: { gte: new Date(startDate), lte: new Date(endDate) } },
        { [dateField]: { lte: new Date(endDate) }, ...(dateFieldEnd ? { [dateFieldEnd]: { gte: new Date(startDate) } } : {}) },
      ];
    }

    const select: Record<string, boolean> = { name: true, [dateField]: true, [titleField]: true };
    if (dateFieldEnd) select[dateFieldEnd] = true;
    if (colorField) select[colorField] = true;

    const records = await delegate.findMany({
      where,
      select,
      take: 500,
      orderBy: { [dateField]: 'asc' },
    }) as Record<string, unknown>[];

    const events: CalendarEvent[] = records.map((r) => {
      const startVal = r[dateField];
      const endVal = dateFieldEnd ? r[dateFieldEnd] : undefined;
      const isAllDay = !startVal || (startVal instanceof Date && startVal.getHours() === 0 && startVal.getMinutes() === 0);

      return {
        id: String(r.name),
        title: String(r[titleField] ?? r.name ?? ''),
        start: startVal instanceof Date ? startVal.toISOString() : String(startVal ?? ''),
        end: endVal instanceof Date ? endVal.toISOString() : endVal ? String(endVal) : undefined,
        allDay: isAllDay,
        color: colorField ? resolveColor(r[colorField]) : undefined,
        doctype,
        name: String(r.name),
        status: colorField ? String(r[colorField] ?? '') : undefined,
      };
    });

    return {
      success: true,
      events,
      config: {
        doctype,
        doctypeLabel: toDisplayLabel(doctype),
        dateField,
        dateFieldEnd,
        titleField,
        colorField,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchCalendarEvents]', msg);
    return { success: false, error: 'Failed to load calendar events' };
  }
}

export async function updateCalendarEventDate(
  doctype: string,
  name: string,
  dateField: string,
  newDate: string,
  dateFieldEnd?: string,
  newEndDate?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const delegate = getDelegate(prisma, doctype);
    if (!delegate) return { success: false, error: `Unknown DocType: ${doctype}` };

    const data: Record<string, unknown> = {
      [dateField]: new Date(newDate),
      modified: new Date(),
      modified_by: 'Administrator',
    };
    if (dateFieldEnd && newEndDate) {
      data[dateFieldEnd] = new Date(newEndDate);
    }

    await delegate.update({ where: { name }, data });
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[updateCalendarEventDate]', msg);
    return { success: false, error: 'Failed to update event' };
  }
}
