'use server';

import { prisma } from '@/lib/prisma';
import { personnelstatus, certstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafePersonnel = {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  designation: string | null;
  department: string | null;
  day_rate: number | null;
  currency: string;
  created_at: Date;
};

export async function listPersonnel(): Promise<
  { success: true; personnel: ClientSafePersonnel[] } | { success: false; error: string }
> {
  try {
    const personnel = await prisma.personnel.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, personnel: personnel.map((p) => ({ ...p, status: String(p.status) })) };
  } catch (error) {
    console.error('Error fetching personnel:', error);
    return { success: false, error: 'Failed to fetch personnel' };
  }
}

export async function createPersonnel(data: {
  employee_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  day_rate?: number;
  currency?: string;
}) {
  try {
    const person = await prisma.personnel.create({
      data: {
        id: randomUUID(),
        employee_id: data.employee_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || null,
        phone: data.phone || null,
        status: personnelstatus.ACTIVE,
        designation: data.designation || null,
        department: data.department || null,
        day_rate: data.day_rate || null,
        currency: data.currency || 'AED',
      }
    });
    revalidatePath('/erp/hr');
    return { success: true as const, person: { ...person, status: String(person.status) } as ClientSafePersonnel };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'Employee ID already exists' };
    return { success: false as const, error: 'Failed to create personnel' };
  }
}

export async function listCertifications() {
  try {
    const certifications = await prisma.certifications.findMany({ orderBy: { issue_date: 'desc' } });
    return { success: true as const, certifications };
  } catch (error) {
    return { success: false as const, error: 'Failed to fetch certifications' };
  }
}

export async function addCertification(data: {
  personnel_id: string;
  cert_type: string;
  issuing_body?: string;
  issue_date?: Date;
  expiry_date?: Date;
  cert_number?: string;
}) {
  try {
    const cert = await prisma.certifications.create({
      data: {
        id: randomUUID(),
        personnel_id: data.personnel_id,
        cert_type: data.cert_type,
        issuing_body: data.issuing_body || null,
        issue_date: data.issue_date || null,
        expiry_date: data.expiry_date || null,
        cert_number: data.cert_number || null,
        status: certstatus.VALID,
      }
    });
    revalidatePath('/erp/hr');
    return { success: true as const, certification: cert };
  } catch (error) {
    return { success: false as const, error: 'Failed to add certification' };
  }
}
