'use server';

import { revalidatePath } from 'next/cache';
import { frappeGetList, frappeGetDoc, frappeInsertDoc, frappeUpdateDoc, frappeCallMethod } from '@/lib/frappe-client';

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
    const assets = await frappeGetList<any>('Asset', {
      fields: ['name', 'asset_name', 'asset_category', 'status', 'location', 'purchase_date', 'purchase_amount', 'value_after_depreciation', 'calculate_depreciation', 'creation', 'modified'],
      order_by: 'creation desc',
      limit_page_length: 200,
    });

    return {
      success: true,
      assets: assets.map((a: any) => ({
        id: a.name,
        asset_name: a.asset_name || a.name,
        asset_code: a.name,
        asset_category: a.asset_category || 'General',
        status: a.status || 'Draft',
        location: a.location || null,
        warehouse_id: null,
        purchase_date: a.purchase_date ? new Date(a.purchase_date) : null,
        purchase_cost: a.purchase_amount || null,
        current_value: a.value_after_depreciation || null,
        depreciation_rate: 0,
        calibration_date: null,
        next_calibration_date: null,
        calibration_certificate: null,
        certification_body: null,
        assigned_to_project: null,
        assigned_to_personnel: null,
        notes: null,
        created_at: a.creation ? new Date(a.creation) : new Date(),
        updated_at: a.modified ? new Date(a.modified) : new Date(),
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
    const asset = await frappeInsertDoc<any>('Asset', {
      asset_name: data.asset_name,
      asset_category: data.asset_category || 'General',
      purchase_date: data.purchase_date ? data.purchase_date.toISOString().slice(0, 10) : undefined,
      purchase_amount: data.purchase_cost || 0,
      location: data.location || undefined,
    });
    revalidatePath('/erp/assets');
    return {
      success: true as const,
      asset: {
        id: asset.name,
        asset_name: asset.asset_name,
        asset_code: asset.name,
        asset_category: asset.asset_category || 'General',
        status: 'Draft',
        location: data.location || null,
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost || null,
        current_value: null,
        depreciation_rate: 0,
        calibration_date: null,
        next_calibration_date: null,
        calibration_certificate: null,
        certification_body: null,
        assigned_to_project: null,
        assigned_to_personnel: null,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
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
    // In ERPNext, calibration is handled via Asset Maintenance
    const maintenance = await frappeGetList<any>('Asset Maintenance', {
      fields: ['name', 'asset_name', 'asset_category', 'status', 'creation'],
      filters: { status: ['in', ['Overdue', 'Pending']] },
      order_by: 'creation desc',
      limit_page_length: 50,
    });

    return {
      success: true,
      assets: maintenance.map((a: any) => ({
        id: a.name,
        asset_name: a.asset_name || a.name,
        asset_code: a.name,
        asset_category: a.asset_category || 'General',
        status: a.status || 'Pending',
        location: null,
        warehouse_id: null,
        purchase_date: null,
        purchase_cost: null,
        current_value: null,
        depreciation_rate: 0,
        calibration_date: null,
        next_calibration_date: null,
        calibration_certificate: null,
        certification_body: null,
        assigned_to_project: null,
        assigned_to_personnel: null,
        notes: null,
        created_at: a.creation ? new Date(a.creation) : new Date(),
        updated_at: a.creation ? new Date(a.creation) : new Date(),
      })),
    };
  } catch (error: any) {
    console.error('Error fetching calibration due:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch calibration alerts' };
  }
}
