'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeWarehouse {
  name: string;
  warehouse_name: string;
  warehouse_type: string | null;
  is_group: boolean;
  parent_warehouse: string | null;
  company: string;
  disabled: boolean;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeWarehouseDetail extends ClientSafeWarehouse {
  account: string | null;
  email_id: string | null;
  phone_no: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  pin: string | null;
  is_rejected_warehouse: boolean;
}

export interface CreateWarehouseInput {
  warehouse_name: string;
  warehouse_type?: string;
  parent_warehouse?: string;
  company?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listWarehouses(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; warehouses: ClientSafeWarehouse[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Item", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { warehouse_name: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.warehouse.count({ where }),
    ]);

    return {
      success: true,
      total,
      warehouses: warehouses.map((w) => ({
        name: w.name,
        warehouse_name: w.warehouse_name,
        warehouse_type: w.warehouse_type,
        is_group: w.is_group || false,
        parent_warehouse: w.parent_warehouse,
        company: w.company,
        disabled: w.disabled || false,
        docstatus: w.docstatus || 0,
        creation: w.creation,
      })),
    };
  } catch (error: any) {
    console.error('[warehouses] listWarehouses failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch warehouses' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getWarehouse(
  id: string
): Promise<{ success: true; warehouse: ClientSafeWarehouseDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Item", "read");
    const w = await prisma.warehouse.findUnique({ where: { name: id } });
    if (!w) return { success: false, error: 'Warehouse not found' };

    return {
      success: true,
      warehouse: {
        name: w.name,
        warehouse_name: w.warehouse_name,
        warehouse_type: w.warehouse_type,
        is_group: w.is_group || false,
        parent_warehouse: w.parent_warehouse,
        company: w.company,
        disabled: w.disabled || false,
        docstatus: w.docstatus || 0,
        creation: w.creation,
        account: w.account,
        email_id: w.email_id,
        phone_no: w.phone_no,
        address_line_1: w.address_line_1,
        city: w.city,
        state: w.state,
        pin: w.pin,
        is_rejected_warehouse: w.is_rejected_warehouse || false,
      },
    };
  } catch (error: any) {
    console.error('[warehouses] getWarehouse failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch warehouse' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createWarehouse(
  data: CreateWarehouseInput
): Promise<{ success: true; warehouse: ClientSafeWarehouse } | { success: false; error: string }> {
  try {
    await requirePermission("Item", "create");
    if (!data.warehouse_name) return { success: false, error: 'Warehouse name is required' };

    const name = `WH-${Date.now()}`;
    const w = await prisma.warehouse.create({
      data: {
        name,
        warehouse_name: data.warehouse_name,
        warehouse_type: data.warehouse_type || null,
        parent_warehouse: data.parent_warehouse || null,
        company: data.company || 'Aries',
        docstatus: 0,
      },
    });

    revalidatePath('/dashboard/erp/stock/warehouses');
    return {
      success: true,
      warehouse: {
        name: w.name,
        warehouse_name: w.warehouse_name,
        warehouse_type: w.warehouse_type,
        is_group: w.is_group || false,
        parent_warehouse: w.parent_warehouse,
        company: w.company,
        disabled: w.disabled || false,
        docstatus: w.docstatus || 0,
        creation: w.creation,
      },
    };
  } catch (error: any) {
    console.error('[warehouses] createWarehouse failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create warehouse' };
  }
}

// ── Update ──────────────────────────────────────────────────────────────────────

export async function updateWarehouse(
  id: string,
  data: Partial<CreateWarehouseInput & { disabled?: boolean }>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Item", "update");
    const existing = await prisma.warehouse.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Warehouse not found' };

    await prisma.warehouse.update({
      where: { name: id },
      data: {
        ...(data.warehouse_name && { warehouse_name: data.warehouse_name }),
        ...(data.warehouse_type !== undefined && { warehouse_type: data.warehouse_type || null }),
        ...(data.parent_warehouse !== undefined && { parent_warehouse: data.parent_warehouse || null }),
        ...(data.disabled !== undefined && { disabled: data.disabled }),
      },
    });

    revalidatePath('/dashboard/erp/stock/warehouses');
    return { success: true };
  } catch (error: any) {
    console.error('[warehouses] updateWarehouse failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update warehouse' };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteWarehouse(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Item", "delete");
    const existing = await prisma.warehouse.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Warehouse not found' };

    await prisma.warehouse.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/stock/warehouses');
    return { success: true };
  } catch (error: any) {
    console.error('[warehouses] deleteWarehouse failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete warehouse' };
  }
}
