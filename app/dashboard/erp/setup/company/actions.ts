'use server';

import { errorMessage } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requirePermission } from "@/lib/erpnext/rbac";

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeCompany {
  name: string;
  company_name: string;
  abbr: string;
  default_currency: string;
  country: string;
  tax_id: string | null;
  domain: string | null;
  is_group: boolean;
  parent_company: string | null;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeCompanyDetail extends ClientSafeCompany {
  default_finance_book: string | null;
  company_logo: string | null;
  company_description: string | null;
  default_bank_account: string | null;
  default_cash_account: string | null;
  default_receivable_account: string | null;
  default_payable_account: string | null;
  default_expense_account: string | null;
  default_income_account: string | null;
  default_inventory_account: string | null;
  cost_center: string | null;
  phone_no: string | null;
  email: string | null;
  website: string | null;
  date_of_establishment: Date | null;
}

export interface CreateCompanyInput {
  company_name: string;
  abbr: string;
  default_currency: string;
  country: string;
  domain?: string;
  tax_id?: string;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listCompanies(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; companies: ClientSafeCompany[]; total: number } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "read");
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { company_name: { contains: search, mode: 'insensitive' as const } },
            { abbr: { contains: search, mode: 'insensitive' as const } },
            { country: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.company.count({ where }),
    ]);

    return {
      success: true,
      total,
      companies: companies.map((c) => ({
        name: c.name,
        company_name: c.company_name,
        abbr: c.abbr,
        default_currency: c.default_currency,
        country: c.country,
        tax_id: c.tax_id,
        domain: c.domain,
        is_group: c.is_group || false,
        parent_company: c.parent_company,
        docstatus: c.docstatus || 0,
        creation: c.creation,
      })),
    };
  } catch (error) {
    console.error('[company] listCompanies failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch companies') };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getCompany(
  id: string
): Promise<{ success: true; company: ClientSafeCompanyDetail } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "read");
    const company = await prisma.company.findUnique({ where: { name: id } });
    if (!company) return { success: false, error: 'Company not found' };

    return {
      success: true,
      company: {
        name: company.name,
        company_name: company.company_name,
        abbr: company.abbr,
        default_currency: company.default_currency,
        country: company.country,
        tax_id: company.tax_id,
        domain: company.domain,
        is_group: company.is_group || false,
        parent_company: company.parent_company,
        docstatus: company.docstatus || 0,
        creation: company.creation,
        default_finance_book: company.default_finance_book,
        company_logo: company.company_logo,
        company_description: company.company_description,
        default_bank_account: company.default_bank_account,
        default_cash_account: company.default_cash_account,
        default_receivable_account: company.default_receivable_account,
        default_payable_account: company.default_payable_account,
        default_expense_account: company.default_expense_account,
        default_income_account: company.default_income_account,
        default_inventory_account: company.default_inventory_account,
        cost_center: company.cost_center,
        phone_no: company.phone_no,
        email: company.email,
        website: company.website,
        date_of_establishment: company.date_of_establishment,
      },
    };
  } catch (error) {
    console.error('[company] getCompany failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to fetch company') };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createCompany(
  data: CreateCompanyInput
): Promise<{ success: true; company: ClientSafeCompany } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "create");
    if (!data.company_name) return { success: false, error: 'Company name is required' };
    if (!data.abbr) return { success: false, error: 'Abbreviation is required' };

    const name = `CMP-${Date.now()}`;
    const company = await prisma.company.create({
      data: {
        name,
        company_name: data.company_name,
        abbr: data.abbr,
        default_currency: data.default_currency || 'AED',
        country: data.country || 'United Arab Emirates',
        domain: data.domain || null,
        tax_id: data.tax_id || null,
        docstatus: 0,
        monthly_sales_target: 0,
        total_monthly_sales: 0,
        credit_limit: 0,
        lft: 0,
        rgt: 0,
      },
    });

    revalidatePath('/dashboard/erp/setup/company');
    return {
      success: true,
      company: {
        name: company.name,
        company_name: company.company_name,
        abbr: company.abbr,
        default_currency: company.default_currency,
        country: company.country,
        tax_id: company.tax_id,
        domain: company.domain,
        is_group: company.is_group || false,
        parent_company: company.parent_company,
        docstatus: company.docstatus || 0,
        creation: company.creation,
      },
    };
  } catch (error) {
    console.error('[company] createCompany failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to create company') };
  }
}

// ── Update ──────────────────────────────────────────────────────────────────────

export async function updateCompany(
  id: string,
  data: Partial<CreateCompanyInput>
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "update");
    const existing = await prisma.company.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Company not found' };

    await prisma.company.update({
      where: { name: id },
      data: {
        ...(data.company_name && { company_name: data.company_name }),
        ...(data.abbr && { abbr: data.abbr }),
        ...(data.default_currency && { default_currency: data.default_currency }),
        ...(data.country && { country: data.country }),
        ...(data.domain !== undefined && { domain: data.domain || null }),
        ...(data.tax_id !== undefined && { tax_id: data.tax_id || null }),
      },
    });

    revalidatePath('/dashboard/erp/setup/company');
    return { success: true };
  } catch (error) {
    console.error('[company] updateCompany failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to update company') };
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteCompany(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await requirePermission("Company", "delete");
    const existing = await prisma.company.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Company not found' };
    if (existing.docstatus !== 0) return { success: false, error: 'Only draft companies can be deleted' };

    await prisma.company.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/setup/company');
    return { success: true };
  } catch (error) {
    console.error('[company] deleteCompany failed:', errorMessage(error));
    return { success: false, error: errorMessage(error, 'Failed to delete company') };
  }
}
