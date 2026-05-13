'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toDisplayLabel } from '@/lib/erpnext/prisma-delegate';

export interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies: string;
  color: string;
  doctype: string;
}

export interface GanttConfig {
  doctype: string;
  doctypeLabel: string;
  startField: string;
  endField: string;
  progressField: string | null;
  dependsOnField: string | null;
  titleField: string;
  tasks: GanttTask[];
}

export interface GanttResult {
  success: true;
  config: GanttConfig;
}
export interface GanttError {
  success: false;
  error: string;
}
export type FetchGanttResult = GanttResult | GanttError;

const STATUS_GANTT_COLORS: Record<string, string> = {
  'Open': '#3b82f6',
  'In Progress': '#f59e0b',
  'Completed': '#22c55e',
  'Closed': '#6b7280',
  'Cancelled': '#ef4444',
  'Draft': '#94a3b8',
  'Submitted': '#3b82f6',
};

const GANTT_CONFIGS: Record<string, {
  startField: string;
  endField: string;
  progressField?: string;
  dependsOnField?: string;
  titleField?: string;
}> = {
  'task': {
    startField: 'exp_start_date',
    endField: 'exp_end_date',
    progressField: 'progress',
    dependsOnField: 'depends_on',
    titleField: 'subject',
  },
  'project': {
    startField: 'expected_start_date',
    endField: 'expected_end_date',
    titleField: 'project_name',
  },
  'sales-order': {
    startField: 'transaction_date',
    endField: 'delivery_date',
    titleField: 'customer_name',
  },
  'purchase-order': {
    startField: 'transaction_date',
    endField: 'schedule_date',
    titleField: 'supplier_name',
  },
  'issue': {
    startField: 'opening_date',
    endField: 'resolution_date',
    titleField: 'subject',
  },
  'leave-allocation': {
    startField: 'from_date',
    endField: 'to_date',
    titleField: 'employee_name',
  },
  'lead': {
    startField: 'creation',
    endField: 'creation',
    titleField: 'lead_name',
  },
  'opportunity': {
    startField: 'transaction_date',
    endField: 'transaction_date',
    titleField: 'customer_name',
  },
};

export async function fetchGanttData(doctype: string): Promise<FetchGanttResult> {
  try {
    const ganttConfig = GANTT_CONFIGS[doctype];
    const config = ganttConfig ?? {
      startField: 'creation',
      endField: 'creation',
    };

    const delegate = getDelegate(prisma, doctype);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const titleField = config.titleField ?? 'name';

    const records = await delegate.findMany({
      where: { docstatus: { not: 2 } },
      orderBy: { [config.startField]: 'asc' },
      take: 500,
    }) as Record<string, unknown>[];

    const tasks: GanttTask[] = records
      .filter((r) => r[config.startField] != null)
      .map((r) => {
        const startDate = r[config.startField] ? new Date(String(r[config.startField])) : new Date();
        const endDate = r[config.endField] ? new Date(String(r[config.endField])) : new Date(startDate.getTime() + 86400000);

        // If end is same as start or before, add 1 day
        const effectiveEnd = endDate <= startDate ? new Date(startDate.getTime() + 86400000) : endDate;

        // Progress (0-100)
        let progress = 0;
        if (config.progressField && r[config.progressField] != null) {
          progress = Math.min(100, Math.max(0, Number(r[config.progressField]) || 0));
        } else if (r.docstatus === 1) {
          progress = 100;
        }

        // Dependencies
        let dependencies = '';
        if (config.dependsOnField && r[config.dependsOnField]) {
          const depVal = String(r[config.dependsOnField]);
          // Frappe stores dependencies as comma-separated names
          dependencies = depVal.split(',').map((d: string) => d.trim()).filter(Boolean).join(',');
        }

        // Color from status
        const status = String(r.status ?? r.docstatus ?? '');
        const color = STATUS_GANTT_COLORS[status] ?? '#3b82f6';

        return {
          id: String(r.name ?? ''),
          name: String(r[titleField] ?? r.name ?? ''),
          start: startDate.toISOString().split('T')[0],
          end: effectiveEnd.toISOString().split('T')[0],
          progress,
          dependencies,
          color,
          doctype,
        };
      });

    return {
      success: true,
      config: {
        doctype,
        doctypeLabel: toDisplayLabel(doctype),
        startField: config.startField,
        endField: config.endField,
        progressField: config.progressField ?? null,
        dependsOnField: config.dependsOnField ?? null,
        titleField,
        tasks,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchGanttData]', msg);
    return { success: false, error: 'Failed to load Gantt view' };
  }
}
