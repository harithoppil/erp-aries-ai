'use server';

import { prisma } from '@/lib/prisma';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CustomerInfo {
  customer_name: string;
  industry: string | null;
}

export interface CustomerListResult {
  success: boolean;
  customers: CustomerInfo[];
  error?: string;
}

// ── List Customers ──────────────────────────────────────────────────────────

export async function listCustomers(): Promise<CustomerListResult> {
  try {
    const customers = await prisma.customer.findMany({
      where: { disabled: false },
      select: {
        customer_name: true,
        industry: true,
      },
    });

    return {
      success: true,
      customers: customers.map((c) => ({
        customer_name: c.customer_name,
        industry: c.industry,
      })),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, customers: [], error: msg };
  }
}
