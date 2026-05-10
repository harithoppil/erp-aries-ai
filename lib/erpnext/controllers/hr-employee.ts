/**
 * Ported from erpnext/setup/doctype/employee/employee.py
 * Pure validation logic for Employee master.
 *
 * RULES:
 * - No DB calls (Frappe or Prisma). All required data must be passed as params.
 * - Every function has explicit params and return types.
 * - No `any` types except `catch (error)`.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EmployeeEducation {
  school_univ?: string;
  qualification?: string;
  level?: string;
  year_of_passing?: number;
  class_per?: string;
  maj_opt_subj?: string;
  idx: number;
}

export interface EmployeeExternalWorkHistory {
  company_name?: string;
  designation?: string;
  salary?: number;
  address?: string;
  contact?: string;
  total_experience?: string;
  idx: number;
}

export interface EmployeeInternalWorkHistory {
  branch?: string;
  department?: string;
  designation?: string;
  from_date?: string;
  to_date?: string;
  idx: number;
}

export interface EmployeeDoc {
  name?: string;
  employee?: string | null;
  employee_number?: string | null;
  naming_series?: string | null;
  first_name: string;
  middle_name?: string | null;
  last_name?: string | null;
  employee_name?: string | null;
  gender: string;
  date_of_birth: string;
  date_of_joining: string;
  status: "Active" | "Inactive" | "Suspended" | "Left";
  company: string;
  department?: string | null;
  designation?: string | null;
  branch?: string | null;
  reports_to?: string | null;
  company_email?: string | null;
  personal_email?: string | null;
  prefered_contact_email?: "Company Email" | "Personal Email" | "User ID" | "";
  prefered_email?: string | null;
  cell_number?: string | null;
  emergency_phone_number?: string | null;
  user_id?: string | null;
  create_user_automatically?: boolean;
  create_user_permission?: boolean;
  ctc?: number;
  salary_currency?: string | null;
  salary_mode?: "Bank" | "Cash" | "Cheque" | "";
  holiday_list?: string | null;
  notice_number_of_days?: number;
  date_of_retirement?: string | null;
  relieving_date?: string | null;
  resignation_letter_date?: string | null;
  contract_end_date?: string | null;
  final_confirmation_date?: string | null;
  scheduled_confirmation_date?: string | null;
  encashment_date?: string | null;
  leave_encashed?: "Yes" | "No" | "";
  blood_group?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "";
  marital_status?: "Single" | "Married" | "Divorced" | "Widowed" | "";
  salutation?: string | null;
  passport_number?: string | null;
  date_of_issue?: string | null;
  place_of_issue?: string | null;
  valid_upto?: string | null;
  current_address?: string | null;
  permanent_address?: string | null;
  current_accommodation_type?: "Rented" | "Owned" | "";
  permanent_accommodation_type?: "Rented" | "Owned" | "";
  bank_name?: string | null;
  bank_ac_no?: string | null;
  iban?: string | null;
  bio?: string | null;
  health_details?: string | null;
  family_background?: string | null;
  feedback?: string | null;
  reason_for_leaving?: string | null;
  new_workplace?: string | null;
  person_to_be_contacted?: string | null;
  relation?: string | null;
  image?: string | null;
  unsubscribed?: boolean;
  attendance_device_id?: string | null;
  held_on?: string | null;
  lft?: number;
  rgt?: number;
  old_parent?: string | null;
  education?: EmployeeEducation[];
  external_work_history?: EmployeeExternalWorkHistory[];
  internal_work_history?: EmployeeInternalWorkHistory[];
}

export interface ValidationResult {
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface ContactDetails {
  contact_display: string | null;
  contact_email: string | null;
  contact_mobile: string | null;
  contact_designation: string | null;
  contact_department: string | null;
}

export interface EmployeeTreeNode {
  value: string;
  title: string;
  expandable: number;
}

export interface EmployeeUserData {
  email: string;
  enabled: number;
  first_name: string;
  middle_name: string;
  last_name: string;
  gender: string | null;
  birth_date: string | null;
  phone: string | null;
  bio: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getdate(dateStr?: string): Date {
  return dateStr ? new Date(dateStr) : new Date();
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function cint(value: unknown): number {
  return Number(value) || 0;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ------------------------------------------------------------------ */
