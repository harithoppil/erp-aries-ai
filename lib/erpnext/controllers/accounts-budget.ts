/**
 * accounts-budget.ts
 * Ported business logic from ERPNext accounts/doctype/budget/budget.py
 * Pure validation & calculation functions — NO database calls.
 */

export type BudgetAction = "" | "Stop" | "Warn" | "Ignore";
export type BudgetAgainst = "" | "Cost Center" | "Project";
export type DistributionFrequency = "Monthly" | "Quarterly" | "Half-Yearly" | "Yearly";

export interface BudgetDistributionRow {
  idx: number;
  start_date?: string;
  end_date?: string;
  percent?: number;
  amount?: number;
}

export interface Budget {
  name?: string;
  budget_against: BudgetAgainst;
  cost_center?: string;
  project?: string;
  account: string;
  company: string;
  from_fiscal_year: string;
  to_fiscal_year: string;
  budget_start_date?: string;
  budget_end_date?: string;
  budget_amount: number;
  budget_distribution: BudgetDistributionRow[];
  budget_distribution_total?: number;
  distribute_equally: boolean;
  distribution_frequency: DistributionFrequency;
  applicable_on_booking_actual_expenses: boolean;
  applicable_on_cumulative_expense: boolean;
  applicable_on_material_request: boolean;
  applicable_on_purchase_order: boolean;
  action_if_annual_budget_exceeded: BudgetAction;
  action_if_accumulated_monthly_budget_exceeded: BudgetAction;
  action_if_annual_budget_exceeded_on_mr: BudgetAction;
  action_if_accumulated_monthly_budget_exceeded_on_mr: BudgetAction;
  action_if_annual_budget_exceeded_on_po: BudgetAction;
  action_if_accumulated_monthly_budget_exceeded_on_po: BudgetAction;
  action_if_annual_exceeded_on_cumulative_expense: BudgetAction;
  action_if_accumulated_monthly_exceeded_on_cumulative_expense: BudgetAction;
  revision_of?: string;
  docstatus: number;
}

export interface FiscalYear {
  name: string;
  year_start_date?: string;
  year_end_date?: string;
  linked_companies?: string[];
}

export interface AccountDetails {
  is_group: boolean;
  company: string;
  report_type: string;
}

export interface ExistingBudget {
  name: string;
  account: string;
  budget_start_date?: string;
  budget_end_date?: string;
}

export interface ExpenseParams {
  company: string;
  account: string;
  budget_start_date?: string;
  budget_end_date?: string;
  budget_against_field?: string;
  budget_against_doctype?: string;
  cost_center?: string;
  project?: string;
  posting_date?: string;
  month_end_date?: string;
  is_tree?: boolean;
  lft?: number;
  rgt?: number;
  from_fiscal_year?: string;
  to_fiscal_year?: string;
  fiscal_year?: string;
  item_code?: string;
  expense_account?: string;
  doctype?: string;
}

export interface BudgetRecord {
  name: string;
  budget_against: string;
  budget_amount: number;
  from_fiscal_year: string;
  to_fiscal_year: string;
  budget_start_date: string;
  budget_end_date: string;
  for_material_request: boolean;
  for_purchase_order: boolean;
  for_actual_expenses: boolean;
  action_if_annual_budget_exceeded: BudgetAction;
  action_if_accumulated_monthly_budget_exceeded: BudgetAction;
  action_if_annual_budget_exceeded_on_mr: BudgetAction;
  action_if_accumulated_monthly_budget_exceeded_on_mr: BudgetAction;
  action_if_annual_budget_exceeded_on_po: BudgetAction;
  action_if_accumulated_monthly_budget_exceeded_on_po: BudgetAction;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface BudgetPeriod {
  start_date: Date;
  end_date: Date;
}

export interface DistributionResult {
  rows: BudgetDistributionRow[];
  total: number;
}

/* ── Helpers ─────────────────────────────────────────────── */

function flt(value: number | string | undefined | null, precision?: number): number {
  const num = parseFloat(String(value ?? 0));
  if (precision !== undefined) {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
  }
  return num;
}

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function getFirstDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getLastDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function scrub(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "_");
}

