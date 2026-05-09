'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeCostCenter {
  name: string;
  cost_center_name: string;
  cost_center_number: string | null;
  is_group: boolean;
  parent_cost_center: string;
  company: string;
  disabled: boolean;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeCostCenterDetail extends ClientSafeCostCenter {
  lft: number | null;
  rgt: number | null;
  old_parent: string | null;
}

export interface CreateCostCenterInput {
  cost_center_name: string;
  parent_cost_center: string;
  company?: string;
  is_group?: boolean;
  cost_center_number?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listCostCenters(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; costCenters: ClientSafeCostCenter[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { cost_center_name: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [costCenters, total] = await Promise.all([
      prisma.costCenter.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.costCenter.count({ where }),
    ]);

    return {
      success: true,
      total,
      costCenters: costCenters.map((cc) => ({
        name: cc.name,
        cost_center_name: cc.cost_center_name,
        cost_center_number: cc.cost_center_number,
        is_group: cc.is_group || false,
        parent_cost_center: cc.parent_cost_center,
        company: cc.company,
        disabled: cc.disabled || false,
        docstatus: cc.docstatus || 0,
        creation: cc.creation,
      })),
    };
  } catch (error: any) {
    console.error('[cost-centers] listCostCenters failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch cost centers' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getCostCenter(
  id: string
): Promise<{ success: true; costCenter: ClientSafeCostCenterDetail } | { success: false; error: string }> {
  try {
    const cc = await prisma.costCenter.findUnique({ where: { name: id } });
    if (!cc) return { success: false, error: 'Cost Center not found' };

    return {
      success: true,
      costCenter: {
        name: cc.name,
        cost_center_name: cc.cost_center_name,
        cost_center_number: cc.cost_center_number,
        is_group: cc.is_group || false,
        parent_cost_center: cc.parent_cost_center,
        company: cc.company,
        disabled: cc.disabled || false,
        docstatus: cc.docstatus || 0,
        creation: cc.creation,
        lft: cc.lft,
        rgt: cc.rgt,
        old_parent: cc.old_parent,
      },
    };
  } catch (error: any) {
    console.error('[cost-centers] getCostCenter failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch cost center' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createCostCenter(
  data: CreateCostCenterInput
): Promise<{ success: true; costCenter: ClientSafeCostCenter } | { success: false; error: string }> {
  try {
    if (!data.cost_center_name) return { success: false, error: 'Cost center name is required' };
    if (!data.parent_cost_center) return { success: false, error: 'Parent cost center is required' };

    const name = `CC-${Date.now()}`;
    const cc = await prisma.costCenter.create({
      data: {
        name,
        cost_center_name: data.cost_center_name,
        parent_cost_center: data.parent_cost_center,
        company: data.company || 'Aries',
        is_group: data.is_group || false,
        cost_center_number: data.cost_center_number || null,
        docstatus: 0,
      },
    });

    revalidatePath('/dashboard/erp/accounts/cost-centers');
    return {
      success: true,
      costCenter: {
        name: cc.name,
        cost_center_name: cc.cost_center_name,
        cost_center_number: cc.cost_center_number,
        is_group: cc.is_group || false,
        parent_cost_center: cc.parent_cost_center,
        company: cc.company,
        disabled: cc.disabled || false,
        docstatus: cc.docstatus || 0,
        creation: cc.creation,
      },
    };
  } catch (error: any) {
    console.error('[cost-centers] createCostCenter failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create cost center' };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteCostCenter(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await prisma.costCenter.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Cost Center not found' };

    await prisma.costCenter.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/accounts/cost-centers');
    return { success: true };
  } catch (error: any) {
    console.error('[cost-centers] deleteCostCenter failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete cost center' };
  }
}
