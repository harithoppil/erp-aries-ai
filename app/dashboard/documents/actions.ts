'use server';

import { frappeGetList, frappeGetDoc, frappeUploadFile, frappeInsertDoc, frappeDeleteDoc } from '@/lib/frappe-client';

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

export async function listDocuments(enquiryId?: string): Promise<
  { success: true; documents: ClientSafeDocument[] } | { success: false; error: string }
> {
  try {
    const filters: Record<string, unknown> = {};
    if (enquiryId) {
      filters.attached_to_doctype = 'Opportunity';
      filters.attached_to_name = enquiryId;
    }
    const files = await frappeGetList<any>('File', {
      fields: ['name', 'file_name', 'file_url', 'attached_to_doctype', 'attached_to_name', 'file_type', 'creation'],
      filters,
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      documents: files.map((f: any) => ({
        id: f.name,
        enquiry_id: f.attached_to_name || '',
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
    console.error('[documents] listDocuments failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch documents' };
  }
}

export async function uploadDocument(enquiryId: string, file: File): Promise<
  { success: true; document: ClientSafeDocument } | { success: false; error: string }
> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await frappeUploadFile(buffer, file.name, {
      doctype: 'Opportunity',
      docname: enquiryId,
      is_private: false,
    });

    const uploaded = (result as any).message || result as any;
    return {
      success: true,
      document: {
        id: uploaded.name || file.name,
        enquiry_id: enquiryId,
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        storage_path: uploaded.file_url,
        wiki_source_page: null,
        markdown_content: null,
        processing_status: 'completed',
        created_at: new Date(),
      },
    };
  } catch (error: any) {
    console.error('[documents] uploadDocument failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to upload document' };
  }
}

export async function deleteDocument(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    await frappeDeleteDoc('File', id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to delete document' };
  }
}
