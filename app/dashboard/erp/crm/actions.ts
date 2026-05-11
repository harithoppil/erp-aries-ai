'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CRMDashboardData {
  totalLeads: number;
  openOpportunities: number;
  activeContracts: number;
}

export interface LeadConversionTrendPoint {
  date: string;
  leads: number;
  opportunities: number;
}

// ── Dashboard Data ──────────────────────────────────────────────────────────

export async function getCRMDashboardData(): Promise<CRMDashboardData> {
  try {
    const [totalLeads, openOpportunities] = await Promise.all([
      prisma.lead.count(),
      prisma.opportunity.count({
        where: { status: { in: ['Open', 'Qualified', 'Proposal/Price Quote', 'Negotiation'] } },
      }).catch(() => 0),
    ]);

    return {
      totalLeads,
      openOpportunities,
      activeContracts: 0, // Contract model not yet available
    };
  } catch {
    return { totalLeads: 0, openOpportunities: 0, activeContracts: 0 };
  }
}

// ── Trends ──────────────────────────────────────────────────────────────────

export async function getLeadConversionTrends(): Promise<LeadConversionTrendPoint[]> {
  // Stub trend data — replace with real time-series query
  return [];
}
