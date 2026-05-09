'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeMaterialRequest = {
  id: string;
  request_number: string;
  status: string;
  purpose: string | null;
  material_request_type: string;
  requested_by: string | null;
  project_id?: string | null;
  created_at: Date | null;
};

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function listMaterialRequests(): Promise<
  { success: true; requests: ClientSafeMaterialRequest[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Material Request", "read");
    const rows = await prisma.materialRequest.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });

    return {
      success: true,
      requests: rows.map((r) => ({
        id: r.name,
        request_number: r.name,
        status: r.status || 'Draft',
        purpose: r.material_request_type || null,
        material_request_type: r.material_request_type || 'Purchase',
        requested_by: r.owner || null,
        project_id: null,
        created_at: r.creation,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching material requests:', msg);
    return { success: false, error: msg || 'Failed to fetch material requests' };
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
    await requirePermission("Material Request", "create");
    const material_request_type = data.purpose || data.material_request_type || 'Purchase';
    const name = `MR-${Date.now()}`;
    const record = await prisma.materialRequest.create({
      data: {
        name,
        material_request_type,
        company: 'Aries',
        transaction_date: new Date(),
        naming_series: 'MR-',
        status: 'Draft',
        creation: new Date(),
        modified: new Date(),
        owner: data.requested_by || 'Administrator',
        modified_by: data.requested_by || 'Administrator',
      },
    });

    // Create child items if provided
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        await prisma.materialRequestItem.create({
          data: {
            name: `MRI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            parent: name,
            parentfield: 'items',
            parenttype: 'Material Request',
            item_code: item.item_code,
            item_name: item.item_code,
            qty: item.qty,
            uom: 'Nos',
            conversion_factor: 1,
            stock_uom: 'Nos',
            schedule_date: item.schedule_date ? new Date(item.schedule_date) : new Date(),
            creation: new Date(),
            modified: new Date(),
            owner: 'Administrator',
            modified_by: 'Administrator',
          },
        });
      }
    }

    revalidatePath('/erp/material-requests');
    return {
      success: true as const,
      request: {
        id: record.name,
        request_number: record.name,
        status: 'Draft',
        purpose: material_request_type,
        material_request_type,
        requested_by: data.requested_by || null,
        project_id: data.project_id || null,
        created_at: record.creation,
      } as ClientSafeMaterialRequest,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false as const, error: msg || 'Failed to create material request' };
  }
}