/*  Name & Email                                                       */
/* ------------------------------------------------------------------ */

/** Build employee_name from first/middle/last names. */
export function setEmployeeName(doc: Pick<EmployeeDoc, "first_name" | "middle_name" | "last_name">): string {
  const parts = [doc.first_name, doc.middle_name, doc.last_name].filter((p): p is string => !!p);
  return parts.join(" ");
}

/** Basic email validation. */
export function validateEmail(email?: string | null): string | null {
  if (!email) return null;
  if (!EMAIL_REGEX.test(email)) {
    return `Email address ${email} is not valid`;
  }
  return null;
}

/** Derive preferred_email field value from prefered_contact_email selection. */
export function setPreferredEmail(
  doc: Pick<EmployeeDoc, "prefered_contact_email" | "company_email" | "personal_email" | "user_id">
): string | null {
  const fieldMap: Record<string, string | null | undefined> = {
    "company_email": doc.company_email,
    "personal_email": doc.personal_email,
    "user_id": doc.user_id,
  };
  const key = doc.prefered_contact_email?.toLowerCase().replace(/\s+/g, "_");
  if (!key) return null;
  return fieldMap[key] ?? null;
}

/** Validate that the field corresponding to prefered_contact_email is populated. */
export function validatePreferredEmail(
  doc: Pick<EmployeeDoc, "prefered_contact_email" | "company_email" | "personal_email" | "user_id">
): string | null {
  if (!doc.prefered_contact_email) return null;
  const fieldMap: Record<string, string | null | undefined> = {
    "Company Email": doc.company_email,
    "Personal Email": doc.personal_email,
    "User ID": doc.user_id,
  };
  if (!fieldMap[doc.prefered_contact_email]) {
    return `Please enter ${doc.prefered_contact_email}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Date validations                                                   */
/* ------------------------------------------------------------------ */

/** Validate date constraints for employee lifecycle. */
export function validateDate(doc: Pick<EmployeeDoc, "date_of_birth" | "date_of_joining" | "date_of_retirement" | "relieving_date" | "contract_end_date">): string | null {
  const todayStr = fmtDate(new Date());

  if (doc.date_of_birth && doc.date_of_birth > todayStr) {
    return "Date of Birth cannot be greater than today.";
  }

  const fromToErrors = validateFromToDates(doc.date_of_birth, doc.date_of_joining, "Date of Birth", "Date of Joining");
  if (fromToErrors) return fromToErrors;

  const retErrors = validateFromToDates(doc.date_of_joining, doc.date_of_retirement ?? undefined, "Date of Joining", "Date of Retirement");
  if (retErrors) return retErrors;

  const relErrors = validateFromToDates(doc.date_of_joining, doc.relieving_date ?? undefined, "Date of Joining", "Relieving Date");
  if (relErrors) return relErrors;

  const contractErrors = validateFromToDates(doc.date_of_joining, doc.contract_end_date ?? undefined, "Date of Joining", "Contract End Date");
  if (contractErrors) return contractErrors;

  return null;
}

function validateFromToDates(fromDate: string | undefined, toDate: string | undefined, fromLabel: string, toLabel: string): string | null {
  if (fromDate && toDate && getdate(fromDate) > getdate(toDate)) {
    return `${fromLabel} cannot be greater than ${toLabel}`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Status & Hierarchy                                                 */
/* ------------------------------------------------------------------ */

/** Validate status transitions and constraints. */
export function validateStatus(
  doc: Pick<EmployeeDoc, "status" | "employee_name" | "relieving_date">,
  activeSubordinates: { name: string; employee_name: string }[]
): string | null {
  const validStatuses: string[] = ["Active", "Inactive", "Suspended", "Left"];
  if (!validStatuses.includes(doc.status)) {
    return `Status must be one of ${validStatuses.join(", ")}`;
  }

  if (doc.status === "Left") {
    if (activeSubordinates.length > 0) {
      const names = activeSubordinates.map((e) => e.employee_name).join(", ");
      return `The following employees are currently still reporting to ${doc.employee_name}: ${names}. Please make sure the employees above report to another Active employee.`;
    }
    if (!doc.relieving_date) {
      return "Please enter relieving date.";
    }
  }

  return null;
}

/** Validate reports_to self-reference. */
export function validateReportsTo(reportsTo: string | undefined, employeeName: string): string | null {
  if (reportsTo && reportsTo === employeeName) {
    return "Employee cannot report to himself.";
  }
  return null;
}

/** Validate that at least one email is present when auto user creation is enabled. */
export function validateAutoUserCreation(
  doc: Pick<EmployeeDoc, "create_user_automatically" | "prefered_email" | "company_email" | "personal_email">
): string | null {
  if (
    doc.create_user_automatically &&
    !(doc.prefered_email || doc.company_email || doc.personal_email)
  ) {
    return "Company or Personal Email is mandatory when 'Create User Automatically' is enabled";
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  User linkage                                                       */
/* ------------------------------------------------------------------ */

/** Validate user details linked to employee. */
export function validateUserDetails(
  userId: string | undefined,
  userEnabled: boolean | undefined,
  employeeStatus: string
): string | null {
  if (!userId) return null;

  const err = validateForEnabledUserId(userId, userEnabled, employeeStatus);
  if (err) return err;

  return null;
}

/** Validate that enabled state of user matches employee status. */
export function validateForEnabledUserId(
  userId: string,
  enabled: boolean | undefined,
  employeeStatus: string
): string | null {
  if (enabled === undefined || enabled === null) {
    return `User ${userId} does not exist`;
  }

  const enabledNum = enabled ? 1 : 0;
  const statusActive = employeeStatus === "Active";

  if ((!statusActive && enabledNum === 1) || (statusActive && enabledNum === 0)) {
    // In original Python this toggles the user; in pure logic we return an advisory message.
    return `User ${userId} enabled state (${enabledNum}) does not match employee status (${employeeStatus}). Consider toggling user enabled state.`;
  }

  return null;
}

/** Validate that user_id is not already assigned to another active employee. */
export function validateDuplicateUserId(
  userId: string,
  employeeName: string,
  activeEmployeesWithSameUser: string[]
): string | null {
  const others = activeEmployeesWithSameUser.filter((n) => n !== employeeName);
  if (others.length > 0) {
    return `User ${userId} is already assigned to Employee ${others[0]}`;
  }
  return null;
}

/** Build user data payload from employee record. */
export function buildUserFromEmployee(doc: EmployeeDoc): EmployeeUserData | null {
  const email = doc.prefered_email || doc.company_email || doc.personal_email;
  if (!email) return null;

  const nameParts = (doc.employee_name || setEmployeeName(doc)).split(" ");
  const firstName = nameParts[0];
  let middleName = "";
  let lastName = "";

  if (nameParts.length >= 3) {
    middleName = nameParts[1];
    lastName = nameParts.slice(2).join(" ");
  } else if (nameParts.length === 2) {
    lastName = nameParts[1];
  }

  return {
    email,
    enabled: 1,
    first_name: firstName,
    middle_name: middleName,
    last_name: lastName,
    gender: doc.gender || null,
    birth_date: doc.date_of_birth || null,
    phone: doc.cell_number || null,
    bio: doc.bio || null,
  };
}

/* ------------------------------------------------------------------ */
/*  Contact / Email helpers                                            */
/* ------------------------------------------------------------------ */

/** Get best available email for an employee. */
export function getEmployeeEmail(doc: Pick<EmployeeDoc, "user_id" | "personal_email" | "company_email">): string | null {
  return doc.user_id || doc.personal_email || doc.company_email || null;
}

/** Get structured contact details for an employee. */
export function getContactDetails(doc: Pick<EmployeeDoc, "employee_name" | "prefered_email" | "company_email" | "personal_email" | "user_id" | "cell_number" | "designation" | "department">): ContactDetails {
  const employeeEmail = doc.prefered_email || doc.company_email || doc.personal_email || doc.user_id || null;

  return {
    contact_display: doc.employee_name || null,
    contact_email: employeeEmail,
    contact_mobile: doc.cell_number || null,
    contact_designation: doc.designation || null,
    contact_department: doc.department || null,
  };
}

/* ------------------------------------------------------------------ */
/*  Holiday helpers                                                    */
/* ------------------------------------------------------------------ */

/** Resolve holiday list for an employee. */
export function getHolidayListForEmployee(
  employeeHolidayList: string | undefined,
  employeeCompany: string | undefined,
  companyDefaultHolidayList: string | undefined
): string | null {
  if (employeeHolidayList) return employeeHolidayList;
  if (companyDefaultHolidayList) return companyDefaultHolidayList;
  return null;
}

/** Check if a given date is in the holiday list. */
export function isHoliday(holidayDates: string[], checkDate?: string): boolean {
  const date = checkDate || fmtDate(new Date());
  return holidayDates.includes(date);
}

/* ------------------------------------------------------------------ */
/*  Org-tree helpers                                                   */
/* ------------------------------------------------------------------ */

/** Build org-tree children for a given parent employee. */
export function getEmployeeTreeChildren(
  employees: {
    name: string;
    employee_name: string;
    reports_to: string | null;
    company: string;
    status: string;
  }[],
  parent: string | null,
  company: string | null,
  isRoot: boolean
): EmployeeTreeNode[] {
  let filtered = employees.filter((e) => e.status === "Active");

  if (company && company !== "All Companies") {
    filtered = filtered.filter((e) => e.company === company);
  }

  const effectiveParent = isRoot ? "" : parent ?? "";

  if (effectiveParent && company && effectiveParent !== company) {
    filtered = filtered.filter((e) => e.reports_to === effectiveParent);
  } else {
    filtered = filtered.filter((e) => !e.reports_to || e.reports_to === "");
  }

  return filtered.map((e) => ({
    value: e.name,
    title: e.employee_name,
    expandable: employees.some((child) => child.reports_to === e.name) ? 1 : 0,
  }));
}

/* ------------------------------------------------------------------ */
/*  Role validation                                                    */
/* ------------------------------------------------------------------ */

/** Determine which Employee-related roles should be stripped from a user.
 *  Returns list of roles to remove.
 */
export function validateEmployeeRole(userRoles: string[], hasMappedEmployee: boolean): string[] {
  const toRemove: string[] = [];
  if (!hasMappedEmployee) {
    if (userRoles.includes("Employee")) toRemove.push("Employee");
    if (userRoles.includes("Employee Self Service")) toRemove.push("Employee Self Service");
  }
  return toRemove;
}

/* ------------------------------------------------------------------ */
/*  Master validate                                                    */
/* ------------------------------------------------------------------ */

/** Run all employee validations. Returns ValidationResult. */
export function validateEmployee(
  doc: EmployeeDoc,
  activeSubordinates: { name: string; employee_name: string }[] = [],
  activeEmployeesWithSameUser: string[] = []
): ValidationResult {
  const warnings: string[] = [];

  // Name
  const computedName = setEmployeeName(doc);
  if (!computedName || computedName.trim().length === 0) {
    return { success: false, error: "Employee Name is required" };
  }

  // Dates
  const dateErr = validateDate(doc);
  if (dateErr) return { success: false, error: dateErr };

  // Emails
  const companyEmailErr = validateEmail(doc.company_email);
  if (companyEmailErr) return { success: false, error: companyEmailErr };
  const personalEmailErr = validateEmail(doc.personal_email);
  if (personalEmailErr) return { success: false, error: personalEmailErr };

  // Preferred email
  const prefErr = validatePreferredEmail(doc);
  if (prefErr) warnings.push(prefErr);

  // Status
  const statusErr = validateStatus(doc, activeSubordinates);
  if (statusErr) return { success: false, error: statusErr };

  // Reports to
  const reportsErr = validateReportsTo(doc.reports_to ?? undefined, doc.name || doc.employee || "");
  if (reportsErr) return { success: false, error: reportsErr };

  // Auto user creation
  const autoUserErr = validateAutoUserCreation(doc);
  if (autoUserErr) return { success: false, error: autoUserErr };

  // Duplicate user
  if (doc.user_id) {
    const dupErr = validateDuplicateUserId(doc.user_id, doc.name || "", activeEmployeesWithSameUser);
    if (dupErr) return { success: false, error: dupErr };
  }

  return { success: true, warnings };
}
