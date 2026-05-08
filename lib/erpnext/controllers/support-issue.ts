/**
 * Ported from erpnext/support/doctype/issue/issue.py
 * Pure business logic — no Frappe / Prisma imports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type IssueStatus = "Open" | "Replied" | "On Hold" | "Resolved" | "Closed";
export type AgreementStatus = "First Response Due" | "Resolution Due" | "Fulfilled" | "Failed";

export interface Issue {
  name?: string;
  naming_series?: string;
  agreement_status?: AgreementStatus;
  attachment?: string;
  avg_response_time?: number;
  company?: string;
  contact?: string;
  content_type?: string;
  customer?: string;
  customer_name?: string;
  description?: string;
  email_account?: string;
  first_responded_on?: string | null;
  first_response_time?: number | null;
  issue_split_from?: string;
  issue_type?: string;
  lead?: string;
  on_hold_since?: string | null;
  opening_date?: string;
  opening_time?: string;
  priority?: string;
  project?: string;
  raised_by?: string;
  resolution_details?: string;
  resolution_time?: number | null;
  response_by?: string | null;
  service_level_agreement?: string | null;
  service_level_agreement_creation?: string;
  sla_resolution_by?: string | null;
  sla_resolution_date?: string | null;
  status: IssueStatus;
  subject: string;
  total_hold_time?: number;
  user_resolution_time?: number | null;
  via_customer_portal: boolean;
  docstatus: number;
  creation?: string;
  modified?: string;
}

export interface LeadInfo {
  name: string;
  email_id?: string;
  company?: string;
}

export interface ContactLink {
  link_doctype: string;
  link_name: string;
}

export interface ContactInfo {
  name: string;
  email_id?: string;
  links?: ContactLink[];
}

export interface CommunicationRef {
  name: string;
  reference_doctype?: string;
  reference_name?: string;
  creation: string;
  sent_or_received?: "Sent" | "Received";
}

export interface CommunicationData {
  communication_type: "Communication";
  communication_medium: "Email";
  sent_or_received: "Received";
  email_status: "Open";
  subject: string;
  sender: string;
  content?: string;
  status: "Linked";
  reference_doctype: "Issue";
  reference_name: string;
}

export interface SplitIssueResult {
  newIssue: Issue;
  communicationsToReassign: CommunicationRef[];
  commentContent: string;
}

export interface SupportDay {
  workday: string;
  start_time: number; // seconds from midnight
  end_time: number;   // seconds from midnight
}

export interface Holiday {
  holiday_date: string; // ISO date
}

export interface IssueValidationResult {
  success: boolean;
  error?: string;
  doc?: Issue;
  flags?: {
    create_communication?: boolean;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function parseEmail(emailId: string): string {
  // Simple parseaddr equivalent: extract inside < > or return trimmed
  const match = emailId.match(/<([^>]+)>/);
  const addr = match ? match[1] : emailId;
  return addr.trim().toLowerCase();
}

function getWeekday(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

export function getTimeInSeconds(date: Date): number {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

export function getTimeInTimedelta(timeStr: string): number {
  // Expects "HH:MM:SS" or similar
  const parts = timeStr.split(":").map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

export function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export function getDatetime(iso?: string | null): Date {
  return iso ? new Date(iso) : new Date();
}

/* ------------------------------------------------------------------ */
/*  Validate                                                           */
/* ------------------------------------------------------------------ */

export function validateIssue(
  issue: Issue,
  isNew: boolean,
  sessionUser: string,
  leads: LeadInfo[] = [],
  contacts: ContactInfo[] = [],
  defaultCompany?: string
): IssueValidationResult {
  const doc = { ...issue };
  const flags: { create_communication?: boolean } = {};

  if (isNew && doc.via_customer_portal) {
    flags.create_communication = true;
  }

  if (!doc.raised_by) {
    doc.raised_by = sessionUser;
  }

  const updated = setLeadContact(doc, doc.raised_by, leads, contacts, defaultCompany);

  return {
    success: true,
    doc: updated,
    flags,
  };
}

/* ------------------------------------------------------------------ */
/*  Lead / Contact lookup                                              */
/* ------------------------------------------------------------------ */

export function setLeadContact(
  issue: Issue,
  raisedBy: string,
  leads: LeadInfo[],
  contacts: ContactInfo[],
  defaultCompany?: string
): Issue {
  const doc = { ...issue };
  const emailId = parseEmail(raisedBy);

  if (!emailId) return doc;

  if (!doc.lead) {
    const lead = leads.find((l) => l.email_id && parseEmail(l.email_id) === emailId);
    if (lead) {
      doc.lead = lead.name;
    }
  }

  if (!doc.contact && !doc.customer) {
    const contact = contacts.find((c) => c.email_id && parseEmail(c.email_id) === emailId);
    if (contact) {
      doc.contact = contact.name;
      const custLink = contact.links?.find(
        (l) => l.link_doctype === "Customer"
      );
      if (custLink) {
        doc.customer = custLink.link_name;
      }
    }
  }

  if (!doc.company) {
    const lead = leads.find((l) => l.name === doc.lead);
    doc.company = lead?.company || defaultCompany || doc.company;
  }

  return doc;
}

