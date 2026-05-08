'use server';

import { prisma } from '@/lib/prisma';
import { assetstatus } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { generateId, generateShortCode } from '@/lib/uuid';
import { createAssetSchema } from '@/lib/validators';

export type ClientSafeAsset = {
  id: string;
  asset_name: string;
  asset_code: string;
  asset_category: string;
  status: string;
  location: string | null;
  purchase_date: Date | null;
  purchase_cost: number | null;
  current_value: number | null;
  depreciation_rate: number;
  calibration_date: Date | null;
  next_calibration_date: Date | null;
  created_at: Date;
};

export async function listAssets(params?: {
  search?: string;
  status?: string;
  category?: string;
  from_date?: string;
  to_date?: string;
}): Promise<
  { success: true; assets: ClientSafeAsset[] } | { success: false; error: string }
> {
  try {
    const where: any = {};
    if (params?.search) {
      where.OR = [
        { asset_name: { contains: params.search, mode: 'insensitive' } },
        { asset_code: { contains: params.search, mode: 'insensitive' } },
        { location: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.status) {
      where.status = params.status;
    }
    if (params?.category) {
      where.asset_category = params.category;
    }
    const assets = await prisma.assets.findMany({ where, orderBy: { created_at: 'desc' } });
    return { success: true, assets: assets.map((a) => ({ ...a, status: String(a.status) })) };
  } catch (error) {
    console.error('Error fetching assets:', error);
    return { success: false, error: 'Failed to fetch assets' };
  }
}

export async function createAsset(data: {
  asset_name: string;
  asset_code: string;
  asset_category: string;
  location?: string;
  purchase_date?: Date;
  purchase_cost?: number;
  current_value?: number;
  depreciation_rate?: number;
  calibration_date?: Date;
  next_calibration_date?: Date;
}) {
  // Validate input
  const parsed = createAssetSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues.map(e => e.message).join(', ') };
  }
  const validated = parsed.data;

  try {
    const asset = await prisma.assets.create({
      data: {
        id: generateId(),
        asset_name: validated.asset_name,
        asset_code: validated.asset_code,
        asset_category: validated.asset_category,
        status: assetstatus.AVAILABLE,
        location: validated.location || null,
        purchase_date: data.purchase_date || null,
        purchase_cost: validated.purchase_cost || null,
        current_value: data.current_value || null,
        depreciation_rate: data.depreciation_rate || 0,
        calibration_date: validated.calibration_date || null,
        next_calibration_date: validated.next_calibration_date || null,
      }
    });
    revalidatePath('/erp/assets');
    return { success: true as const, asset: { ...asset, status: String(asset.status) } as ClientSafeAsset };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false as const, error: 'Asset code already exists' };
    return { success: false as const, error: 'Failed to create asset' };
  }
}

export async function listCalibrationDue(): Promise<
  { success: true; assets: ClientSafeAsset[] } | { success: false; error: string }
> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 30);
    const assets = await prisma.assets.findMany({
      where: {
        next_calibration_date: { lte: cutoff },
        status: { not: 'DECOMMISSIONED' },
      },
      orderBy: { next_calibration_date: 'asc' },
    });
    return { success: true, assets: assets.map(a => ({ ...a, status: String(a.status) })) };
  } catch (error) {
    console.error('Error fetching calibration due:', error);
    return { success: false, error: 'Failed to fetch calibration due assets' };
  }
}

// ── Asset Mutations ────────────────────────────────────────────────────────

export async function updateAssetStatus(id: string, status: assetstatus) {
  try {
    const record = await prisma.assets.update({
      where: { id },
      data: { status },
    });
    revalidatePath('/erp/assets');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[assets] updateAssetStatus failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update asset status' };
  }
}

export async function updateAsset(
  id: string,
  data: Partial<{
    asset_name: string;
    asset_category: string;
    location: string;
    purchase_cost: number;
    current_value: number;
    depreciation_rate: number;
    calibration_date: Date;
    next_calibration_date: Date;
    calibration_certificate: string;
    certification_body: string;
    assigned_to_project: string;
    assigned_to_personnel: string;
    notes: string;
  }>
) {
  try {
    const record = await prisma.assets.update({
      where: { id },
      data,
    });
    revalidatePath('/erp/assets');
    return { success: true, data: record };
  } catch (error: any) {
    console.error('[assets] updateAsset failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to update asset' };
  }
}

export async function deleteAsset(id: string) {
  try {
    await prisma.assets.update({
      where: { id },
      data: { status: assetstatus.DECOMMISSIONED },
    });
    revalidatePath('/erp/assets');
    return { success: true };
  } catch (error: any) {
    console.error('[assets] deleteAsset failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete asset' };
  }
}
