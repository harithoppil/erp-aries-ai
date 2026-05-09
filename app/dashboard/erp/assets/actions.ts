'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

export type ClientSafeAsset = {
  id: string;
  asset_name: string;
  asset_code: string;
  asset_category: string;
  status: string;
  location: string | null;
  warehouse_id: string | null;
  purchase_date: Date | null;
  purchase_cost: number | null;
  current_value: number | null;
  depreciation_rate: number;
  calibration_date: Date | null;
  next_calibration_date: Date | null;
  calibration_certificate: string | null;
  certification_body: string | null;
  assigned_to_project: string | null;
  assigned_to_personnel: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

export async function listAssets(): Promise<
  { success: true; assets: ClientSafeAsset[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Item", "read");
    const assets = await prisma.asset.findMany({
      orderBy: { creation: 'desc' },
      take: 200,
    });
    return {
      success: true,
      assets: assets.map((a) => ({
        id: a.name,
        asset_name: a.asset_name,
        asset_code: a.item_code || a.name,
        asset_category: a.asset_category || 'General',
        status: a.status || 'Draft',
        location: a.location || null,
        warehouse_id: null,
        purchase_date: a.purchase_date,
        purchase_cost: a.purchase_amount ? Number(a.purchase_amount) : null,
        current_value: a.value_after_depreciation ? Number(a.value_after_depreciation) : null,
        depreciation_rate: 0,
        calibration_date: null,
        next_calibration_date: a.next_depreciation_date,
        calibration_certificate: null,
        certification_body: null,
        assigned_to_project: null,
        assigned_to_personnel: a.custodian || null,
        notes: null,
        created_at: a.creation || new Date(),
        updated_at: a.modified || new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching assets:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch assets' };
  }
}

export async function createAsset(data: {
  asset_name: string;
  asset_code?: string;
  asset_category?: string;
  purchase_date?: Date;
  purchase_cost?: number;
  location?: string;
  calibration_date?: Date;
  next_calibration_date?: Date;
}) {
  try {
    await requirePermission("Item", "create");
    const name = `AST-${Date.now()}`;
    const asset = await prisma.asset.create({
      data: {
        name,
        asset_name: data.asset_name,
        item_code: data.asset_code || data.asset_name,
        asset_category: data.asset_category || 'General',
        company: 'Aries',
        purchase_date: data.purchase_date || new Date(),
        purchase_amount: data.purchase_cost || 0,
        location: data.location || '',
        status: 'Draft',
        creation: new Date(),
        modified: new Date(),
        owner: 'Administrator',
        modified_by: 'Administrator',
      },
    });
    revalidatePath('/erp/assets');
    return {
      success: true as const,
      asset: {
        id: asset.name,
        asset_name: asset.asset_name,
        asset_code: asset.item_code || asset.name,
        asset_category: asset.asset_category || 'General',
        status: asset.status || 'Draft',
        location: asset.location || null,
        warehouse_id: null,
        purchase_date: asset.purchase_date,
        purchase_cost: asset.purchase_amount ? Number(asset.purchase_amount) : null,
        current_value: null,
        depreciation_rate: 0,
        calibration_date: null,
        next_calibration_date: asset.next_depreciation_date,
        calibration_certificate: null,
        certification_body: null,
        assigned_to_project: null,
        assigned_to_personnel: asset.custodian || null,
        notes: null,
        created_at: asset.creation || new Date(),
        updated_at: asset.modified || new Date(),
      } as ClientSafeAsset,
    };
  } catch (error: any) {
    return { success: false as const, error: error?.message || 'Failed to create asset' };
  }
}

export async function listCalibrationDue(): Promise<
  { success: true; assets: ClientSafeAsset[] } | { success: false; error: string }
> {
  try {
    await requirePermission("Item", "read");
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const assets = await prisma.asset.findMany({
      where: {
        next_depreciation_date: { lte: thirtyDaysFromNow },
        status: { not: 'Scrapped' },
      },
      orderBy: { creation: 'desc' },
      take: 50,
    });
    return {
      success: true,
      assets: assets.map((a) => ({
        id: a.name,
        asset_name: a.asset_name,
        asset_code: a.item_code || a.name,
        asset_category: a.asset_category || 'General',
        status: a.status || 'Draft',
        location: a.location || null,
        warehouse_id: null,
        purchase_date: a.purchase_date,
        purchase_cost: a.purchase_amount ? Number(a.purchase_amount) : null,
        current_value: a.value_after_depreciation ? Number(a.value_after_depreciation) : null,
        depreciation_rate: 0,
        calibration_date: null,
        next_calibration_date: a.next_depreciation_date,
        calibration_certificate: null,
        certification_body: null,
        assigned_to_project: null,
        assigned_to_personnel: a.custodian || null,
        notes: null,
        created_at: a.creation || new Date(),
        updated_at: a.modified || new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching calibration due:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch calibration alerts' };
  }
}
