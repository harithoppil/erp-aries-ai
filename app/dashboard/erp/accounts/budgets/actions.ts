'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { submitDocument, cancelDocument, type SubmitResult, type CancelResult } from '@/lib/erpnext/document-orchestrator';

// ── Client-safe types ──────────────────────────────────────────────────────────

export interface ClientSafeBudget {
  name: string;
  budget_against: string;
  company: string;
  cost_center: string | null;
  project: string | null;
  account: string;
  budget_amount: number;
  from_fiscal_year: string;
  to_fiscal_year: string;
  distribute_equally: boolean;
  docstatus: number;
  creation: Date | null;
}

export interface ClientSafeBudgetDetail extends ClientSafeBudget {
  applicable_on_material_request: boolean;
  action_if_annual_budget_exceeded_on_mr: string;
  applicable_on_purchase_order: boolean;
  action_if_annual_budget_exceeded_on_po: string;
  applicable_on_booking_actual_expenses: boolean;
  action_if_annual_budget_exceeded: string;
  distribution_frequency: string;
  budget_start_date: Date | null;
  budget_end_date: Date | null;
}

export interface CreateBudgetInput {
  budget_against?: string;
  company: string;
  cost_center?: string;
  project?: string;
  account: string;
  budget_amount: number;
  from_fiscal_year: string;
  to_fiscal_year: string;
  distribute_equally?: boolean;
}

// ── List ───────────────────────────────────────────────────────────────────────

export async function listBudgets(
  search?: string,
  page = 1,
  pageSize = 50
): Promise<{ success: true; budgets: ClientSafeBudget[]; total: number } | { success: false; error: string }> {
  try {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { company: { contains: search, mode: 'insensitive' as const } },
            { account: { contains: search, mode: 'insensitive' as const } },
            { cost_center: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [budgets, total] = await Promise.all([
      prisma.budget.findMany({
        where,
        orderBy: { creation: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.budget.count({ where }),
    ]);

    return {
      success: true,
      total,
      budgets: budgets.map((b) => ({
        name: b.name,
        budget_against: b.budget_against,
        company: b.company,
        cost_center: b.cost_center,
        project: b.project,
        account: b.account,
        budget_amount: Number(b.budget_amount),
        from_fiscal_year: b.from_fiscal_year,
        to_fiscal_year: b.to_fiscal_year,
        distribute_equally: b.distribute_equally || false,
        docstatus: b.docstatus || 0,
        creation: b.creation,
      })),
    };
  } catch (error:any) {
    console.error('[budgets] listBudgets failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch budgets' };
  }
}

// ── Get detail ─────────────────────────────────────────────────────────────────

export async function getBudget(
  id: string
): Promise<{ success: true; budget: ClientSafeBudgetDetail } | { success: false; error: string }> {
  try {
    const b = await prisma.budget.findUnique({ where: { name: id } });
    if (!b) return { success: false, error: 'Budget not found' };

    return {
      success: true,
      budget: {
        name: b.name,
        budget_against: b.budget_against,
        company: b.company,
        cost_center: b.cost_center,
        project: b.project,
        account: b.account,
        budget_amount: Number(b.budget_amount),
        from_fiscal_year: b.from_fiscal_year,
        to_fiscal_year: b.to_fiscal_year,
        distribute_equally: b.distribute_equally || false,
        docstatus: b.docstatus || 0,
        creation: b.creation,
        applicable_on_material_request: b.applicable_on_material_request || false,
        action_if_annual_budget_exceeded_on_mr: b.action_if_annual_budget_exceeded_on_mr || 'Stop',
        applicable_on_purchase_order: b.applicable_on_purchase_order || false,
        action_if_annual_budget_exceeded_on_po: b.action_if_annual_budget_exceeded_on_po || 'Stop',
        applicable_on_booking_actual_expenses: b.applicable_on_booking_actual_expenses || false,
        action_if_annual_budget_exceeded: b.action_if_annual_budget_exceeded || 'Stop',
        distribution_frequency: b.distribution_frequency || 'Monthly',
        budget_start_date: b.budget_start_date,
        budget_end_date: b.budget_end_date,
      },
    };
  } catch (error:any) {
    console.error('[budgets] getBudget failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to fetch budget' };
  }
}

// ── Create ──────────────────────────────────────────────────────────────────────

export async function createBudget(
  data: CreateBudgetInput
): Promise<{ success: true; budget: ClientSafeBudget } | { success: false; error: string }> {
  try {
    if (!data.company) return { success: false, error: 'Company is required' };
    if (!data.account) return { success: false, error: 'Account is required' };
    if (!data.budget_amount || data.budget_amount <= 0) return { success: false, error: 'Budget amount must be positive' };
    if (!data.from_fiscal_year || !data.to_fiscal_year) return { success: false, error: 'Fiscal year range is required' };

    const name = `BUDGET-${Date.now()}`;
    const b = await prisma.budget.create({
      data: {
        name,
        budget_against: data.budget_against || 'Cost Center',
        company: data.company,
        cost_center: data.cost_center || null,
        project: data.project || null,
        account: data.account,
        budget_amount: data.budget_amount,
        from_fiscal_year: data.from_fiscal_year,
        to_fiscal_year: data.to_fiscal_year,
        distribute_equally: data.distribute_equally !== undefined ? data.distribute_equally : true,
        docstatus: 0,
      },
    });

    revalidatePath('/dashboard/erp/accounts/budgets');
    return {
      success: true,
      budget: {
        name: b.name,
        budget_against: b.budget_against,
        company: b.company,
        cost_center: b.cost_center,
        project: b.project,
        account: b.account,
        budget_amount: Number(b.budget_amount),
        from_fiscal_year: b.from_fiscal_year,
        to_fiscal_year: b.to_fiscal_year,
        distribute_equally: b.distribute_equally || false,
        docstatus: b.docstatus || 0,
        creation: b.creation,
      },
    };
  } catch (error:any) {
    console.error('[budgets] createBudget failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to create budget' };
  }
}

// ── Submit / Cancel ────────────────────────────────────────────────────────────

export async function submitBudget(id: string): Promise<SubmitResult> {
  const token = (await cookies()).get("token")?.value;
  const result = await submitDocument("Budget", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/accounts/budgets');
  return result;
}

export async function cancelBudget(id: string): Promise<CancelResult> {
  const token = (await cookies()).get("token")?.value;
  const result = await cancelDocument("Budget", id, { token });
  if (result.success) revalidatePath('/dashboard/erp/accounts/budgets');
  return result;
}

// ── Delete ──────────────────────────────────────────────────────────────────────

export async function deleteBudget(
  id: string
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const existing = await prisma.budget.findUnique({ where: { name: id } });
    if (!existing) return { success: false, error: 'Budget not found' };
    if (existing.docstatus !== 0) return { success: false, error: 'Only draft budgets can be deleted' };

    await prisma.budget.delete({ where: { name: id } });
    revalidatePath('/dashboard/erp/accounts/budgets');
    return { success: true };
  } catch (error:any) {
    console.error('[budgets] deleteBudget failed:', error?.message);
    return { success: false, error: error?.message || 'Failed to delete budget' };
  }
}
