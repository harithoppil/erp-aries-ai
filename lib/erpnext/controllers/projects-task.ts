import { errorMessage } from '@/lib/utils';
/**
 * ERPNext Task DocType — Pure Business Logic (ported from task.py)
 *
 * All functions are pure: they accept plain objects and return
 * updated objects / validation results.  No DB calls.
 */

export interface TaskDependsOn {
  task: string;
  subject?: string | null;
  project?: string | null;
}

export interface Task {
  name: string;
  subject: string;
  project?: string | null;
  status: string;
  priority?: string | null;
  color?: string | null;
  exp_start_date?: Date | string | null;
  exp_end_date?: Date | string | null;
  act_start_date?: Date | string | null;
  act_end_date?: Date | string | null;
  expected_time?: number;
  actual_time?: number;
  progress: number;
  task_weight?: number;
  description?: string | null;
  type?: string | null;
  issue?: string | null;
  is_group?: boolean;
  is_milestone?: boolean;
  is_template?: boolean;
  parent_task?: string | null;
  depends_on?: TaskDependsOn[];
  depends_on_tasks?: string | null;
  template_task?: string | null;
  completed_by?: string | null;
  completed_on?: Date | string | null;
  closing_date?: Date | string | null;
  review_date?: Date | string | null;
  department?: string | null;
  company?: string | null;
  duration?: number;
  start?: number;
  lft?: number;
  rgt?: number;
  old_parent?: string | null;
  total_costing_amount?: number;
  total_billing_amount?: number;
  docstatus: number;
}

export interface Project {
  name: string;
  expected_end_date?: Date | string | null;
}

