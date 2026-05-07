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

export type ClientSafeCertification = {
  id: string;
  personnel_id: string;
  cert_type: string;
  issuing_body: string | null;
  issue_date: Date | null;
  expiry_date: Date | null;
  cert_number: string | null;
  status: string;
};

export async function getComplianceAlerts(): Promise<
  { success: true; alerts: ClientSafeCertification[] } | { success: false; error: string }
> {
  try {
    const certs = await prisma.certifications.findMany({
      where: { status: { in: [certstatus.EXPIRED, certstatus.EXPIRING_SOON] } },
      orderBy: { expiry_date: 'asc' },
      include: { personnel: { select: { id: true, first_name: true, last_name: true } } },
    });
    return { success: true, alerts: certs.map(c => ({
      id: c.id,
      personnel_id: c.personnel_id,
      cert_type: c.cert_type,
      issuing_body: c.issuing_body,
      issue_date: c.issue_date,
      expiry_date: c.expiry_date,
      cert_number: c.cert_number,
      status: String(c.status),
    })) };
  } catch (error) {
    console.error('Error fetching compliance alerts:', error);
    return { success: false, error: 'Failed to fetch compliance alerts' };
  }
}

// ── Personnel Mutations ────────────────────────────────────────────────────

export async function updatePersonnelStatus(id: string, status: personnelstatus) {
  try {
    const record = await prisma.personnel.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/hr');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[hr] updatePersonnelStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update personnel status' };
  }
}

export async function updatePersonnel(
  id: string,
  data: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    designation: string;
    department: string;
    day_rate: number;
  }>
) {
  try {
    const record = await prisma.personnel.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/hr');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[hr] updatePersonnel failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update personnel' };
  }
}

export async function deletePersonnel(id: string) {
  try {
    await prisma.personnel.update({
      where: { id },
      data: { status: personnelstatus.INACTIVE },
    });
    revalidatePath('/erp/hr');
    return { success: true };
  } catch (error: any) {
    console.error('[hr] deletePersonnel failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete personnel' };
  }
}

// ── Certification Mutations ────────────────────────────────────────────────

export async function updateCertification(
  id: string,
  data: Partial<{
    cert_type: string;
    cert_number: string;
    issuing_body: string;
    issue_date: Date;
    expiry_date: Date;
    status: certstatus;
  }>
) {
  try {
    const record = await prisma.certifications.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/hr');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[hr] updateCertification failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update certification' };
  }
}

export async function deleteCertification(id: string) {
  try {
    await prisma.certifications.delete({ where: { id } });
    revalidatePath('/erp/hr');
    return { success: true };
  } catch (error: any) {
    console.error('[hr] deleteCertification failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete certification' };
  }
}
