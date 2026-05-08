'use server';

import { revalidatePath } from 'next/cache';
import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeCallMethod } from '@/lib/frappe-client';

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

function toClientSafe(e: any): ClientSafeEnquiry {
  return {
    id: e.name,
    enquiry_number: e.name,
    client_name: e.party_name || e.title || 'Unknown',
    client_email: e.contact_email || null,
    channel: e.source || 'Direct',
    industry: e.industry || null,
    subdivision: e.subsidiary || null,
    description: e.notes || e.description || '',
    status: e.status || 'Open',
    estimated_value: e.opportunity_amount || null,
    estimated_cost: e.estimated_cost || null,
    estimated_margin: e.estimated_margin || null,
    scope_category: e.scope_category || null,
    complexity: e.complexity || null,
    approved_by: e.approved_by || null,
    approved_at: e.approved_at ? new Date(e.approved_at) : null,
    created_at: e.creation ? new Date(e.creation) : new Date(),
    updated_at: e.modified ? new Date(e.modified) : new Date(),
  };
}

export async function listEnquiries(params?: {
  status?: string;
}): Promise<
  { success: true; enquiries: ClientSafeEnquiry[] } | { success: false; error: string }
> {
  try {
    const filters: Record<string, unknown> = {};
    if (params?.status) {
      filters.status = params.status;
    }
    const enquiries = await frappeGetList<any>('Opportunity', {
      fields: ['name', 'party_name', 'contact_email', 'source', 'industry', 'subsidiary', 'notes', 'status', 'opportunity_amount', 'estimated_cost', 'estimated_margin', 'scope_category', 'complexity', 'approved_by', 'approved_at', 'creation', 'modified'],
      filters,
      order_by: 'creation desc',
      limit_page_length: 200,
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
    const enquiry = await frappeGetDoc<any>('Opportunity', id);

    // Fetch linked files
    const files = await frappeGetList<any>('File', {
      fields: ['name', 'file_name', 'file_url', 'attached_to_doctype', 'attached_to_name', 'file_type', 'creation'],
      filters: { attached_to_doctype: 'Opportunity', attached_to_name: id },
    });

    const documents: ClientSafeDocument[] = files.map((f: any) => ({
      id: f.name,
      enquiry_id: id,
      filename: f.file_name,
      content_type: f.file_type || 'application/octet-stream',
      storage_path: f.file_url,
      wiki_source_page: null,
      markdown_content: null,
      processing_status: 'completed',
      created_at: f.creation ? new Date(f.creation) : new Date(),
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
    const enquiry = await frappeInsertDoc<any>('Opportunity', {
      opportunity_from: 'Customer',
      party_name: data.client_name,
      contact_email: data.client_email || undefined,
      source: data.channel || 'Direct',
      industry: data.industry || undefined,
      subsidiary: data.subdivision || undefined,
      notes: data.description,
      status: 'Open',
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
    await frappeUpdateDoc('Opportunity', id, { status });
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
    const enquiry = await frappeUpdateDoc<any>('Opportunity', id, {
      status: 'Converted',
      approved_by: approver,
      approved_at: new Date().toISOString(),
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
    if (data.client_name !== undefined) updateData.party_name = data.client_name;
    if (data.client_email !== undefined) updateData.contact_email = data.client_email;
    if (data.industry !== undefined) updateData.industry = data.industry;
    if (data.subdivision !== undefined) updateData.subsidiary = data.subdivision;
    if (data.description !== undefined) updateData.notes = data.description;
    if (data.estimated_value !== undefined) updateData.opportunity_amount = data.estimated_value;
    if (data.estimated_cost !== undefined) updateData.estimated_cost = data.estimated_cost;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.approved_by !== undefined) updateData.approved_by = data.approved_by;

    await frappeUpdateDoc('Opportunity', id, updateData);
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
    const files = await frappeGetList<any>('File', {
      fields: ['name', 'file_name', 'file_url', 'attached_to_doctype', 'attached_to_name', 'file_type', 'creation'],
      filters: { attached_to_doctype: 'Opportunity', attached_to_name: id },
    });

    return {
      success: true,
      documents: files.map((f: any) => ({
        id: f.name,
        enquiry_id: id,
        filename: f.file_name,
        content_type: f.file_type || 'application/octet-stream',
        storage_path: f.file_url,
        wiki_source_page: null,
        markdown_content: null,
        processing_status: 'completed',
        created_at: f.creation ? new Date(f.creation) : new Date(),
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
  // TODO: integrate with erpnext_ai agent loop
  return { success: true, result: { enquiry_id: enquiryId, status: 'processed', message: 'Pipeline run via Frappe AI' } };
}

export async function executeEnquiry(id: string): Promise<
  { success: true; result: any } | { success: false; error: string }
> {
  // TODO: integrate with erpnext_ai agent loop
  return { success: true, result: { enquiry_id: id, status: 'executed', message: 'Enquiry executed via Frappe' } };
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
    const formData = new FormData();
    formData.append('file', uploadFile);
    const res = await fetch(`/api/frappe/method/upload_file?doctype=Opportunity&docname=${enquiryId}`, {
      method: 'POST',
      body: formData,
    });
    const json = await res.json();
    const uploaded: { name?: string; file_url?: string } = json.message || json;
    return {
      success: true,
      document: {
        id: uploaded.name || uploadFile.name,
        enquiry_id: enquiryId,
        filename: uploadFile.name,
        content_type: uploadFile.type || 'application/octet-stream',
        storage_path: uploaded.file_url || '',
        wiki_source_page: null,
        markdown_content: null,
        processing_status: 'completed',
        created_at: new Date(),
      },
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to upload document' };
  }
}
