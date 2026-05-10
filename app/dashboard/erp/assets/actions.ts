'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Dashboard Types ─────────────────────────────────────────────────────────

export type AssetsDashboardData = {
  assetCount: number;
  totalValue: number;
  locationCount: number;
};

export type AssetTrendPoint = {
  date: string;
  count: number;
  totalValue: number;
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

export async function getAssetsDashboardData(): Promise<AssetsDashboardData> {
  await requirePermission('Item', 'read');

  const [assetCount, assets] = await Promise.all([
    prisma.asset.count(),
    prisma.asset.findMany({
      select: {
        value_after_depreciation: true,
        location: true,
      },
    }),
  ]);

  const totalValue = assets.reduce(
    (sum, a) => sum + Number(a.value_after_depreciation || 0),
    0,
  );

  const locations = new Set(
    assets.map((a) => a.location).filter(Boolean),
  );

  return {
    assetCount,
    totalValue,
    locationCount: locations.size,
  };
}

// ── Asset Trends (last 12 months) ─────────────────────────────────────────

export async function getAssetTrends(): Promise<AssetTrendPoint[]> {
  await requirePermission('Item', 'read');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const assets = await prisma.asset.findMany({
    where: {
      purchase_date: { gte: twelveMonthsAgo },
    },
    select: {
      purchase_date: true,
      value_after_depreciation: true,
    },
    orderBy: { purchase_date: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { count: number; totalValue: number }>();

  // Initialize last 12 months with zeros
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { count: 0, totalValue: 0 });
  }

  for (const asset of assets) {
    const date = asset.purchase_date
      ? new Date(asset.purchase_date)
      : null;
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.totalValue += Number(asset.value_after_depreciation || 0);
    }
  }

  return Array.from(monthMap.entries()).map(([date, data]) => ({
    date,
    count: data.count,
    totalValue: data.totalValue,
  }));
}

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
