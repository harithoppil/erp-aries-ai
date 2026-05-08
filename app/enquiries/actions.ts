'use server';

import { prisma } from '@/lib/prisma';
import { enquirystatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type EnquiryStatus = enquirystatus;

export type ClientSafeEnquiry = {
  id: string;
  enquiry_number: string | null;
  client_name: string;
  client_email: string | null;
  channel: string;
  industry: string | null;
  subdivision: string | null;
  description: string;
  status: string;
  estimated_value: number | null;
  estimated_cost: number | null;
  estimated_margin: number | null;
  scope_category: string | null;
  complexity: string | null;
  approved_by: string | null;
  approved_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ClientSafeDocument = {
  id: string;
  enquiry_id: string;
  filename: string;
  content_type: string;
  storage_path: string;
  wiki_source_page: string | null;
  markdown_content: string | null;
  processing_status: string;
  created_at: Date;
};

function toClientSafe(e: any): ClientSafeEnquiry {
  return {
    ...e,
    status: String(e.status),
    estimated_value: e.estimated_value ?? null,
    estimated_cost: e.estimated_cost ?? null,
    estimated_margin: e.estimated_margin ?? null,
  };
}

export async function listEnquiries(params?: {
  status?: string;
}): Promise<
  { success: true; enquiries: ClientSafeEnquiry[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (params?.status) {
      where.status = params.status;
    }
    const enquiries = await prisma.enquiries.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: { documents: true },
    });
    return { success: true, enquiries: enquiries.map(toClientSafe) };
  } catch (error: any) {
    console.error('[enquiries] listEnquiries failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch enquiries' };
  }
}

export async function getEnquiry(id: string): Promise<
  { success: true; enquiry: ClientSafeEnquiry & { documents: ClientSafeDocument[] } } | { success: false; error: string }
> {
  try {
    const enquiry = await prisma.enquiries.findUnique({
      where: { id },
      include: { documents: true },
    });
    if (!enquiry) return { success: false, error: 'Enquiry not found' };
    return {
      success: true,
      enquiry: {
        ...toClientSafe(enquiry),
        documents: enquiry.documents.map((d: any) => ({
          ...d,
          processing_status: String(d.processing_status),
        })),
      },
    };
  } catch (error: any) {
    console.error('[enquiries] getEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch enquiry' };
  }
}

export async function createEnquiry(data: {
  client_name: string;
  client_email?: string;
  channel?: string;
  industry?: string;
  subdivision?: string;
  description: string;
}): Promise<
  { success: true; enquiry: ClientSafeEnquiry } | { success: false; error: string }
> {
  try {
    const enquiryNumber = `ENQ-${Date.now().toString().slice(-6)}`;
    const enquiry = await prisma.enquiries.create({
      data: {
        id: randomUUID(),
        enquiry_number: enquiryNumber,
        client_name: data.client_name,
        client_email: data.client_email || null,
        channel: data.channel || 'web',
        industry: data.industry || null,
        subdivision: data.subdivision || null,
        description: data.description,
        status: enquirystatus.DRAFT,
      },
    });
    revalidatePath('/enquiries');
    return { success: true, enquiry: toClientSafe(enquiry) };
  } catch (error: any) {
    console.error('[enquiries] createEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create enquiry' };
  }
}

export async function updateEnquiry(id: string, data: {
  client_name?: string;
  client_email?: string;
  industry?: string;
  subdivision?: string;
  description?: string;
  estimated_value?: number;
  estimated_cost?: number;
  status?: string;
}): Promise<
  { success: true; enquiry: ClientSafeEnquiry } | { success: false; error: string }
> {
  try {
    const updateData: any = { ...data };
    if (data.status) {
      updateData.status = data.status as enquirystatus;
    }
    const enquiry = await prisma.enquiries.update({
      where: { id },
      data: updateData,
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${id}`);
    return { success: true, enquiry: toClientSafe(enquiry) };
  } catch (error: any) {
    console.error('[enquiries] updateEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update enquiry' };
  }
}

export async function approveEnquiry(id: string, approver: string): Promise<
  { success: true; enquiry: ClientSafeEnquiry } | { success: false; error: string }
> {
  try {
    const enquiry = await prisma.enquiries.update({
      where: { id },
      data: {
        status: enquirystatus.APPROVED,
        approved_by: approver,
        approved_at: new Date(),
      },
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${id}`);
    return { success: true, enquiry: toClientSafe(enquiry) };
  } catch (error: any) {
    console.error('[enquiries] approveEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to approve enquiry' };
  }
}

export async function updateEnquiryStatus(id: string, status: enquirystatus): Promise<
  { success: true; enquiry: ClientSafeEnquiry } | { success: false; error: string }
> {
  try {
    const enquiry = await prisma.enquiries.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${id}`);
    return { success: true, enquiry: toClientSafe(enquiry) };
  } catch (error: any) {
    console.error('[enquiries] updateEnquiryStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update enquiry status' };
  }
}

export async function listEnquiryDocuments(enquiryId: string): Promise<
  { success: true; documents: ClientSafeDocument[] } | { success: false; error: string }
> {
  try {
    const documents = await prisma.documents.findMany({
      where: { enquiry_id: enquiryId },
      orderBy: { created_at: 'desc' },
    });
    return {
      success: true,
      documents: documents.map((d: any) => ({
        ...d,
        processing_status: String(d.processing_status),
      })),
    };
  } catch (error: any) {
    console.error('[enquiries] listDocuments failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch documents' };
  }
}

// Pipeline/execute remain as TODO — they orchestrate complex AgentLoop
// tool-calling that isn't yet ported from the Python backend.
export async function runPipeline(enquiryId: string): Promise<
  { success: true; result: Record<string, unknown> } | { success: false; error: string }
> {
  return { success: false, error: 'Pipeline execution requires the AI backend — not yet ported to Node.js' };
}

export async function executeEnquiry(id: string): Promise<
  { success: true; result: Record<string, unknown> } | { success: false; error: string }
> {
  return { success: false, error: 'Enquiry execution requires the AI backend — not yet ported to Node.js' };
}

export async function uploadDocument(enquiryId: string, formData: FormData): Promise<
  { success: true } | { success: false; error: string }
> {
  return { success: false, error: 'Document upload requires backend — not yet ported to Node.js' };
}
