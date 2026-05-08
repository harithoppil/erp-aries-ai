'use server';

import { revalidatePath } from 'next/cache';
import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeCallMethod } from '@/lib/frappe-client';

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
    const employees = await frappeGetList<any>('Employee', {
      fields: ['name', 'first_name', 'last_name', 'personal_email', 'designation', 'department', 'status', 'date_of_joining', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 500,
    });

    return {
      success: true,
      personnel: employees.map((e: any) => ({
        id: e.name,
        first_name: e.first_name || 'Unknown',
        last_name: e.last_name || null,
        email: e.personal_email || null,
        designation: e.designation || null,
        department: e.department || null,
        status: e.status || 'Active',
        date_of_joining: e.date_of_joining ? new Date(e.date_of_joining) : null,
        created_at: e.creation ? new Date(e.creation) : new Date(),
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
    const doc = await frappeInsertDoc<any>('Employee', {
      first_name: data.first_name,
      last_name: data.last_name || undefined,
      personal_email: data.email || undefined,
      designation: data.designation || undefined,
      department: data.department || undefined,
      date_of_joining: data.date_of_joining || undefined,
      status: 'Active',
    });
    revalidatePath('/erp/hr');
    return {
      success: true as const,
      personnel: {
        id: doc.name,
        first_name: doc.first_name || 'Unknown',
        last_name: doc.last_name || null,
        email: doc.personal_email || null,
        designation: doc.designation || null,
        department: doc.department || null,
        status: 'Active',
        date_of_joining: data.date_of_joining ? new Date(data.date_of_joining) : null,
        created_at: new Date(),
      } as ClientSafePersonnel,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create personnel' };
  }
}

export async function listComplianceAlerts(): Promise<
  { success: true; alerts: any[] } | { success: false; error: string }
> {
  try {
    // Fetch certifications expiring within 60 days
    const sixtyDaysFromNow = new Date();
    sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
    const dateStr = sixtyDaysFromNow.toISOString().slice(0, 10);

    const certs = await frappeGetList<any>('Certification', {
      fields: ['name', 'employee', 'certification_name', 'certification_number', 'issuing_body', 'issue_date', 'expiry_date', 'status'],
      filters: { expiry_date: ['<=', dateStr], status: ['!=', 'Expired'] },
      order_by: 'expiry_date asc',
      limit_page_length: 100,
    });

    return {
      success: true,
      alerts: certs.map((c: any) => ({
        id: c.name,
        personnel_id: c.employee,
        cert_type: c.certification_name || 'Certification',
        cert_number: c.certification_number || null,
        issuing_body: c.issuing_body || null,
        issue_date: c.issue_date ? new Date(c.issue_date) : null,
        expiry_date: c.expiry_date ? new Date(c.expiry_date) : null,
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
    const employee = await frappeInsertDoc<any>('Employee', {
      first_name: data.first_name,
      last_name: data.last_name || undefined,
      personal_email: data.email || undefined,
      designation: data.designation || undefined,
      department: data.department || undefined,
      date_of_joining: data.date_of_joining ? data.date_of_joining.toISOString().slice(0, 10) : undefined,
      status: 'Active',
    });
    revalidatePath('/erp/hr');
    return {
      success: true as const,
      employee: {
        id: employee.name,
        first_name: data.first_name,
        last_name: data.last_name || null,
        email: data.email || null,
        designation: data.designation || null,
        department: data.department || null,
        status: 'Active',
        date_of_joining: data.date_of_joining || null,
        created_at: new Date(),
      } as ClientSafePersonnel,
    };
  } catch (error: any) {
    console.error('Error creating employee:', error?.message);
    return { success: false as const, error: error?.message || 'Failed to create employee' };
  }
}
