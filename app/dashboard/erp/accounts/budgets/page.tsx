import { listBudgets, type ClientSafeBudget } from './actions';

export const dynamic = 'force-dynamic';
import BudgetsClient from './budgets-client';

export default async function BudgetsPage() {
  const result = await listBudgets();
  const budgets = result.success ? result.budgets : [];
  return <BudgetsClient initialRecords={JSON.parse(JSON.stringify(budgets))} />;
}
