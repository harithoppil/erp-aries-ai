'use server';

import { prisma } from '@/lib/prisma';

export type ClientSafeDocument = {
  id: string;
  original_filename: string;
  content_type: string;
  file_size: number;
  processing_status: string;
  doc_type: string;
  auto_detected_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: Date;
  processed_at: Date | null;
};

export async function listDocuments(): Promise<
  { success: true; documents: ClientSafeDocument[] } | { success: false; error: string }
> {
  try {
    const docs = await prisma.uploaded_documents.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        original_filename: true,
        content_type: true,
        file_size: true,
        processing_status: true,
        doc_type: true,
        auto_detected_type: true,
        entity_type: true,
        entity_id: true,
        created_at: true,
        processed_at: true,
      },
    });
    return {
      success: true,
      documents: docs.map((d) => ({
        ...d,
        processing_status: String(d.processing_status),
        doc_type: String(d.doc_type),
      })),
    };
  } catch (error) {
    console.error('Error fetching documents:', error);
    return { success: false, error: 'Failed to fetch documents' };
  }
}

export async function getDocument(
  id: string,
): Promise<
  | {
      success: true;
      document: ClientSafeDocument & {
        extracted_data: string | null;
        gcs_bucket: string;
        gcs_path: string;
        confidence_score: number | null;
        error_message: string | null;
        thumbnail_url: string | null;
      };
    }
  | { success: false; error: string }
> {
  try {
    const doc = await prisma.uploaded_documents.findUnique({ where: { id } });
    if (!doc) return { success: false, error: 'Document not found' };
    return {
      success: true,
      document: {
        id: doc.id,
        original_filename: doc.original_filename,
        content_type: doc.content_type,
        file_size: doc.file_size,
        processing_status: String(doc.processing_status),
        doc_type: String(doc.doc_type),
        auto_detected_type: doc.auto_detected_type,
        entity_type: doc.entity_type,
        entity_id: doc.entity_id,
        created_at: doc.created_at,
        processed_at: doc.processed_at,
        extracted_data: doc.extracted_data,
        gcs_bucket: doc.gcs_bucket,
        gcs_path: doc.gcs_path,
        confidence_score: doc.confidence_score,
        error_message: doc.error_message,
        thumbnail_url: doc.thumbnail_url,
      },
    };
  } catch (error) {
    console.error('Error fetching document:', error);
    return { success: false, error: 'Failed to fetch document' };
  }
}
