import { errorMessage } from '@/lib/utils';
/**
 * ERPNext Project DocType — Pure Business Logic (ported from project.py)
 *
 * All functions are pure: they accept plain objects and return
 * updated objects / validation results.  No DB calls.
 */

export interface ProjectUser {
  user: string;
  email?: string;
  full_name?: string;
  image?: string;
  welcome_email_sent?: boolean;
  project_status?: string;
}

export interface Project {
  name: string;
  project_name: string;
  status: "Open" | "Completed" | "Cancelled";
  percent_complete_method: "Manual" | "Task Completion" | "Task Progress" | "Task Weight" | "";
  percent_complete: number;
  total_costing_amount: number;
  total_billable_amount: number;
  total_billed_amount: number;
  total_purchase_cost: number;
  total_sales_amount: number;
  total_consumed_material_cost: number;
  gross_margin: number;
  per_gross_margin: number;
  actual_time: number;
  actual_start_date?: Date | string | null;
  actual_end_date?: Date | string | null;
  estimated_costing: number;
  expected_start_date?: Date | string | null;
  expected_end_date?: Date | string | null;
  company: string;
  holiday_list?: string | null;
  project_template?: string | null;
  project_type?: string | null;
  sales_order?: string | null;
  copied_from?: string | null;
  is_active?: string | null;
  priority?: string | null;
  collect_progress?: boolean;
  frequency?: string | null;
  users?: ProjectUser[];
  docstatus: number;
  // Raw date strings from Prisma come through as strings
}

export interface Task {
  name: string;
  project?: string | null;
  status: string;
  progress: number;
  task_weight: number;
  subject?: string;
  description?: string | null;
  type?: string | null;
  issue?: string | null;
  is_group?: boolean;
  color?: string | null;
  template_task?: string | null;
  priority?: string | null;
  parent_task?: string | null;
  depends_on?: TaskDependsOn[];
  exp_start_date?: Date | string | null;
  exp_end_date?: Date | string | null;
  start?: number;
  duration?: number;
  docstatus: number;
}

export interface TaskDependsOn {
  task: string;
  subject?: string | null;
  project?: string | null;
}

export interface TimesheetDetail {
  project?: string | null;
  costing_amount?: number;
  billing_amount?: number;
  base_costing_amount?: number;
  base_billing_amount?: number;
  hours?: number;
  from_time?: Date | string | null;
  to_time?: Date | string | null;
  docstatus: number;
}

export interface ProjectValidationResult {
  project: Project;
  errors: string[];
}

/* ────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────── */

function toDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function flt(val: number | string | null | undefined, precision?: number): number {
  const num = typeof val === "string" ? parseFloat(val) : val ?? 0;
  if (precision !== undefined) {
    return parseFloat(num.toFixed(precision));
  }
  return num;
}

