'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeDepartment = {
  id: string;
  name: string;
  department_name: string;
  parent_department: string | null;
  company: string;
  is_group: boolean;
  disabled: boolean;
};

// ── List Departments ────────────────────────────────────────────────────────

export async function listDepartments(): Promise<
  { success: true; departments: ClientSafeDepartment[] } | { success: false; error: string }
> {
  try {
    await requirePermission('Department', 'read');
    const rows = await prisma.department.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      departments: rows.map((d) => ({
        id: d.name,
        name: d.name,
        department_name: d.department_name,
        parent_department: d.parent_department,
        company: d.company,
        is_group: d.is_group ?? false,
        disabled: d.disabled ?? false,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching departments:', msg);
    return { success: false, error: msg || 'Failed to fetch departments' };
  }
}
