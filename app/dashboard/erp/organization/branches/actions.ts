'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export type ClientSafeBranch = {
  id: string;
  name: string;
  branch: string;
};

// ── List Branches ───────────────────────────────────────────────────────────

export async function listBranches(): Promise<
  { success: true; branches: ClientSafeBranch[] } | { success: false; error: string }
> {
  try {
    const rows = await prisma.branch.findMany({
      orderBy: { name: 'desc' },
      take: 200,
    });

    return {
      success: true,
      branches: rows.map((b) => ({
        id: b.name,
        name: b.name,
        branch: b.branch,
      })),
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Error fetching branches:', msg);
    return { success: false, error: msg || 'Failed to fetch branches' };
  }
}