function unscrub(text: string): string {
  return text
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* ── Validation Functions ────────────────────────────────── */

export function validateBudget(
  budget: Budget,
  accountDetails: AccountDetails,
  fiscalYears: Record<string, FiscalYear>,
  existingBudgets: ExistingBudget[],
  actualExpense: number,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // validate budget against field
  const budgetAgainstField = scrub(budget.budget_against);
  const budgetAgainstValue = budget[budgetAgainstField as keyof Budget] as string | undefined;
  if (!budgetAgainstValue) {
    errors.push(`${budget.budget_against} is mandatory`);
  }

  // validate_budget_amount
  if (budget.budget_amount <= 0) {
    errors.push(`Budget Amount can not be ${budget.budget_amount}.`);
  }

  // validate_fiscal_year
  if (budget.from_fiscal_year) {
    const fromYear = fiscalYears[budget.from_fiscal_year];
    if (fromYear) {
      const linkedCompanies = fromYear.linked_companies ?? [];
      if (linkedCompanies.length > 0 && !linkedCompanies.includes(budget.company)) {
        errors.push(`Fiscal Year ${budget.from_fiscal_year} is not available for Company ${budget.company}.`);
      }
    }
  }

  if (budget.to_fiscal_year) {
    const toYear = fiscalYears[budget.to_fiscal_year];
    if (toYear) {
      const linkedCompanies = toYear.linked_companies ?? [];
      if (linkedCompanies.length > 0 && !linkedCompanies.includes(budget.company)) {
        errors.push(`Fiscal Year ${budget.to_fiscal_year} is not available for Company ${budget.company}.`);
      }
    }
  }

  // set_fiscal_year_dates (caller should set, but we validate)
  const fromStart = budget.budget_start_date ? getdate(budget.budget_start_date) : undefined;
  const toEnd = budget.budget_end_date ? getdate(budget.budget_end_date) : undefined;
  if (fromStart && toEnd && fromStart > toEnd) {
    errors.push("From Fiscal Year cannot be greater than To Fiscal Year");
  }

  // validate_duplicate
  if (budget.account) {
    const overlapping = existingBudgets.some((eb) => {
      const ebStart = eb.budget_start_date ? getdate(eb.budget_start_date) : undefined;
      const ebEnd = eb.budget_end_date ? getdate(eb.budget_end_date) : undefined;
      if (!ebStart || !ebEnd || !toEnd || !fromStart) return false;
      return ebStart <= toEnd && ebEnd >= fromStart;
    });

    if (overlapping) {
      const existing = existingBudgets[0];
      errors.push(
        `Another Budget record '${existing.name}' already exists against ${budget.budget_against} '${budgetAgainstValue}' and account '${existing.account}' with overlapping fiscal years.`,
      );
    }
  }

  // validate_account
  if (!budget.account) {
    errors.push("Account is mandatory");
  } else {
    if (accountDetails.is_group) {
      errors.push(`Budget cannot be assigned against Group Account ${budget.account}`);
    } else if (accountDetails.company !== budget.company) {
      errors.push(`Account ${budget.account} does not belong to company ${budget.company}`);
    } else if (accountDetails.report_type !== "Profit and Loss") {
      errors.push(
        `Budget cannot be assigned against ${budget.account}, as it's not an Income or Expense account`,
      );
    }
  }

  // validate_applicable_for
  if (budget.applicable_on_material_request && !(budget.applicable_on_purchase_order && budget.applicable_on_booking_actual_expenses)) {
    errors.push("Please enable Applicable on Purchase Order and Applicable on Booking Actual Expenses");
  } else if (budget.applicable_on_purchase_order && !budget.applicable_on_booking_actual_expenses) {
    errors.push("Please enable Applicable on Booking Actual Expenses");
  } else if (!(budget.applicable_on_material_request || budget.applicable_on_purchase_order || budget.applicable_on_booking_actual_expenses)) {
    // auto-enable handled by caller
  }

  // validate_existing_expenses
  if (!budget.revision_of && actualExpense > budget.budget_amount) {
    errors.push(
      `Spending for Account ${budget.account} (${budget.company}) between ${budget.budget_start_date} and ${budget.budget_end_date} has already exceeded the new allocated budget. Spent: ${actualExpense.toFixed(2)}, Budget: ${budget.budget_amount.toFixed(2)}`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateDistributionTotals(budget: Budget): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const totalAmount = budget.budget_distribution.reduce((sum, d) => sum + flt(d.amount), 0);
  const totalPercent = budget.budget_distribution.reduce((sum, d) => sum + flt(d.percent), 0);

  if (flt(Math.abs(totalAmount - budget.budget_amount), 2) > 0.1) {
    errors.push(
      `Total distributed amount ${totalAmount.toFixed(2)} must be equal to Budget Amount ${budget.budget_amount}`,
    );
  }

  if (flt(Math.abs(totalPercent - 100), 2) > 0.1) {
    errors.push(
      `Total distribution percent must equal 100 (currently ${totalPercent.toFixed(2)})`,
    );
  }

  return { valid: errors.length === 0, errors, warnings };
}

/* ── Budget Allocation ───────────────────────────────────── */

export function allocateBudget(
  budget: Budget,
  oldBudget?: Budget,
): DistributionResult {
  if (shouldSkipAllocation(budget)) {
    return { rows: budget.budget_distribution, total: budget.budget_distribution_total ?? 0 };
  }

  if (shouldRecalculateManualDistribution(budget, oldBudget)) {
    const rows = budget.budget_distribution.map((row) => ({
      ...row,
      amount: flt((flt(row.percent) / 100) * budget.budget_amount, 3),
    }));
    return { rows, total: rows.reduce((sum, r) => sum + flt(r.amount), 0) };
  }

  if (!shouldRegenerateBudgetDistribution(budget, oldBudget)) {
    return { rows: budget.budget_distribution, total: budget.budget_distribution_total ?? 0 };
  }

  return regenerateDistribution(budget);
}

export function shouldSkipAllocation(budget: Budget): boolean {
  return !!budget.revision_of && !budget.distribute_equally;
}

export function shouldRecalculateManualDistribution(
  budget: Budget,
  oldBudget?: Budget,
): boolean {
  return (
    !budget.distribute_equally &&
    budget.budget_distribution.length > 0 &&
    isOnlyBudgetAmountChanged(budget, oldBudget)
  );
}

export function isOnlyBudgetAmountChanged(budget: Budget, oldBudget?: Budget): boolean {
  if (!oldBudget) return false;
  return (
    oldBudget.budget_amount !== budget.budget_amount &&
    oldBudget.distribution_frequency === budget.distribution_frequency &&
    oldBudget.budget_start_date === budget.budget_start_date &&
    oldBudget.budget_end_date === budget.budget_end_date
  );
}

export function shouldRegenerateBudgetDistribution(
  budget: Budget,
  oldBudget?: Budget,
): boolean {
  if (!oldBudget || budget.budget_distribution.length === 0) return true;

  const changedFields: (keyof Budget)[] = [
    "from_fiscal_year",
    "to_fiscal_year",
    "budget_amount",
    "distribution_frequency",
  ];
  for (const field of changedFields) {
    if (oldBudget[field] !== budget[field]) return true;
  }

  return budget.distribute_equally;
}

export function regenerateDistribution(budget: Budget): DistributionResult {
  const periods = getBudgetPeriods(budget);
  const totalPeriods = periods.length;
  const rowPercent = totalPeriods ? 100 / totalPeriods : 0;

  const rows: BudgetDistributionRow[] = periods.map((period, idx) => ({
    idx: idx + 1,
    start_date: period.start_date.toISOString().split("T")[0],
    end_date: period.end_date.toISOString().split("T")[0],
    amount: flt(budget.budget_amount * rowPercent / 100, 3),
    percent: flt(rowPercent, 3),
  }));

  return { rows, total: budget.budget_amount };
}

export function getBudgetPeriods(budget: Budget): BudgetPeriod[] {
  const frequency = budget.distribution_frequency;
  const periods: BudgetPeriod[] = [];

  let startDate = getdate(budget.budget_start_date);
  const endDate = getdate(budget.budget_end_date);

  while (startDate <= endDate) {
    const periodStart = getFirstDay(startDate);
    let periodEnd = getPeriodEnd(periodStart, frequency);
    if (periodEnd > endDate) {
      periodEnd = endDate;
    }

    periods.push({ start_date: periodStart, end_date: periodEnd });
    startDate = addMonths(periodStart, getMonthIncrement(frequency));
  }

  return periods;
}

export function getPeriodEnd(startDate: Date, frequency: DistributionFrequency): Date {
  switch (frequency) {
    case "Monthly":
      return getLastDay(startDate);
    case "Quarterly":
      return getLastDay(addMonths(startDate, 2));
    case "Half-Yearly":
      return getLastDay(addMonths(startDate, 5));
    case "Yearly":
      return getLastDay(addMonths(startDate, 11));
    default:
      return getLastDay(startDate);
  }
}

export function getMonthIncrement(frequency: DistributionFrequency): number {
  switch (frequency) {
    case "Monthly":
      return 1;
    case "Quarterly":
      return 3;
    case "Half-Yearly":
      return 6;
    case "Yearly":
      return 12;
    default:
      return 1;
  }
}

/* ── Expense Validation ──────────────────────────────────── */

export interface ValidateExpenseResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ExpenseCheckParams {
  company: string;
  posting_date: string;
  account?: string;
  expense_account?: string;
  cost_center?: string;
  project?: string;
  item_code?: string;
  fiscal_year?: string;
  doctype?: string;
  budgetRecords?: BudgetRecord[];
  actualExpense?: number;
  requestedAmount?: number;
  orderedAmount?: number;
  monthlyBudget?: number;
}

export function validateExpenseAgainstBudget(
  params: ExpenseCheckParams,
): ValidateExpenseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!params.account) {
    params.account = params.expense_account;
  }
  if (!params.expense_account && params.account) {
    params.expense_account = params.account;
  }

  if (!params.account) {
    return { valid: true, errors, warnings };
  }

  // Check default dimensions
  const dimensions = [
    { fieldname: "project", doctype: "Project" },
    { fieldname: "cost_center", doctype: "Cost Center" },
  ];

  for (const dimension of dimensions) {
    const budgetAgainst = dimension.fieldname;
    const value = params[budgetAgainst as keyof ExpenseCheckParams] as string | undefined;

    if (value && params.account) {
      const relevantBudgets = (params.budgetRecords ?? []).filter(
        (br) => br.budget_against === value,
      );

      for (const budget of relevantBudgets) {
        if (flt(budget.budget_amount)) {
          const { yearlyAction, monthlyAction } = getActions(params, budget);

          if (yearlyAction === "Stop" || yearlyAction === "Warn") {
            const result = compareExpenseWithBudget(
              params,
              budget.budget_amount,
              "Annual",
              yearlyAction,
              budget.budget_against,
              params.actualExpense ?? 0,
            );
            if (!result.valid) {
              if (yearlyAction === "Stop") errors.push(...result.messages);
              else warnings.push(...result.messages);
            }
          }

          if (monthlyAction === "Stop" || monthlyAction === "Warn") {
            const budgetAmount = params.monthlyBudget ?? 0;
            const result = compareExpenseWithBudget(
              params,
              budgetAmount,
              "Accumulated Monthly",
              monthlyAction,
              budget.budget_against,
              params.actualExpense ?? 0,
            );
            if (!result.valid) {
              if (monthlyAction === "Stop") errors.push(...result.messages);
              else warnings.push(...result.messages);
            }
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function getActions(
  params: ExpenseCheckParams,
  budget: BudgetRecord,
): { yearlyAction: BudgetAction; monthlyAction: BudgetAction } {
  let yearlyAction: BudgetAction = budget.action_if_annual_budget_exceeded;
  let monthlyAction: BudgetAction = budget.action_if_accumulated_monthly_budget_exceeded;

  if (params.doctype === "Material Request" && budget.for_material_request) {
    yearlyAction = budget.action_if_annual_budget_exceeded_on_mr;
    monthlyAction = budget.action_if_accumulated_monthly_budget_exceeded_on_mr;
  } else if (params.doctype === "Purchase Order" && budget.for_purchase_order) {
    yearlyAction = budget.action_if_annual_budget_exceeded_on_po;
    monthlyAction = budget.action_if_accumulated_monthly_budget_exceeded_on_po;
  }

  return { yearlyAction, monthlyAction };
}

export interface CompareResult {
  valid: boolean;
  messages: string[];
}

export function compareExpenseWithBudget(
  params: ExpenseCheckParams,
  budgetAmount: number,
  actionFor: string,
  action: BudgetAction,
  budgetAgainst: string,
  amount = 0,
): CompareResult {
  const actualExpense = params.actualExpense ?? 0;
  const requestedAmount = params.requestedAmount ?? 0;
  const orderedAmount = params.orderedAmount ?? 0;

  if (!amount) {
    if (params.doctype === "Material Request" && params.budgetRecords?.some((b) => b.for_material_request)) {
      amount = requestedAmount + orderedAmount;
    } else if (params.doctype === "Purchase Order" && params.budgetRecords?.some((b) => b.for_purchase_order)) {
      amount = orderedAmount;
    }
  }

  const totalExpense = actualExpense + amount;

  if (totalExpense > budgetAmount) {
    let diff: number;
    let msg: string;

    if (actualExpense > budgetAmount) {
      diff = actualExpense - budgetAmount;
      msg = `${actionFor} Budget for Account ${params.account} against ${unscrub(params.cost_center ? "cost_center" : "project")} ${budgetAgainst} is ${budgetAmount.toFixed(2)}. It is already exceeded by ${diff.toFixed(2)}.`;
    } else {
      diff = totalExpense - budgetAmount;
      msg = `${actionFor} Budget for Account ${params.account} against ${unscrub(params.cost_center ? "cost_center" : "project")} ${budgetAgainst} is ${budgetAmount.toFixed(2)}. It will be exceeded by ${diff.toFixed(2)}.`;
    }

    return { valid: false, messages: [msg] };
  }

  return { valid: true, messages: [] };
}

/* ── Actual Expense Helpers ──────────────────────────────── */

export function getActualExpense(
  params: ExpenseParams,
  glEntries: Array<{
    debit: number;
    credit: number;
    posting_date: string;
    account: string;
    company: string;
    cost_center?: string;
    project?: string;
  }>,
): number {
  const budgetAgainstField = params.budget_against_field || "cost_center";
  const budgetStart = params.budget_start_date ? getdate(params.budget_start_date) : undefined;
  const budgetEnd = params.budget_end_date ? getdate(params.budget_end_date) : undefined;

  const filtered = glEntries.filter((gle) => {
    if (gle.account !== params.account) return false;
    if (gle.company !== params.company) return false;

    const postingDate = getdate(gle.posting_date);
    if (budgetStart && postingDate < budgetStart) return false;
    if (budgetEnd && postingDate > budgetEnd) return false;
    if (params.month_end_date && postingDate > getdate(params.month_end_date)) return false;

    if (!params.is_tree) {
      const fieldValue = gle[budgetAgainstField as keyof typeof gle];
      if (fieldValue !== params[budgetAgainstField as keyof ExpenseParams]) return false;
    }

    return true;
  });

  return flt(
    filtered.reduce((sum, gle) => sum + flt(gle.debit) - flt(gle.credit), 0),
  );
}

export function getAccumulatedMonthlyBudget(
  budgetDistribution: BudgetDistributionRow[],
  postingDateStr: string,
): number {
  const postingDate = getdate(postingDateStr);
  const relevant = budgetDistribution.filter(
    (bd) => bd.start_date && getdate(bd.start_date) <= postingDate,
  );
  return flt(relevant.reduce((sum, bd) => sum + flt(bd.amount), 0));
}

/* ── Item Details Helpers ────────────────────────────────── */

export interface ItemDefaultDetails {
  buying_cost_center?: string;
  expense_account?: string;
}

export function getItemDetails(
  itemDefaults: ItemDefaultDetails,
  companyDefaults?: { cost_center?: string; default_expense_account?: string },
): { cost_center: string | null; expense_account: string | null } {
  let costCenter: string | null = itemDefaults.buying_cost_center ?? null;
  let expenseAccount: string | null = itemDefaults.expense_account ?? null;

  if (!costCenter && companyDefaults?.cost_center) {
    costCenter = companyDefaults.cost_center;
  }
  if (!expenseAccount && companyDefaults?.default_expense_account) {
    expenseAccount = companyDefaults.default_expense_account;
  }

  return { cost_center: costCenter, expense_account: expenseAccount };
}

/* ── Fiscal Year Helpers ─────────────────────────────────── */

export function getFiscalYearDateRange(
  fromFiscalYear: FiscalYear,
  toFiscalYear: FiscalYear,
): { yearStartDate: Date; yearEndDate: Date } {
  return {
    yearStartDate: getdate(fromFiscalYear.year_start_date),
    yearEndDate: getdate(toFiscalYear.year_end_date),
  };
}

/* ── Revise Budget ───────────────────────────────────────── */

export interface RevisedBudget {
  original_name: string;
  revision_of: string;
  docstatus: number;
}

export function reviseBudget(original: Budget): RevisedBudget {
  return {
    original_name: original.name || "",
    revision_of: original.name || "",
    docstatus: 0,
  };
}

/* ── Set Null Value ──────────────────────────────────────── */

export function setNullValue(budget: Budget): Pick<Budget, "cost_center" | "project"> {
  if (budget.budget_against === "Cost Center") {
    return { cost_center: budget.cost_center, project: undefined };
  }
  return { cost_center: undefined, project: budget.project };
}
