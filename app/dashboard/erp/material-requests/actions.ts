'use server';

import { frappeGetList, frappeGetDoc, frappeInsertDoc } from '@/lib/frappe-client';

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
    const requests = await frappeGetList<any>('Material Request', {
      fields: ['name', 'material_request_type', 'status', 'docstatus', 'schedule_date', 'requested_by', 'creation'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      requests: requests.map((r: any) => ({
        id: r.name,
        request_number: r.name,
        status: r.docstatus === 1 ? 'SUBMITTED' : r.docstatus === 2 ? 'CANCELLED' : 'DRAFT',
        purpose: r.material_request_type || null,
        material_request_type: r.material_request_type || 'Purchase',
        requested_by: r.requested_by || null,
        created_at: r.creation ? new Date(r.creation) : new Date(),
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
    const doc = await frappeInsertDoc<any>('Material Request', {
      material_request_type,
      project: data.project_id || undefined,
      items: (data.items || []).map((i) => ({
        item_code: i.item_code,
        qty: i.qty,
        schedule_date: i.schedule_date || new Date().toISOString().slice(0, 10),
      })),
    });
    return { success: true as const, request: { id: doc.name, request_number: doc.name, status: 'DRAFT', purpose: material_request_type, material_request_type, requested_by: data.requested_by || null, project_id: data.project_id || null, created_at: new Date() } as ClientSafeMaterialRequest };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create material request' };
  }
}
