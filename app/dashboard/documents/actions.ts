'use server';

import { prisma } from '@/lib/prisma';

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
    const where = enquiryId ? { enquiry_id: enquiryId } : {};
    const rows = await prisma.documents.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      documents: rows.map((f) => ({
        id: f.id,
        enquiry_id: f.enquiry_id,
        filename: f.filename,
        content_type: f.content_type || 'application/octet-stream',
        storage_path: f.storage_path,
        wiki_source_page: f.wiki_source_page || null,
        markdown_content: f.markdown_content || null,
        processing_status: f.processing_status || 'completed',
        created_at: f.created_at,
      })),
    };
  } catch (error:any) {
    console.error('[documents] listDocuments failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch documents' };
  }
}

export async function uploadDocument(
  enquiryId: string,
  file: File
): Promise<{ success: true; document: ClientSafeDocument } | { success: false; error: string }> {
  try {
    // File upload requires blob storage integration (GCS/Azure Blob).
    // For now, create a document record with a placeholder path.
    const record = await prisma.documents.create({
      data: {
        id: crypto.randomUUID(),
        enquiry_id: enquiryId,
        filename: file.name,
        content_type: file.type || 'application/octet-stream',
        storage_path: `/uploads/${enquiryId}/${file.name}`,
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
  } catch (error:any) {
    console.error('[documents] uploadDocument failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to upload document' };
  }
}

export async function deleteDocument(id: string): Promise<
  { success: true } | { success: false; error: string }
> {
  try {
    await prisma.documents.delete({ where: { id } });
    return { success: true };
  } catch (error:any) {
    return { success: false, error: error?.message || 'Failed to delete document' };
  }
}
