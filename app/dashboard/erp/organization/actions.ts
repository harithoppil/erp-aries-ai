'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export type OrganizationDashboardData = {
  companyCount: number;
  companies: { name: string; company_name: string; country: string; default_currency: string }[];
};

// ── Dashboard Data ─────────────────────────────────────────────────────────

export async function getOrganizationDashboardData(): Promise<
  { success: true; data: OrganizationDashboardData } | { success: false; error: string }
> {
  try {
    const [companyCount, companies] = await Promise.all([
      prisma.company.count(),
      prisma.company.findMany({
        select: {
          name: true,
          company_name: true,
          country: true,
          default_currency: true,
        },
        take: 10,
        orderBy: { creation: 'desc' },
      }),
    ]);

    return {
      success: true,
      data: {
        companyCount,
        companies: companies.map((c) => ({
          name: c.name,
          company_name: c.company_name,
          country: c.country || '',
          default_currency: c.default_currency || '',
        })),
      },
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[organization] getOrganizationDashboardData failed:', msg);
    return { success: false, error: msg || 'Failed to fetch organization data' };
  }
}
