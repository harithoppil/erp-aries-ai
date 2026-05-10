'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/erpnext/rbac';

// ── Types ───────────────────────────────────────────────────────────────────

export type CRMDashboardData = {
  totalLeads: number;
  openOpportunities: number;
  activeContracts: number;
};

export type LeadConversionTrendPoint = {
  date: string;
  leads: number;
  opportunities: number;
};

// ── Dashboard KPI ──────────────────────────────────────────────────────────

export async function getCRMDashboardData(): Promise<CRMDashboardData> {
  await requirePermission('Lead', 'read');
  const [totalLeads, openOpportunities, activeContracts] = await Promise.all([
    prisma.lead.count(),
    prisma.opportunity.count({ where: { status: { notIn: ['Closed', 'Lost'] } } }),
    prisma.contract.count({ where: { status: 'Active' } }),
  ]);
  return { totalLeads, openOpportunities, activeContracts };
}

// ── Lead Conversion Trends (last 12 months) ───────────────────────────────

export async function getLeadConversionTrends(): Promise<LeadConversionTrendPoint[]> {
  await requirePermission('Lead', 'read');

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [leads, opportunities] = await Promise.all([
    prisma.lead.findMany({
      where: { creation: { gte: twelveMonthsAgo } },
      select: { creation: true },
      orderBy: { creation: 'asc' },
    }),
    prisma.opportunity.findMany({
      where: { creation: { gte: twelveMonthsAgo } },
      select: { creation: true },
      orderBy: { creation: 'asc' },
    }),
  ]);

  // Group by month
  const monthMap = new Map<string, { leads: number; opportunities: number }>();

  // Initialize last 12 months with zeros
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, { leads: 0, opportunities: 0 });
  }

  for (const lead of leads) {
    const date = lead.creation ? new Date(lead.creation) : null;
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.leads += 1;
    }
  }

  for (const opp of opportunities) {
    const date = opp.creation ? new Date(opp.creation) : null;
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const existing = monthMap.get(key);
    if (existing) {
      existing.opportunities += 1;
    }
  }

  return Array.from(monthMap.entries()).map(([date, data]) => ({
    date,
    leads: data.leads,
    opportunities: data.opportunities,
  }));
}
