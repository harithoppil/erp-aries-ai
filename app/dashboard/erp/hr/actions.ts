'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Dashboard Types ─────────────────────────────────────────────────────────

export type HRDashboardData = {
  totalEmployees: number;
  activeEmployees: number;
  departmentCount: number;
  headcountByDepartment: { department: string; count: number }[];
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

export async function getHRDashboardData(): Promise<HRDashboardData> {
  await requirePermission('Employee', 'read');

  const [totalEmployees, activeEmployees, departmentGroups] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: 'Active' } }),
    prisma.employee.groupBy({
      by: ['department'],
      _count: { name: true },
      orderBy: { _count: { name: 'desc' } },
    }),
  ]);

  const headcountByDepartment = departmentGroups
    .filter((g) => g.department)
    .map((g) => ({
      department: g.department || 'Unassigned',
      count: g._count.name,
    }))
    .slice(0, 8);

  const departmentCount = new Set(
    departmentGroups.filter((g) => g.department).map((g) => g.department),
  ).size;

  return {
    totalEmployees,
    activeEmployees,
    departmentCount,
    headcountByDepartment,
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafePersonnel = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  designation: string | null;
  department: string | null;
  status: string;
  date_of_joining: Date | null;
  created_at: Date | null;
};

export type ClientSafeCertification = {
  id: string;
  personnel_id: string;
  cert_type: string;
  cert_number: string | null;
  issuing_body: string | null;
  issue_date: Date | null;
  expiry_date: Date | null;
  status: string;
};

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listPersonnel(): Promise<
  { success: true; personnel: ClientSafePersonnel[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Employee", "read");
    const rows = await prisma.employee.findMany({
      orderBy: { creation: 'desc' },
      take: 500,
    });

    return {
      success: true,
      personnel: rows.map((e) => ({
        id: e.name,
        first_name: e.first_name || 'Unknown',
        last_name: e.last_name || null,
        email: e.company_email || e.personal_email || null,
        designation: e.designation || null,
        department: e.department || null,
        status: e.status || 'Active',
        date_of_joining: e.date_of_joining || null,
        created_at: e.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching personnel:', msg);
    return { success: false, error: msg || 'Failed to fetch personnel' };
  }
}

export async function createPersonnel(data: {
  employee_id?: string;
  first_name: string;
  last_name?: string;
  email?: string;
  designation?: string;
  department?: string;
  date_of_joining?: string;
  day_rate?: number;
}) {
  try {
    await requirePermission("Employee", "create");
    const name = `EMP-${Date.now()}`;
    const record = await prisma.employee.create({
      data: {
        name,
        first_name: data.first_name || 'Unknown',
        last_name: data.last_name || '',
        company_email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        company: 'Aries',
        status: 'Active',
        date_of_joining: data.date_of_joining ? new Date(data.date_of_joining) : new Date(),
        date_of_birth: new Date('1990-01-01'),
        gender: 'Male',
        naming_series: 'HR-EMP-',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    revalidatePath('/erp/hr');
    return {
      success: true as const,
      personnel: {
        id: record.name,
        first_name: record.first_name || 'Unknown',
        last_name: record.last_name || null,
        email: record.company_email || null,
        designation: record.designation || null,
        department: record.department || null,
        status: 'Active',
        date_of_joining: record.date_of_joining,
        created_at: record.creation,
      } as ClientSafePersonnel,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create personnel' };
  }
}

// ── Compliance Alerts (proxy via Employee.contract_end_date) ────────────────

export async function listComplianceAlerts(): Promise<
  { success: true; alerts: ClientSafeCertification[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Employee", "read");
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const rows = await prisma.employee.findMany({
      where: {
        contract_end_date: { lte: sixtyDaysFromNow },
        status: 'Active',
      },
      orderBy: { contract_end_date: 'asc' },
      take: 100,
    });

    return {
      success: true,
      alerts: rows.map((e) => ({
        id: e.name,
        personnel_id: e.name,
        cert_type: 'Contract Expiry',
        cert_number: e.employee_number || null,
        issuing_body: 'HR Department',
        issue_date: e.date_of_joining || null,
        expiry_date: e.contract_end_date || null,
        status: e.contract_end_date && e.contract_end_date < new Date() ? 'Expired' : 'Expiring',
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching compliance alerts:', msg);
    return { success: false, error: msg || 'Failed to fetch compliance alerts' };
  }
}

export async function createEmployee(data: {
  first_name: string;
  last_name?: string;
  email?: string;
  designation?: string;
  department?: string;
  date_of_joining?: Date;
}) {
  try {
    await requirePermission("Employee", "create");
    const name = `EMP-${Date.now()}`;
    const record = await prisma.employee.create({
      data: {
        name,
        first_name: data.first_name,
        last_name: data.last_name || '',
        company_email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        company: 'Aries',
        status: 'Active',
        date_of_joining: data.date_of_joining || new Date(),
        date_of_birth: new Date('1990-01-01'),
        gender: 'Male',
        naming_series: 'HR-EMP-',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    revalidatePath('/erp/hr');
    return {
      success: true as const,
      employee: {
        id: record.name,
        first_name: data.first_name,
        last_name: data.last_name || '',
        email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        status: 'Active',
        date_of_joining: data.date_of_joining || null,
        created_at: record.creation,
      } as ClientSafePersonnel,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error creating employee:', msg);
    return { success: false as const, error: msg || 'Failed to create employee' };
  }
}
