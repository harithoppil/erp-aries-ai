'use server';

import { API_BASE } from '@/lib/api';
import { revalidatePath } from 'next/cache';
import type { EnquiryRead, EnquiryCreate, EnquiryUpdate, DocumentRead } from '@/types/api';

export type EnquiryListResponse =
  | { success: true; enquiries: EnquiryRead[] }
  | { success: false; error: string };

export type EnquiryDetailResponse =
  | { success: true; enquiry: EnquiryRead }
  | { success: false; error: string };

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = typeof err.detail === 'string'
      ? err.detail
      : JSON.stringify(err.detail || err);
    throw new Error(msg || 'API Error');
  }
  return res.json();
}

export async function listEnquiries(status?: string): Promise<EnquiryListResponse> {
  try {
    const path = status ? `/enquiries?status=${encodeURIComponent(status)}` : '/enquiries';
    const enquiries = await apiFetch<EnquiryRead[]>(path);
    return { success: true, enquiries };
  } catch (error: any) {
    console.error('[enquiries] listEnquiries failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch enquiries' };
  }
}

export async function getEnquiry(id: string): Promise<EnquiryDetailResponse> {
  try {
    const enquiry = await apiFetch<EnquiryRead>(`/enquiries/${id}`);
    return { success: true, enquiry };
  } catch (error: any) {
    console.error('[enquiries] getEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch enquiry' };
  }
}

export async function createEnquiry(data: EnquiryCreate): Promise<EnquiryDetailResponse> {
  try {
    const enquiry = await apiFetch<EnquiryRead>('/enquiries/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    revalidatePath('/enquiries');
    return { success: true, enquiry };
  } catch (error: any) {
    console.error('[enquiries] createEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create enquiry' };
  }
}

export async function updateEnquiry(id: string, data: Partial<EnquiryUpdate>): Promise<EnquiryDetailResponse> {
  try {
    const enquiry = await apiFetch<EnquiryRead>(`/enquiries/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${id}`);
    return { success: true, enquiry };
  } catch (error: any) {
    console.error('[enquiries] updateEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update enquiry' };
  }
}

export async function approveEnquiry(id: string, approver: string): Promise<EnquiryDetailResponse> {
  try {
    const enquiry = await apiFetch<EnquiryRead>(`/enquiries/${id}/approve?approver=${encodeURIComponent(approver)}`, {
      method: 'POST',
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${id}`);
    return { success: true, enquiry };
  } catch (error: any) {
    console.error('[enquiries] approveEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to approve enquiry' };
  }
}

export async function runPipeline(enquiryId: string): Promise<{ success: true; result: Record<string, unknown> } | { success: false; error: string }> {
  try {
    const result = await apiFetch<Record<string, unknown>>(`/pipeline/run?enquiry_id=${encodeURIComponent(enquiryId)}`, {
      method: 'POST',
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${enquiryId}`);
    return { success: true, result };
  } catch (error: any) {
    console.error('[enquiries] runPipeline failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to run pipeline' };
  }
}

export async function executeEnquiry(id: string): Promise<{ success: true; result: Record<string, unknown> } | { success: false; error: string }> {
  try {
    const result = await apiFetch<Record<string, unknown>>(`/pipeline/execute/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
    revalidatePath('/enquiries');
    revalidatePath(`/enquiries/${id}`);
    return { success: true, result };
  } catch (error: any) {
    console.error('[enquiries] executeEnquiry failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to execute enquiry' };
  }
}

export async function listEnquiryDocuments(enquiryId: string): Promise<{ success: true; documents: DocumentRead[] } | { success: false; error: string }> {
  try {
    const documents = await apiFetch<DocumentRead[]>(`/documents/${encodeURIComponent(enquiryId)}`);
    return { success: true, documents };
  } catch (error: any) {
    console.error('[enquiries] listDocuments failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch documents' };
  }
}

export async function uploadDocument(enquiryId: string, formData: FormData): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(enquiryId)}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      const msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail || err);
      throw new Error(msg || 'Upload failed');
    }
    revalidatePath(`/enquiries/${enquiryId}`);
    return { success: true };
  } catch (error: any) {
    console.error('[enquiries] uploadDocument failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to upload document' };
  }
}
