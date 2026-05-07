'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { randomUUID } from 'crypto';

export type ClientSafeMaterialRequest = {
  id: string;
  request_number: string;
  project_id: string | null;
  requested_by: string;
  purpose: string | null;
  status: string;
  created_at: Date;
};

export async function listMaterialRequests(): Promise<
  { success: true; requests: ClientSafeMaterialRequest[] } | { success: false; error: string }
> {
  try {
    const requests = await prisma.material_requests.findMany({ orderBy: { created_at: 'desc' } });
    return { success: true, requests };
  } catch (error) {
    console.error('Error fetching material requests:', error);
    return { success: false, error: 'Failed to fetch material requests' };
  }
}

export async function createMaterialRequest(data: {
  project_id?: string;
  requested_by: string;
  purpose?: string;
}): Promise<
  { success: true; request: ClientSafeMaterialRequest } | { success: false; error: string }
> {
  try {
    const requestNumber = `MR-${randomUUID().slice(0, 8).toUpperCase()}`;
    const request = await prisma.material_requests.create({
      data: {
        id: randomUUID(),
        request_number: requestNumber,
        project_id: data.project_id || null,
        requested_by: data.requested_by,
        purpose: data.purpose || null,
        status: 'pending',
      },
    });
    revalidatePath('/erp/material-requests');
    return { success: true, request };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, error: 'Request number already exists' };
    return { success: false, error: error.message || 'Failed to create material request' };
  }
}