/* ------------------------------------------------------------------ */
/*  Communication                                                      */
/* ------------------------------------------------------------------ */

export function getCommunicationData(issue: Issue): CommunicationData | null {
  if (!issue.via_customer_portal || !issue.raised_by) return null;

  return {
    communication_type: "Communication",
    communication_medium: "Email",
    sent_or_received: "Received",
    email_status: "Open",
    subject: issue.subject,
    sender: issue.raised_by,
    content: issue.description,
    status: "Linked",
    reference_doctype: "Issue",
    reference_name: issue.name || "",
  };
}

/* ------------------------------------------------------------------ */
/*  Split Issue                                                        */
/* ------------------------------------------------------------------ */

export function splitIssue(
  issue: Issue,
  subject: string,
  communicationId: string,
  communications: CommunicationRef[]
): SplitIssueResult {
  const now = new Date().toISOString();

  const newIssue: Issue = {
    ...issue,
    name: undefined,
    subject,
    issue_split_from: issue.name,
    first_response_time: 0,
    first_responded_on: undefined,
    creation: now,
    modified: now,
  };

  // Reset SLA
  if (newIssue.service_level_agreement) {
    newIssue.service_level_agreement_creation = now;
    newIssue.service_level_agreement = undefined;
    newIssue.agreement_status = "First Response Due";
    newIssue.response_by = undefined;
    newIssue.sla_resolution_by = undefined;
    const reset = resetIssueMetrics();
    newIssue.resolution_time = reset.resolution_time;
    newIssue.user_resolution_time = reset.user_resolution_time;
  }

  const commToSplitFrom = communications.find((c) => c.name === communicationId);
  const commsToReassign: CommunicationRef[] = [];

  if (commToSplitFrom) {
    const refName = commToSplitFrom.reference_name;
    const splitCreation = new Date(commToSplitFrom.creation);
    commsToReassign.push(
      ...communications.filter((c) => {
        if (c.reference_name !== refName) return false;
        return new Date(c.creation) >= splitCreation;
      })
    );
  }

  const commentContent = ` - Split the Issue from <a href='/app/Form/Issue/${issue.name}'>${issue.name}</a>`;

  return {
    newIssue,
    communicationsToReassign: commsToReassign,
    commentContent,
  };
}

export function resetIssueMetrics(): { resolution_time: null; user_resolution_time: null } {
  return { resolution_time: null, user_resolution_time: null };
}

/* ------------------------------------------------------------------ */
/*  Auto-close                                                         */
/* ------------------------------------------------------------------ */

export function getIssuesToAutoClose(
  issues: Issue[],
  autoCloseAfterDays: number,
  now: Date
): Issue[] {
  if (!autoCloseAfterDays || autoCloseAfterDays <= 0) return [];

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - autoCloseAfterDays);

  return issues.filter(
    (issue) => issue.status === "Replied" && issue.modified && new Date(issue.modified) < cutoff
  );
}

/* ------------------------------------------------------------------ */
/*  Website Permission                                                 */
/* ------------------------------------------------------------------ */

export function hasWebsitePermission(doc: Issue, user: string, contactCustomer?: string): boolean {
  if (contactCustomer && doc.customer === contactCustomer) return true;
  return doc.raised_by === user;
}

/* ------------------------------------------------------------------ */
/*  Contact deletion update                                            */
/* ------------------------------------------------------------------ */

export function getContactClearUpdate(): { contact: "" } {
  return { contact: "" };
}

/* ------------------------------------------------------------------ */
/*  Make Issue from Communication                                      */
/* ------------------------------------------------------------------ */

export interface CommunicationSource {
  subject: string;
  communication_medium?: string;
  sender?: string;
  phone_no?: string;
}

export function makeIssueFromCommunication(comm: CommunicationSource): Partial<Issue> {
  return {
    subject: comm.subject,
    raised_by: comm.sender || "",
    status: "Open",
    docstatus: 0,
    via_customer_portal: false,
  };
}

/* ------------------------------------------------------------------ */
/*  First Response Time Calculations                                   */
/* ------------------------------------------------------------------ */

export function isFirstResponse(communications: CommunicationRef[]): boolean {
  const sent = communications.filter((c) => c.sent_or_received === "Sent");
  return sent.length === 1;
}

export function setFirstResponseTime(
  issue: Issue,
  allCommunications: CommunicationRef[],
  supportHours: SupportDay[]
): { first_responded_on?: string; first_response_time?: number } | null {
  if (issue.service_level_agreement && isFirstResponse(allCommunications)) {
    const firstRespondedOn = new Date();
    const frt = calculateFirstResponseTime(issue, firstRespondedOn, supportHours);
    return {
      first_responded_on: firstRespondedOn.toISOString(),
      first_response_time: frt,
    };
  }
  return null;
}

