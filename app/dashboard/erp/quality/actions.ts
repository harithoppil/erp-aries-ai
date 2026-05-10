'use server';

// ── Types ───────────────────────────────────────────────────────────────────

export type QualityDashboardData = {
  inspectionCount: number;
  goalCount: number;
  procedureCount: number;
  reviewCount: number;
};

export type QualityInspectionTrend = {
  date: string;
  count: number;
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

/**
 * Quality module: No Prisma models exist for quality documents yet.
 * All actions return placeholder/mock data so the dashboard renders cleanly
 * with zeros and an empty-state chart.
 */
export async function getQualityDashboardData(): Promise<
  { success: true; data: QualityDashboardData } | { success: false; error: string }
> {
  try {
    // Placeholder — no QualityInspection model in Prisma schema yet
    const data: QualityDashboardData = {
      inspectionCount: 0,
      goalCount: 0,
      procedureCount: 0,
      reviewCount: 0,
    };
    return { success: true, data };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[quality] getQualityDashboardData failed:', msg);
    return { success: false, error: msg || 'Failed to fetch dashboard data' };
  }
}

// ── Quality Inspection Trends (last 12 months) ────────────────────────────

export async function getQualityInspectionTrends(): Promise<
  { success: true; data: QualityInspectionTrend[] } | { success: false; error: string }
> {
  try {
    // Build empty 12-month structure so the chart can render "no data" state
    const monthMap: QualityInspectionTrend[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.push({ date: key, count: 0 });
    }
    return { success: true, data: monthMap };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[quality] getQualityInspectionTrends failed:', msg);
    return { success: false, error: msg || 'Failed to fetch trend data' };
  }
}
