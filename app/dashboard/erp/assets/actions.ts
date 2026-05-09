'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';

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
    const assets = await prisma.assets.findMany({
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    return {
      success: true,
      assets: assets.map((a) => ({
        id: a.id,
        asset_name: a.asset_name,
        asset_code: a.asset_code,
        asset_category: a.asset_category || 'General',
        status: a.status,
        location: a.location,
        warehouse_id: a.warehouse_id,
        purchase_date: a.purchase_date,
        purchase_cost: a.purchase_cost,
        current_value: a.current_value,
        depreciation_rate: a.depreciation_rate,
        calibration_date: a.calibration_date,
        next_calibration_date: a.next_calibration_date,
        calibration_certificate: a.calibration_certificate,
        certification_body: a.certification_body,
        assigned_to_project: a.assigned_to_project,
        assigned_to_personnel: a.assigned_to_personnel,
        notes: a.notes,
        created_at: a.created_at,
        updated_at: a.updated_at,
      })),
    };
  } catch (error:any) {
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
    const asset = await prisma.assets.create({
      data: {
        id: crypto.randomUUID(),
        asset_name: data.asset_name,
        asset_code: data.asset_code || data.asset_name,
        asset_category: data.asset_category || 'General',
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost || null,
        current_value: data.purchase_cost || null,
        depreciation_rate: 0,
        status: 'AVAILABLE',
        location: data.location || null,
        calibration_date: data.calibration_date || null,
        next_calibration_date: data.next_calibration_date || null,
      },
    });
    revalidatePath('/erp/assets');
    return {
      success: true as const,
      asset: {
        id: asset.id,
        asset_name: asset.asset_name,
        asset_code: asset.asset_code,
        asset_category: asset.asset_category || 'General',
        status: asset.status,
        location: asset.location,
        warehouse_id: asset.warehouse_id,
        purchase_date: asset.purchase_date,
        purchase_cost: asset.purchase_cost,
        current_value: asset.current_value,
        depreciation_rate: asset.depreciation_rate,
        calibration_date: asset.calibration_date,
        next_calibration_date: asset.next_calibration_date,
        calibration_certificate: asset.calibration_certificate,
        certification_body: asset.certification_body,
        assigned_to_project: asset.assigned_to_project,
        assigned_to_personnel: asset.assigned_to_personnel,
        notes: asset.notes,
        created_at: asset.created_at,
        updated_at: asset.updated_at,
      } as ClientSafeAsset,
    };
  } catch (error:any) {
    return { success: false as const, error: error?.message || 'Failed to create asset' };
  }
}

export async function listCalibrationDue(): Promise<
  { success: true; assets: ClientSafeAsset[] } | { success: false; error: string }
> {
  try {
    const assets = await prisma.assets.findMany({
      where: {
        status: 'CALIBRATION_DUE',
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    });

    return {
      success: true,
      assets: assets.map((a) => ({
        id: a.id,
        asset_name: a.asset_name,
        asset_code: a.asset_code,
        asset_category: a.asset_category || 'General',
        status: a.status,
        location: a.location,
        warehouse_id: a.warehouse_id,
        purchase_date: a.purchase_date,
        purchase_cost: a.purchase_cost,
        current_value: a.current_value,
        depreciation_rate: a.depreciation_rate,
        calibration_date: a.calibration_date,
        next_calibration_date: a.next_calibration_date,
        calibration_certificate: a.calibration_certificate,
        certification_body: a.certification_body,
        assigned_to_project: a.assigned_to_project,
        assigned_to_personnel: a.assigned_to_personnel,
        notes: a.notes,
        created_at: a.created_at,
        updated_at: a.updated_at,
      })),
    };
  } catch (error:any) {
    console.error('Error fetching calibration due:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch calibration alerts' };
  }
}