function addDays(date: Date | string, days: number): Date {
  const d = toDate(date);
  if (!d) throw new Error("Invalid date provided to addDays");
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

/* ────────────────────────────────────────────────────────────────
   Validation
   ──────────────────────────────────────────────────────────────── */

export function validateProject(
  project: Project,
  tasks: Task[],
  timesheetDetails: TimesheetDetail[],
  purchaseCost?: number,
  salesAmount?: number,
  billedAmount?: number
): ProjectValidationResult {
  const errors: string[] = [];

  try {
    validateFromToDates(project.expected_start_date, project.expected_end_date);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateFromToDates(project.actual_start_date, project.actual_end_date);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  const updated = updatePercentComplete({ ...project }, tasks);
  const costed = updateCosting(
    updated,
    timesheetDetails,
    purchaseCost ?? 0,
    salesAmount ?? 0,
    billedAmount ?? 0
  );

  return { project: costed, errors };
}

export function validateFromToDates(
  fromDate: Date | string | null | undefined,
  toDateVal: Date | string | null | undefined
): void {
  const f = toDate(fromDate);
  const t = toDate(toDateVal);
  if (f && t && f > t) {
    throw new Error("From Date cannot be after To Date");
  }
}

/* ────────────────────────────────────────────────────────────────
   Percent Complete
   ──────────────────────────────────────────────────────────────── */

export function updatePercentComplete(project: Project, tasks: Task[]): Project {
  const p = { ...project };

  if (p.status === "Completed") {
    if (tasks.length === 0) {
      p.percent_complete_method = "Manual";
      p.percent_complete = 100;
      return p;
    }
    if (p.percent_complete_method === "Manual") {
      p.percent_complete = 100;
      return p;
    }
  }

  if (p.percent_complete_method === "Manual") {
    if (p.status === "Completed") {
      p.percent_complete = 100;
    }
    return p;
  }

  const total = tasks.length;
  if (!total) {
    p.percent_complete = 0;
  } else {
    const method = p.percent_complete_method || "Task Completion";

    if (method === "Task Completion") {
      const completed = tasks.filter((t) => t.status === "Cancelled" || t.status === "Completed").length;
      p.percent_complete = flt((completed / total) * 100, 2);
    } else if (method === "Task Progress") {
      const progressSum = tasks.reduce((sum, t) => sum + flt(t.progress), 0);
      p.percent_complete = flt(progressSum / total, 2);
    } else if (method === "Task Weight") {
      const weightSum = tasks.reduce((sum, t) => sum + flt(t.task_weight), 0);
      const weightedProgress = tasks.reduce(
        (sum, t) => sum + flt(t.progress) * safeDiv(flt(t.task_weight), weightSum),
        0
      );
      p.percent_complete = flt(weightedProgress, 2);
    }
  }

  if (p.status !== "Cancelled") {
    p.status = p.percent_complete === 100 ? "Completed" : "Open";
  }

  return p;
}

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/* ────────────────────────────────────────────────────────────────
   Costing
   ──────────────────────────────────────────────────────────────── */

export function updateCosting(
  project: Project,
  timesheetDetails: TimesheetDetail[],
  purchaseCost: number,
  salesAmount: number,
  billedAmount: number
): Project {
  const p = { ...project };
  const approved = timesheetDetails.filter((td) => td.docstatus === 1 && td.project === p.name);

  let totalCosting = 0;
  let totalBillable = 0;
  let totalTime = 0;
  let minStart: Date | null = null;
  let maxEnd: Date | null = null;

  for (const td of approved) {
    totalCosting += flt(td.base_costing_amount ?? td.costing_amount);
    totalBillable += flt(td.base_billing_amount ?? td.billing_amount);
    totalTime += flt(td.hours);

    const fromTime = toDate(td.from_time);
    const toTime = toDate(td.to_time);
    if (fromTime && (!minStart || fromTime < minStart)) minStart = fromTime;
    if (toTime && (!maxEnd || toTime > maxEnd)) maxEnd = toTime;
  }

  p.actual_start_date = minStart ?? p.actual_start_date;
  p.actual_end_date = maxEnd ?? p.actual_end_date;
  p.total_costing_amount = totalCosting;
  p.total_billable_amount = totalBillable;
  p.actual_time = totalTime;
  p.total_purchase_cost = purchaseCost;
  p.total_sales_amount = salesAmount;
  p.total_billed_amount = billedAmount;

  return calculateGrossMargin(p);
}

export function calculateGrossMargin(project: Project): Project {
  const p = { ...project };
  const expense =
    flt(p.total_costing_amount) +
    flt(p.total_purchase_cost) +
    flt(p.total_consumed_material_cost);

  p.gross_margin = flt(p.total_billed_amount) - expense;
  p.per_gross_margin = p.total_billed_amount
    ? (p.gross_margin / flt(p.total_billed_amount)) * 100
    : 0;

  return p;
}

/* ────────────────────────────────────────────────────────────────
   Template → Tasks
   ──────────────────────────────────────────────────────────────── */

export function createTasksFromTemplate(
  templateTasks: Task[],
  project: Project,
  holidays?: Set<string>
): Task[] {
  const p = { ...project };
  if (!p.expected_start_date) {
    p.expected_start_date = new Date().toISOString().split("T")[0];
  }

  const projectTasks: Task[] = [];

  for (const tt of templateTasks) {
    const startDate = calculateStartDate(p.expected_start_date, tt.start ?? 0, holidays);
    const endDate = calculateEndDate(startDate, tt.duration ?? 0, holidays);

    projectTasks.push({
      ...tt,
      name: `TASK-${Math.random().toString(36).substring(2, 10)}`, // caller should replace with real PK
      project: p.name,
      status: "Open",
      exp_start_date: startDate,
      exp_end_date: endDate,
      template_task: tt.name,
      docstatus: 0,
      depends_on: [],
    });
  }

  mapDependencies(templateTasks, projectTasks);

  return projectTasks;
}

export function calculateStartDate(
  expectedStartDate: Date | string | null | undefined,
  taskStartOffset: number,
  holidays?: Set<string>
): Date {
  if (!expectedStartDate) throw new Error("expected_start_date is required");
  let date = addDays(expectedStartDate, taskStartOffset);
  if (holidays) {
    date = updateIfHoliday(date, holidays);
  }
  return date;
}

export function calculateEndDate(
  startDate: Date | string,
  duration: number,
  holidays?: Set<string>
): Date {
  let date = addDays(startDate, duration);
  if (holidays) {
    date = updateIfHoliday(date, holidays);
  }
  return date;
}

export function updateIfHoliday(date: Date, holidays: Set<string>): Date {
  let d = new Date(date);
  const iso = d.toISOString().split("T")[0];
  while (holidays.has(iso)) {
    d = addDays(d, 1);
  }
  return d;
}

export function mapDependencies(templateTasks: Task[], projectTasks: Task[]): void {
  const templateMap = new Map<string, Task>();
  for (const tt of templateTasks) {
    templateMap.set(tt.name, tt);
  }

  const projectTemplateMap = new Map<string, Task>();
  for (const pt of projectTasks) {
    if (pt.template_task) {
      projectTemplateMap.set(pt.template_task, pt);
    }
  }

  for (const projectTask of projectTasks) {
    if (!projectTask.template_task) continue;
    const templateTask = templateMap.get(projectTask.template_task);
    if (!templateTask) continue;

    // Map depends_on
    if (templateTask.depends_on && templateTask.depends_on.length > 0) {
      if (!projectTask.depends_on) projectTask.depends_on = [];
      for (const dep of templateTask.depends_on) {
        const mapped = projectTemplateMap.get(dep.task);
        if (mapped && !projectTask.depends_on.find((d) => d.task === mapped.name)) {
          projectTask.depends_on.push({
            task: mapped.name,
            subject: mapped.subject,
            project: mapped.project,
          });
        }
      }
    }

    // Map parent_task
    if (templateTask.parent_task) {
      const parentProjectTask = projectTemplateMap.get(templateTask.parent_task);
      if (parentProjectTask) {
        projectTask.parent_task = parentProjectTask.name;
      }
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   Status helpers
   ──────────────────────────────────────────────────────────────── */

export function setProjectStatus(project: Project, status: "Completed" | "Cancelled"): Project {
  if (status !== "Completed" && status !== "Cancelled") {
    throw new Error("Status must be Cancelled or Completed");
  }
  return { ...project, status };
}

export function validateDuplicateProjectName(
  newName: string,
  previousName: string
): void {
  if (newName === previousName) {
    throw new Error("Use a name that is different from previous project name");
  }
}

export function getHolidayList(
  company: string | null | undefined,
  companyDefaultHolidayList?: string | null
): string {
  if (companyDefaultHolidayList) return companyDefaultHolidayList;
  if (!company) throw new Error("Company is required to determine Holiday List");
  throw new Error(`Please set a default Holiday List for Company ${company}`);
}

export function calculateTotalPurchaseCost(purchaseInvoiceItemsNetAmount: number[]): number {
  return purchaseInvoiceItemsNetAmount.reduce((sum, amt) => sum + flt(amt), 0);
}
