'use server';

import { errorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeFiscalYear {
  name: string;
  year: string;
  disabled: boolean;
  year_start_date: Date;
  year_end_date: Date;
  auto_created: boolean;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeFiscalYearDetail extends ClientSafeFiscalYear {
  is_short_year: boolean;
}

export interface CreateFiscalYearInput {
  year: string;
  year_start_date: string;
  year_end_date: string;
  disabled?: boolean;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listFiscalYears(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; fiscalYears: ClientSafeFiscalYear[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { year: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [fiscalYears, total] = await Promise.all([
      prisma.fiscalYear.findMany({
        where,
        orderBy: { year_start_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.fiscalYear.count({ where }),
    ]);

    return {
      success: true,
      total,
      fiscalYears: fiscalYears.map((fy) => ({
        name: fy.name,
        year: fy.year,
        disabled: fy.disabled || false,
        year_start_date: fy.year_start_date,
        year_end_date: fy.year_end_date,
        auto_created: fy.auto_created || false,
        docstatus: fy.docstatus || 0,
        creation: fy.creation,
      })),
    };
  } catch (error) {
    console.error('[fiscal-years] listFiscalYears failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch fiscal years') };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getFiscalYear(
  id: string
): Promise<{ success: true; fiscalYear: ClientSafeFiscalYearDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "read");
    const fy = await prisma.fiscalYear.findUnique({ where: { name: id } });
    if (!fy) return { success: false, error: 'Fiscal Year not found' };

    return {
      success: true,
      fiscalYear: {
        name: fy.name,
        year: fy.year,
        disabled: fy.disabled || false,
        year_start_date: fy.year_start_date,
        year_end_date: fy.year_end_date,
        auto_created: fy.auto_created || false,
        docstatus: fy.docstatus || 0,
        creation: fy.creation,
        is_short_year: fy.is_short_year || false,
      },
    };
  } catch (error) {
    console.error('[fiscal-years] getFiscalYear failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch fiscal year') };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createFiscalYear(
  data: CreateFiscalYearInput
): Promise<{ success: true; fiscalYear: ClientSafeFiscalYear } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "create");
    if (!data.year) return { success: false, error: 'Year is required' };
    if (!data.year_start_date || !data.year_end_date) return { success: false, error: 'Start and end dates are required' };

    const name = `FY-${Date.now()}`;
    const fy = await prisma.fiscalYear.create({
      data: {
        name,
        year: data.year,
        year_start_date: new Date(data.year_start_date),
        year_end_date: new Date(data.year_end_date),
        disabled: data.disabled || false,
        docstatus: 0,
      },
    });

    revalidatePath('/dashboard/erp/setup/fiscal-years');
    return {
      success: true,
      fiscalYear: {
        name: fy.name,
        year: fy.year,
        disabled: fy.disabled || false,
        year_start_date: fy.year_start_date,
        year_end_date: fy.year_end_date,
        auto_created: fy.auto_created || false,
        docstatus: fy.docstatus || 0,
        creation: fy.creation,
      },
    };
  } catch (error) {
    console.error('[fiscal-years] createFiscalYear failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create fiscal year') };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteFiscalYear(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "delete");
    const existing = await prisma.fiscalYear.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Fiscal Year not found' };
    if (existing.docstatus !== 0) return { success: false, error: 'Only draft fiscal years can be deleted' };

    await prisma.fiscalYear.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/setup/fiscal-years');
    return { success: true };
  } catch (error) {
    console.error('[fiscal-years] deleteFiscalYear failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to delete fiscal year') };
  }
}
