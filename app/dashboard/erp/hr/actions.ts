'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type ClientSafePersonnel = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  designation: string | null;
  department: string | null;
  status: string;
  date_of_joining: Date | null;
  created_at: Date;
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

export async function listPersonnel(): Promise<
  { success: true; personnel: ClientSafePersonnel[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.personnel.findMany({
      orderBy: { created_at: 'desc' },
      take: 500,
    });

    return {
      success: true,
      personnel: rows.map((e) => ({
        id: e.id,
        first_name: e.first_name || 'Unknown',
        last_name: e.last_name || null,
        email: e.email || null,
        designation: e.designation || null,
        department: e.department || null,
        status: e.status,
        date_of_joining: null,
        created_at: e.created_at,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching personnel:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch personnel' };
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
    const record = await prisma.personnel.create({
      data: {
        id: crypto.randomUUID(),
        employee_id: data.employee_id || `EMP-${Date.now()}`,
        first_name: data.first_name || 'Unknown',
        last_name: data.last_name || '',
        email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        day_rate: data.day_rate || null,
        status: 'ACTIVE',
        currency: 'USD',
      },
    });
    revalidatePath('/erp/hr');
    return {
      success: true as const,
      personnel: {
        id: record.id,
        first_name: record.first_name || 'Unknown',
        last_name: record.last_name || null,
        email: record.email || null,
        designation: record.designation || null,
        department: record.department || null,
        status: 'ACTIVE',
        date_of_joining: data.date_of_joining ? new Date(data.date_of_joining) : null,
        created_at: record.created_at,
      } as ClientSafePersonnel,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create personnel' };
  }
}

export async function listComplianceAlerts(): Promise<
  { success: true; alerts: ClientSafeCertification[] } | { success: false; error: string }
> {
  try {
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);

    const rows = await prisma.certifications.findMany({
      where: {
        expiry_date: { lte: sixtyDaysFromNow },
        status: { not: 'EXPIRED' },
      },
      orderBy: { expiry_date: 'asc' },
      take: 100,
    });

    return {
      success: true,
      alerts: rows.map((c) => ({
        id: c.id,
        personnel_id: c.personnel_id,
        cert_type: c.cert_type || 'Certification',
        cert_number: c.cert_number || null,
        issuing_body: c.issuing_body || null,
        issue_date: c.issue_date,
        expiry_date: c.expiry_date,
        status: c.status || 'Valid',
      })),
    };
  } catch (error: any) {
    console.error('Error fetching compliance alerts:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch compliance alerts' };
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
    const record = await prisma.personnel.create({
      data: {
        id: crypto.randomUUID(),
        employee_id: `EMP-${Date.now()}`,
        first_name: data.first_name,
        last_name: data.last_name || '',
        email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        status: 'ACTIVE',
        currency: 'USD',
      },
    });
    revalidatePath('/erp/hr');
    return {
      success: true as const,
      employee: {
        id: record.id,
        first_name: data.first_name,
        last_name: data.last_name || '',
        email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        status: 'Active',
        date_of_joining: data.date_of_joining || null,
        created_at: record.created_at,
      } as ClientSafePersonnel,
    };
  } catch (error: any) {
    console.error('Error creating employee:', error?.message);
    return { success: false as const, error: error?.message || 'Failed to create employee' };
  }
}
