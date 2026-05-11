'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface AssetsDashboardData {
  assetCount: number;
  totalValue: number;
  locationCount: number;
}

export interface AssetTrendPoint {
  date: string;
  totalValue: number;
  count: number;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getAssetsDashboardData(): Promise<AssetsDashboardData> {
  try {
    const [assetCount, totalValueResult, locationCount] = await Promise.all([
      prisma.asset.count(),
      prisma.asset.aggregate({ _sum: { value_after_depreciation: true } }).catch(() => ({ _sum: { value_after_depreciation: null } })),
      prisma.asset.groupBy({ by: ['location'] }).then((r) => r.length),
    ]);

    return {
      assetCount,
      totalValue: Number(totalValueResult._sum.value_after_depreciation) || 0,
      locationCount,
    };
  } catch {
    return { assetCount: 0, totalValue: 0, locationCount: 0 };
  }
}

// ── Trends ──────────────────────────────────────────────────────────────────

export async function getAssetTrends(): Promise<AssetTrendPoint[]> {
  // Stub trend data — replace with real time-series query
  return [];
}