export function calculateFirstResponseTime(
  issue: Issue,
  firstRespondedOn: Date,
  supportHours: SupportDay[]
): number {
  const issueCreationDate = getDatetime(
    issue.service_level_agreement_creation || issue.creation
  );
  const issueCreationTime = getTimeInSeconds(issueCreationDate);
  const firstRespondedOnInSeconds = getTimeInSeconds(firstRespondedOn);

  if (issueCreationDate.getDate() === firstRespondedOn.getDate() &&
      issueCreationDate.getMonth() === firstRespondedOn.getMonth() &&
      issueCreationDate.getFullYear() === firstRespondedOn.getFullYear()) {
    if (isWorkDay(issueCreationDate, supportHours)) {
      const hours = getWorkingHours(issueCreationDate, supportHours);
      if (!hours) return 1.0;
      const { start: startTime, end: endTime } = hours;

      if (
        isDuringWorkingHours(issueCreationDate, supportHours) &&
        isDuringWorkingHours(firstRespondedOn, supportHours)
      ) {
        return getElapsedTime(issueCreationTime, firstRespondedOnInSeconds);
      } else if (isDuringWorkingHours(issueCreationDate, supportHours)) {
        return getElapsedTime(issueCreationTime, endTime);
      } else if (isDuringWorkingHours(firstRespondedOn, supportHours)) {
        return getElapsedTime(startTime, firstRespondedOnInSeconds);
      } else {
        return 1.0;
      }
    } else {
      return 1.0;
    }
  } else {
    // response on next day or later
    const daysDiff = dateDiff(firstRespondedOn, issueCreationDate);
    let firstResponseTime = 0;

    if (daysDiff === 1) {
      firstResponseTime = 0;
    } else {
      firstResponseTime = calculateInitialFrt(
        issueCreationDate,
        daysDiff - 1,
        supportHours
      );
    }

    // time taken on day of issue creation
    if (isWorkDay(issueCreationDate, supportHours)) {
      const hours = getWorkingHours(issueCreationDate, supportHours);
      if (hours) {
        const { start: startTime, end: endTime } = hours;
        if (isDuringWorkingHours(issueCreationDate, supportHours)) {
          firstResponseTime += getElapsedTime(issueCreationTime, endTime);
        } else if (isBeforeWorkingHours(issueCreationDate, supportHours)) {
          firstResponseTime += getElapsedTime(startTime, endTime);
        }
      }
    }

    // time taken on day of first response
    if (isWorkDay(firstRespondedOn, supportHours)) {
      const hours = getWorkingHours(firstRespondedOn, supportHours);
      if (hours) {
        const { start: startTime, end: endTime } = hours;
        if (isDuringWorkingHours(firstRespondedOn, supportHours)) {
          firstResponseTime += getElapsedTime(startTime, firstRespondedOnInSeconds);
        } else if (!isBeforeWorkingHours(firstRespondedOn, supportHours)) {
          firstResponseTime += getElapsedTime(startTime, endTime);
        }
      }
    }

    return firstResponseTime || 1.0;
  }
}

export function getWorkingHours(
  date: Date,
  supportHours: SupportDay[]
): { start: number; end: number } | null {
  if (!isWorkDay(date, supportHours)) return null;
  const weekday = getWeekday(date);
  const day = supportHours.find((d) => d.workday === weekday);
  if (!day) return null;
  return { start: day.start_time, end: day.end_time };
}

export function isWorkDay(date: Date, supportHours: SupportDay[]): boolean {
  const weekday = getWeekday(date);
  return supportHours.some((d) => d.workday === weekday);
}

export function isDuringWorkingHours(date: Date, supportHours: SupportDay[]): boolean {
  const hours = getWorkingHours(date, supportHours);
  if (!hours) return false;
  const time = getTimeInSeconds(date);
  return time >= hours.start && time <= hours.end;
}

export function isBeforeWorkingHours(date: Date, supportHours: SupportDay[]): boolean {
  const hours = getWorkingHours(date, supportHours);
  if (!hours) return false;
  const time = getTimeInSeconds(date);
  return time < hours.start;
}

export function getElapsedTime(startTime: number, endTime: number): number {
  return Math.round(endTime - startTime);
}

export function calculateInitialFrt(
  issueCreationDate: Date,
  daysInBetween: number,
  supportHours: SupportDay[]
): number {
  let initialFrt = 0;
  for (let i = 0; i < daysInBetween; i++) {
    const date = new Date(issueCreationDate);
    date.setDate(date.getDate() + (i + 1));
    if (isWorkDay(date, supportHours)) {
      const hours = getWorkingHours(date, supportHours);
      if (hours) {
        initialFrt += getElapsedTime(hours.start, hours.end);
      }
    }
  }
  return initialFrt;
}

export function getHolidays(holidays: Holiday[]): string[] {
  return holidays.map((h) => h.holiday_date);
}

function dateDiff(end: Date, start: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / msPerDay);
}