export interface TaskValidationResult {
  task: Task;
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

function flt(val: number | string | null | undefined): number {
  const num = typeof val === "string" ? parseFloat(val) : val ?? 0;
  return num;
}

function dateDiff(to: Date | string, from_: Date | string): number {
  const t = toDate(to);
  const f = toDate(from_);
  if (!t || !f) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((t.getTime() - f.getTime()) / msPerDay);
}

function addDays(date: Date | string, days: number): Date {
  const d = toDate(date);
  if (!d) throw new Error("Invalid date provided to addDays");
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

function addToDate(date: Date | string, hours: number): Date {
  const d = toDate(date);
  if (!d) throw new Error("Invalid date provided to addToDate");
  const result = new Date(d);
  result.setTime(result.getTime() + hours * 60 * 60 * 1000);
  return result;
}

function formatDate(date: Date | string | null | undefined): string {
  const d = toDate(date);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* ────────────────────────────────────────────────────────────────
   Validation
   ──────────────────────────────────────────────────────────────── */

export function validateTask(
  task: Task,
  parentTask?: Task | null,
  project?: Project | null,
  dependentTaskStatuses?: Record<string, string>
): TaskValidationResult {
  const errors: string[] = [];
  const pushError = (msg: string) => errors.push(msg);

  try {
    validateDates(task, parentTask, project, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateProgress(task, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateStatus(task, dependentTaskStatuses, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateCompletedOn(task, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    setDefaultEndDateIfMissing(task);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  try {
    validateParentIsGroup(task, parentTask, pushError);
  } catch (e) {
    errors.push(errorMessage(e));
  }

  const t = updateDependsOn(task);

  return { task: t, errors };
}

export function validateDates(
  task: Task,
  parentTask?: Task | null,
  project?: Project | null,
  onError?: (msg: string) => void
): void {
  validateFromToDates(task.exp_start_date, task.exp_end_date, onError);
  validateFromToDates(task.act_start_date, task.act_end_date, onError);
  validateParentExpectedEndDate(task, parentTask, onError);
  validateParentProjectDates(task, project, onError);
}

export function validateFromToDates(
  fromDate: Date | string | null | undefined,
  toDateVal: Date | string | null | undefined,
  onError?: (msg: string) => void
): void {
  const f = toDate(fromDate);
  const t = toDate(toDateVal);
  if (f && t && f > t) {
    const msg = "From Date cannot be after To Date";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateParentExpectedEndDate(
  task: Task,
  parentTask?: Task | null,
  onError?: (msg: string) => void
): void {
  if (!task.parent_task || !task.exp_end_date) return;
  if (!parentTask) return;

  const parentExpEnd = toDate(parentTask.exp_end_date);
  const taskExpEnd = toDate(task.exp_end_date);
  if (parentExpEnd && taskExpEnd && taskExpEnd > parentExpEnd) {
    const msg = `Expected End Date should be less than or equal to parent task's Expected End Date ${formatDate(parentExpEnd)}.`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateParentProjectDates(
  task: Task,
  project?: Project | null,
  onError?: (msg: string) => void
): void {
  if (!task.project || !project) return;

  const projectEndDate = toDate(project.expected_end_date);
  if (!projectEndDate) return;

  for (const fieldname of ["exp_start_date", "exp_end_date", "act_start_date", "act_end_date"] as const) {
    const taskDate = toDate(task[fieldname]);
    if (taskDate && dateDiff(projectEndDate, taskDate) < 0) {
      const msg = `Task ${task.name}'s ${fieldname} cannot be after Project ${project.name}'s Expected End Date.`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  }
}

export function validateProgress(task: Task, onError?: (msg: string) => void): void {
  if (flt(task.progress) > 100) {
    const msg = "Progress % for a task cannot be more than 100.";
    if (onError) onError(msg);
    else throw new Error(msg);
  }
  if (task.status === "Completed") {
    task.progress = 100;
  }
}

export function validateStatus(
  task: Task,
  dependentTaskStatuses?: Record<string, string>,
  onError?: (msg: string) => void
): void {
  if (task.is_template && task.status !== "Template") {
    task.status = "Template";
  }
  if (task.status === "Template" && !task.is_template) {
    task.status = "Open";
  }

  if (task.status === "Completed") {
    if (task.depends_on && dependentTaskStatuses) {
      for (const dep of task.depends_on) {
        const depStatus = dependentTaskStatuses[dep.task];
        if (depStatus && depStatus !== "Completed" && depStatus !== "Cancelled") {
          const msg = `Cannot complete task ${task.name} as its dependant task ${dep.task} are not completed / cancelled.`;
          if (onError) onError(msg);
          else throw new Error(msg);
        }
      }
    }
  }
}

export function validateCompletedOn(
  task: Task,
  onError?: (msg: string) => void
): void {
  if (task.completed_on) {
    const completed = toDate(task.completed_on);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (completed && completed > today) {
      const msg = "Completed On cannot be greater than Today";
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  }
}

export function validateParentIsGroup(
  task: Task,
  parentTask?: Task | null,
  onError?: (msg: string) => void
): void {
  if (!task.parent_task) return;
  if (parentTask && !parentTask.is_group) {
    const msg = `Parent Task ${parentTask.name} must be a Group Task`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateDependenciesForTemplateTask(
  task: Task,
  parentTemplateTask?: Task | null,
  dependentTasks?: Record<string, Task>,
  onError?: (msg: string) => void
): void {
  if (!task.is_template) return;
  validateParentTemplateTask(task, parentTemplateTask, onError);
  validateDependsOnTasks(task, dependentTasks, onError);
}

export function validateParentTemplateTask(
  task: Task,
  parentTask?: Task | null,
  onError?: (msg: string) => void
): void {
  if (!task.parent_task) return;
  if (parentTask && !parentTask.is_template) {
    const msg = `Parent Task ${parentTask.name} is not a Template Task`;
    if (onError) onError(msg);
    else throw new Error(msg);
  }
}

export function validateDependsOnTasks(
  task: Task,
  dependentTasks?: Record<string, Task>,
  onError?: (msg: string) => void
): void {
  if (!task.depends_on || !dependentTasks) return;
  for (const dep of task.depends_on) {
    const depTask = dependentTasks[dep.task];
    if (depTask && !depTask.is_template) {
      const msg = `Dependent Task ${dep.task} is not a Template Task`;
      if (onError) onError(msg);
      else throw new Error(msg);
    }
  }
}

/* ────────────────────────────────────────────────────────────────
   Computed updates
   ──────────────────────────────────────────────────────────────── */

export function setDefaultEndDateIfMissing(task: Task): void {
  if (task.exp_start_date && task.expected_time && !task.exp_end_date) {
    task.exp_end_date = addToDate(task.exp_start_date, task.expected_time);
  }
}

export function updateDependsOn(task: Task): Task {
  const t = { ...task };
  let dependsOnTasks = "";
  if (t.depends_on) {
    for (const d of t.depends_on) {
      if (d.task && !dependsOnTasks.includes(d.task)) {
        dependsOnTasks += d.task + ",";
      }
    }
  }
  t.depends_on_tasks = dependsOnTasks;
  return t;
}

/* ────────────────────────────────────────────────────────────────
   Recursion check
   ──────────────────────────────────────────────────────────────── */

export function checkRecursion(
  taskName: string,
  dependsOnMap: Record<string, string[]>,
  parentTaskMap: Record<string, string | null>
): boolean {
  const checkList: Array<["dependsOn", Record<string, string[]>] | ["parent", Record<string, string | null>]> = [
    ["dependsOn", dependsOnMap],
    ["parent", parentTaskMap],
  ];

  for (const [type, map] of checkList) {
    const taskList: string[] = [taskName];
    let count = 0;

    while (taskList.length > count) {
      const current = taskList[count];
      count += 1;

      let nextItems: string[] = [];
      if (type === "dependsOn") {
        nextItems = (map as Record<string, string[]>)[current] ?? [];
      } else {
        const parent = (map as Record<string, string | null>)[current];
        nextItems = parent ? [parent] : [];
      }

      for (const next of nextItems) {
        if (next === taskName) {
          throw new Error("Circular Reference Error");
        }
        if (next && !taskList.includes(next)) {
          taskList.push(next);
        }
      }

      if (count === 15) break;
    }
  }

  return true;
}

/* ────────────────────────────────────────────────────────────────
   Time & Costing
   ──────────────────────────────────────────────────────────────── */

export function updateTimeAndCosting(
  task: Task,
  timesheetDetails: Array<{
    from_time?: Date | string | null;
    to_time?: Date | string | null;
    billing_amount?: number;
    costing_amount?: number;
    base_costing_amount?: number;
    base_billing_amount?: number;
    hours?: number;
    docstatus: number;
    task?: string | null;
  }>
): Task {
  const t = { ...task };
  const approved = timesheetDetails.filter(
    (td) => td.docstatus === 1 && td.task === t.name
  );

  let startDate: Date | null = null;
  let endDate: Date | null = null;
  let totalBilling = 0;
  let totalCosting = 0;
  let totalBaseBilling = 0;
  let totalBaseCosting = 0;
  let totalTime = 0;

  for (const td of approved) {
    const ft = toDate(td.from_time);
    const tt = toDate(td.to_time);
    if (ft && (!startDate || ft < startDate)) startDate = ft;
    if (tt && (!endDate || tt > endDate)) endDate = tt;

    totalBilling += flt(td.billing_amount);
    totalCosting += flt(td.costing_amount);
    totalBaseBilling += flt(td.base_billing_amount ?? td.billing_amount);
    totalBaseCosting += flt(td.base_costing_amount ?? td.costing_amount);
    totalTime += flt(td.hours);
  }

  t.total_costing_amount = totalBaseCosting;
  t.total_billing_amount = totalBaseBilling;
  t.actual_time = totalTime;
  t.act_start_date = startDate ?? t.act_start_date;
  t.act_end_date = endDate ?? t.act_end_date;

  return t;
}

/* ────────────────────────────────────────────────────────────────
   Reschedule dependent tasks
   ──────────────────────────────────────────────────────────────── */

export function rescheduleDependentTasks(
  completedTask: Task,
  dependentTasks: Task[]
): Task[] {
  const endDate = toDate(completedTask.exp_end_date ?? completedTask.act_end_date);
  if (!endDate) return dependentTasks;

  return dependentTasks.map((task) => {
    const t = { ...task };
    const expStart = toDate(t.exp_start_date);
    const expEnd = toDate(t.exp_end_date);

    if (
      expStart &&
      expEnd &&
      expStart < endDate &&
      t.status === "Open"
    ) {
      const duration = dateDiff(expEnd, expStart);
      t.exp_start_date = addDays(endDate, 1);
      t.exp_end_date = addDays(t.exp_start_date, duration);
    }
    return t;
  });
}

/* ────────────────────────────────────────────────────────────────
   Status helpers
   ──────────────────────────────────────────────────────────────── */

export function updateTaskStatus(task: Task): Task {
  const t = { ...task };
  if (t.status !== "Cancelled" && t.status !== "Completed" && t.exp_end_date) {
    const expEnd = toDate(t.exp_end_date);
    if (expEnd && expEnd < new Date()) {
      t.status = "Overdue";
    }
  }
  return t;
}

export function setMultipleStatus(
  tasks: Task[],
  status: string
): Task[] {
  return tasks.map((t) => ({ ...t, status }));
}

export function checkIfChildExists(
  taskName: string,
  allTasks: Task[]
): string[] {
  return allTasks
    .filter((t) => t.parent_task === taskName)
    .map((t) => t.name);
}
