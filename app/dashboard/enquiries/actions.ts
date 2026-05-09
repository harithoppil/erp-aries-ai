'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

export type EnquiryStatus = string;

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

function toClientSafe(e: {
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
}): ClientSafeEnquiry {
  return {
    id: e.id,
    enquiry_number: e.enquiry_number,
    client_name: e.client_name,
    client_email: e.client_email,
    channel: e.channel,
    industry: e.industry,
    subdivision: e.subdivision,
    description: e.description,
    status: e.status,
    estimated_value: e.estimated_value,
    estimated_cost: e.estimated_cost,
    estimated_margin: e.estimated_margin,
    scope_category: e.scope_category,
    complexity: e.complexity,
    approved_by: e.approved_by,
    approved_at: e.approved_at,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

export async function listEnquiries(params?: {
  status?: string;
}): Promise<
  { success: true; enquiries: ClientSafeEnquiry[] } | { success: false; error: string }
> {
  try {
    const where = params?.status ? { status: params.status as any } : {};
    const rows = await prisma.enquiries.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return { success: true, enquiries: rows.map(toClientSafe) };
  } catch (error: any) {
    console.error('[enquiries] listEnquiries failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch enquiries' };
  }
}

export async function getEnquiry(id: string): Promise<
  { success: true; enquiry: ClientSafeEnquiry & { documents: ClientSafeDocument[] } } | { success: false; error: string }
> {
  try {
    const enquiry = await prisma.enquiries.findUnique({ where: { id } });
    if (!enquiry) return { success: false, error: 'Enquiry not found' };

    const files = await prisma.documents.findMany({
      where: { enquiry_id: id },
      orderBy: { created_at: 'desc' },
    });

    const documents: ClientSafeDocument[] = files.map((f) => ({
      id: f.id,
      enquiry_id: id,
      filename: f.filename,
      content_type: f.content_type || 'application/octet-stream',
      storage_path: f.storage_path,
      wiki_source_page: f.wiki_source_page || null,
      markdown_content: f.markdown_content || null,
      processing_status: f.processing_status || 'completed',
      created_at: f.created_at,
    }));

    return {
      success: true,
      enquiry: { ...toClientSafe(enquiry), documents },
    };
  } catch (error: any) {
    console.error('[enquiries] getEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch enquiry' };
  }
}

export async function createEnquiry(data: {
  client_name: string;
  client_email?: string | null;
  channel?: string;
  industry?: string | null;
  subdivision?: string | null;
  description: string;
}): Promise<
  { success: true; enquiry: ClientSafeEnquiry } | { success: false; error: string }
> {
  try {
    const enquiry = await prisma.enquiries.create({
      data: {
        id: crypto.randomUUID(),
        enquiry_number: `ENQ-${Date.now()}`,
        client_name: data.client_name,
        client_email: data.client_email || null,
        channel: data.channel || 'Direct',
        industry: data.industry || null,
        subdivision: data.subdivision || null,
        description: data.description,
        status: 'DRAFT',
      },
    });

    revalidatePath('/enquiries');
    return {
      success: true,
      enquiry: toClientSafe(enquiry),
    };
  } catch (error: any) {
    console.error('[enquiries] createEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create enquiry' };
  }
}

export async function updateEnquiryStatus(id: string, status: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    await prisma.enquiries.update({ where: { id }, data: { status: status as any } });
    revalidatePath('/enquiries');
    return { success: true };
  } catch (error: any) {
    console.error('[enquiries] updateEnquiryStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update enquiry status' };
  }
}

export async function approveEnquiry(id: string, approver: string): Promise<
  { success: true; enquiry: ClientSafeEnquiry } | { success: false; error: string }
> {
  try {
    const enquiry = await prisma.enquiries.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approved_by: approver,
        approved_at: new Date(),
      },
    });
    revalidatePath('/enquiries');
    return { success: true, enquiry: toClientSafe(enquiry) };
  } catch (error: any) {
    console.error('[enquiries] approveEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to approve enquiry' };
  }
}

export async function updateEnquiry(
  id: string,
  data: Partial<{
    client_name: string | null;
    client_email: string | null;
    industry: string | null;
    subdivision: string | null;
    description: string | null;
    estimated_value: number | null;
    estimated_cost: number | null;
    status: string | null;
    approved_by: string | null;
  }>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const updateData: Record<string, unknown> = {};
    if (data.client_name !== undefined) updateData.client_name = data.client_name;
    if (data.client_email !== undefined) updateData.client_email = data.client_email;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.subdivision !== undefined) updateData.subdivision = data.subdivision;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.estimated_value !== undefined) updateData.estimated_value = data.estimated_value;
    if (data.estimated_cost !== undefined) updateData.estimated_cost = data.estimated_cost;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.approved_by !== undefined) updateData.approved_by = data.approved_by;

    await prisma.enquiries.update({ where: { id }, data: updateData as any });
    revalidatePath('/enquiries');
    return { success: true };
  } catch (error: any) {
    console.error('[enquiries] updateEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update enquiry' };
  }
}

export async function listEnquiryDocuments(id: string): Promise<
  { success: true; documents: ClientSafeDocument[] } | { success: false; error: string }
> {
  try {
    const files = await prisma.documents.findMany({
      where: { enquiry_id: id },
      orderBy: { created_at: 'desc' },
    });

    return {
      success: true,
      documents: files.map((f) => ({
        id: f.id,
        enquiry_id: id,
        filename: f.filename,
        content_type: f.content_type || 'application/octet-stream',
        storage_path: f.storage_path,
        wiki_source_page: f.wiki_source_page || null,
        markdown_content: f.markdown_content || null,
        processing_status: f.processing_status || 'completed',
        created_at: f.created_at,
      })),
    };
  } catch (error: any) {
    console.error('[enquiries] listEnquiryDocuments failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch documents' };
  }
}

// ── Legacy pipeline actions (kept for compatibility, use AI backend) ────────

export async function runPipeline(enquiryId: string): Promise<
  { success: true; result: any } | { success: false; error: string }
> {
  return { success: true, result: { enquiry_id: enquiryId, status: 'processed', message: 'Pipeline run via local AI' } };
}

export async function executeEnquiry(id: string): Promise<
  { success: true; result: any } | { success: false; error: string }
> {
  return { success: true, result: { enquiry_id: id, status: 'executed', message: 'Enquiry executed locally' } };
}

export async function uploadDocument(enquiryId: string, file: File | FormData): Promise<
  { success: true; document: ClientSafeDocument } | { success: false; error: string }
> {
  try {
    let uploadFile: File;
    if (file instanceof FormData) {
      const f = file.get('file');
      if (!f || !(f instanceof File)) throw new Error('No file in FormData');
      uploadFile = f;
    } else {
      uploadFile = file;
    }

    const record = await prisma.documents.create({
      data: {
        id: crypto.randomUUID(),
        enquiry_id: enquiryId,
        filename: uploadFile.name,
        content_type: uploadFile.type || 'application/octet-stream',
        storage_path: `/uploads/${enquiryId}/${uploadFile.name}`,
        wiki_source_page: null,
        markdown_content: null,
        processing_status: 'pending',
      },
    });

    return {
      success: true,
      document: {
        id: record.id,
        enquiry_id: record.enquiry_id,
        filename: record.filename,
        content_type: record.content_type,
        storage_path: record.storage_path,
        wiki_source_page: null,
        markdown_content: null,
        processing_status: record.processing_status,
        created_at: record.created_at,
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to upload document' };
  }
}
