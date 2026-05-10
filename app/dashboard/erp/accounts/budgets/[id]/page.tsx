export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import BudgetDetailClient from './budget-detail-client';

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const b = await prisma.budget.findUnique({ where: { name: id } });
    if (!b) throw new Error('Not found');
    const record = {
      name: b.name, budget_against: b.budget_against, company: b.company,
      cost_center: b.cost_center, project: b.project, account: b.account,
      budget_amount: Number(b.budget_amount), from_fiscal_year: b.from_fiscal_year,
      to_fiscal_year: b.to_fiscal_year, distribute_equally: b.distribute_equally || false,
      docstatus: b.docstatus || 0,
      applicable_on_material_request: b.applicable_on_material_request || false,
      action_if_annual_budget_exceeded_on_mr: b.action_if_annual_budget_exceeded_on_mr || 'Stop',
      applicable_on_purchase_order: b.applicable_on_purchase_order || false,
      action_if_annual_budget_exceeded_on_po: b.action_if_annual_budget_exceeded_on_po || 'Stop',
      applicable_on_booking_actual_expenses: b.applicable_on_booking_actual_expenses || false,
      action_if_annual_budget_exceeded: b.action_if_annual_budget_exceeded || 'Stop',
      distribution_frequency: b.distribution_frequency || 'Monthly',
      budget_start_date: b.budget_start_date, budget_end_date: b.budget_end_date,
    };
    return <BudgetDetailClient record={JSON.parse(JSON.stringify(record))} />;
  } catch { return <div className="p-8 text-center text-muted-foreground">Budget not found</div>; }
}
