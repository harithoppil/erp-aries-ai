'use server';

import { prisma } from '@/lib/prisma';
import { getDelegate, toDisplayLabel, toAccessor } from '@/lib/erpnext/prisma-delegate';

export interface WorkspaceShortcut {
  label: string;
  doctype: string;
  href: string;
  icon: string;
  count: number;
}

export interface WorkspaceData {
  label: string;
  shortcuts: WorkspaceShortcut[];
}

export interface WorkspaceResult {
  success: true;
  data: WorkspaceData;
}
export interface WorkspaceError {
  success: false;
  error: string;
}
export type FetchWorkspaceResult = WorkspaceResult | WorkspaceError;

// Workspace definitions matching sidebar groups
const WORKSPACES: Record<string, {
  label: string;
  doctypes: { name: string; label: string; icon: string }[];
}> = {
  'selling': {
    label: 'Selling',
    doctypes: [
      { name: 'customer', label: 'Customers', icon: 'Users' },
      { name: 'quotation', label: 'Quotations', icon: 'Receipt' },
      { name: 'sales-order', label: 'Sales Orders', icon: 'ClipboardList' },
      { name: 'sales-invoice', label: 'Sales Invoices', icon: 'Receipt' },
      { name: 'blanket-order', label: 'Blanket Orders', icon: 'ClipboardList' },
    ],
  },
  'buying': {
    label: 'Buying',
    doctypes: [
      { name: 'supplier', label: 'Suppliers', icon: 'Truck' },
      { name: 'purchase-order', label: 'Purchase Orders', icon: 'ClipboardList' },
      { name: 'purchase-invoice', label: 'Purchase Invoices', icon: 'Receipt' },
      { name: 'request-for-quotation', label: 'RFQs', icon: 'Receipt' },
    ],
  },
  'stock': {
    label: 'Stock',
    doctypes: [
      { name: 'item', label: 'Items', icon: 'Package' },
      { name: 'warehouse', label: 'Warehouses', icon: 'Database' },
      { name: 'stock-entry', label: 'Stock Entries', icon: 'ArrowLeftRight' },
      { name: 'delivery-note', label: 'Delivery Notes', icon: 'Truck' },
      { name: 'purchase-receipt', label: 'Purchase Receipts', icon: 'FileText' },
    ],
  },
  'accounts': {
    label: 'Accounts',
    doctypes: [
      { name: 'account', label: 'Accounts', icon: 'Landmark' },
      { name: 'payment-entry', label: 'Payment Entries', icon: 'CreditCard' },
      { name: 'journal-entry', label: 'Journal Entries', icon: 'BookOpen' },
      { name: 'sales-invoice', label: 'Sales Invoices', icon: 'Receipt' },
      { name: 'purchase-invoice', label: 'Purchase Invoices', icon: 'Receipt' },
    ],
  },
  'hr': {
    label: 'HR',
    doctypes: [
      { name: 'employee', label: 'Employees', icon: 'Users' },
      { name: 'leave-allocation', label: 'Leave Allocations', icon: 'Calendar' },
      { name: 'leave-application', label: 'Leave Applications', icon: 'Calendar' },
    ],
  },
  'crm': {
    label: 'CRM',
    doctypes: [
      { name: 'lead', label: 'Leads', icon: 'Target' },
      { name: 'opportunity', label: 'Opportunities', icon: 'TrendingUp' },
    ],
  },
  'projects': {
    label: 'Projects',
    doctypes: [
      { name: 'project', label: 'Projects', icon: 'Flag' },
      { name: 'task', label: 'Tasks', icon: 'Timer' },
    ],
  },
  'support': {
    label: 'Support',
    doctypes: [
      { name: 'issue', label: 'Issues', icon: 'AlertTriangle' },
    ],
  },
};

export async function fetchWorkspace(slug: string): Promise<FetchWorkspaceResult> {
  try {
    const workspace = WORKSPACES[slug];
    if (!workspace) {
      return { success: false, error: `Unknown workspace: ${slug}` };
    }

    const shortcuts: WorkspaceShortcut[] = [];

    for (const dt of workspace.doctypes) {
      const delegate = getDelegate(prisma, dt.name);
      let count = 0;
      if (delegate) {
        try {
          count = await delegate.count({ where: { docstatus: { not: 2 } } });
        } catch { /* skip */ }
      }
      shortcuts.push({
        label: dt.label,
        doctype: dt.name,
        href: `/dashboard/erp/${dt.name}`,
        icon: dt.icon,
        count,
      });
    }

    return { success: true, data: { label: workspace.label, shortcuts } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[fetchWorkspace]', msg);
    return { success: false, error: 'Failed to load workspace' };
  }
}

export function getWorkspaceSlugs(): string[] {
  return Object.keys(WORKSPACES);
}
