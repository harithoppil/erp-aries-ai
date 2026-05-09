'use server';

import { prisma } from '@/lib/prisma';

export type ClientSafeMaterialRequest = {
  id: string;
  request_number: string;
  status: string;
  purpose: string | null;
  material_request_type: string;
  requested_by: string | null;
  project_id?: string | null;
  created_at: Date;
};

export async function listMaterialRequests(): Promise<
  { success: true; requests: ClientSafeMaterialRequest[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.material_requests.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      requests: rows.map((r) => ({
        id: r.id,
        request_number: r.request_number,
        status: r.status || 'DRAFT',
        purpose: r.purpose || r.material_request_type || null,
        material_request_type: r.material_request_type || 'Purchase',
        requested_by: r.requested_by || null,
        project_id: r.project_id || null,
        created_at: r.created_at,
      })),
    };
  } catch (error: any) {
    console.error('Error fetching material requests:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch material requests' };
  }
}

export async function createMaterialRequest(data: {
  material_request_type?: string;
  items?: { item_code: string; qty: number; schedule_date?: string }[];
  requested_by?: string;
  project_id?: string;
  purpose?: string;
}) {
  try {
    const material_request_type = data.purpose || data.material_request_type || 'Purchase';
    const record = await prisma.material_requests.create({
      data: {
        id: crypto.randomUUID(),
        request_number: `MR-${Date.now()}`,
        project_id: data.project_id || null,
        requested_by: data.requested_by || 'Unknown',
        purpose: data.purpose || null,
        material_request_type,
        status: 'DRAFT',
      },
    });

    return {
      success: true as const,
      request: {
        id: record.id,
        request_number: record.request_number,
        status: 'DRAFT',
        purpose: material_request_type,
        material_request_type,
        requested_by: data.requested_by || null,
        project_id: data.project_id || null,
        created_at: record.created_at,
      } as ClientSafeMaterialRequest,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create material request' };
  }
}
