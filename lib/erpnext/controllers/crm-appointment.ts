/**
 * Pure business logic ported from ERPNext CRM Appointment DocType.
 * Source: erpnext/crm/doctype/appointment/appointment.py
 *
 * All functions are side-effect free. Callers (Next.js Server Actions)
 * perform the actual database / e-mail / calendar mutations.
 */

export type AppointmentStatus = "Open" | "Unverified" | "Closed";

export interface Appointment {
  id: string;
  name: string;
  scheduled_time: Date;
  status: AppointmentStatus;
  customer_name: string;
  customer_email: string;
  customer_phone_number?: string | null;
  customer_skype?: string | null;
  customer_details?: string | null;
  appointment_with?: string | null;
  party?: string | null;
  calendar_event?: string | null;
  assigned_to?: string | null;
  docstatus: number;
}

export interface Lead {
  id: string;
  name: string;
  email_id: string;
  lead_name: string;
  phone?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  email_id: string;
}

export interface Opportunity {
  id: string;
  name: string;
  party_name: string;
  assignees: string[];
  created_at: Date;
}

export interface Employee {
  id: string;
  name: string;
  user_id: string;
}

export interface CalendarEventData {
  subject: string;
  starts_on: Date;
  status: string;
  type: string;
  send_reminder: boolean;
  event_participants: Array<{
    reference_doctype: string;
    reference_docname: string;
  }>;
}

export interface LeadData {
  lead_name: string;
  email_id: string;
  phone?: string | null;
  notes?: Array<{
    note: string;
    added_by: string;
    added_on: Date;
  }>;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  updates: Partial<T>;
}

export interface BeforeInsertContext {
  appointmentsAtSlot: Appointment[];
  numberOfAgents: number;
  leads: Lead[];
  customers: Customer[];
}

export interface BeforeInsertResult {
  valid: boolean;
  error?: string;
  updates: Partial<Appointment>;
}

export interface AutoAssignContext {
  opportunities: Opportunity[];
  appointments: Appointment[];
  agentList: string[];
}

/* ────────────────────────────────────────────────────────────────
 *  before_insert logic
 * ──────────────────────────────────────────────────────────────── */

export function beforeInsert(
  appointment: Appointment,
  ctx: BeforeInsertContext
): BeforeInsertResult {
  if (ctx.numberOfAgents !== 0 && ctx.appointmentsAtSlot.length >= ctx.numberOfAgents) {
    return {
      valid: false,
      error: "Time slot is not available",
      updates: {},
    };
  }

  const updates: Partial<Appointment> = {};

  if (!appointment.party) {
    const customer = ctx.customers.find(
      (c) => c.email_id === appointment.customer_email
    );
    if (customer) {
      updates.appointment_with = "Customer";
      updates.party = customer.name;
    } else {
      const lead = ctx.leads.find(
        (l) => l.email_id === appointment.customer_email
      );
      updates.appointment_with = "Lead";
      updates.party = lead ? lead.name : null;
    }
  }

  return { valid: true, updates };
}

/* ────────────────────────────────────────────────────────────────
 *  after_insert logic (pure decision tree)
 * ──────────────────────────────────────────────────────────────── */

export interface AfterInsertPlan {
  status: AppointmentStatus;
  autoAssign: boolean;
  createCalendarEvent: boolean;
  sendConfirmationEmail: boolean;
}

export function planAfterInsert(appointment: Appointment): AfterInsertPlan {
  if (appointment.party) {
    return {
      status: "Open",
      autoAssign: true,
      createCalendarEvent: true,
      sendConfirmationEmail: false,
    };
  }
  return {
    status: "Unverified",
    autoAssign: false,
    createCalendarEvent: false,
    sendConfirmationEmail: true,
  };
}

/* ────────────────────────────────────────────────────────────────
 *  Calendar event construction
 * ──────────────────────────────────────────────────────────────── */

export function buildCalendarEventData(
  appointment: Appointment,
  sendReminder: boolean,
  employee?: Employee | null
): CalendarEventData {
  const participants: Array<{
    reference_doctype: string;
    reference_docname: string;
  }> = [];

  if (appointment.appointment_with && appointment.party) {
    participants.push({
      reference_doctype: appointment.appointment_with,
      reference_docname: appointment.party,
    });
  }

  if (employee) {
    participants.push({
      reference_doctype: "Employee",
      reference_docname: employee.name,
    });
  }

  return {
    subject: `Appointment with ${appointment.customer_name}`,
    starts_on: appointment.scheduled_time,
    status: "Open",
    type: "Public",
    send_reminder: sendReminder,
    event_participants: participants,
  };
}

export function getCalendarEventUpdate(
  appointment: Appointment
): Partial<{ starts_on: Date }> | null {
  if (!appointment.calendar_event) {
    return null;
  }
  return { starts_on: appointment.scheduled_time };
}

/* ────────────────────────────────────────────────────────────────
 *  Lead construction
 * ──────────────────────────────────────────────────────────────── */

export function buildLeadData(
  appointment: Appointment,
  user: string
): LeadData {
  const lead: LeadData = {
    lead_name: appointment.customer_name,
    email_id: appointment.customer_email,
    phone: appointment.customer_phone_number,
  };

  if (appointment.customer_details) {
    lead.notes = [
      {
        note: appointment.customer_details,
        added_by: user,
        added_on: new Date(),
      },
    ];
  }

  return lead;
}

/* ────────────────────────────────────────────────────────────────
 *  Email verification / set_verified logic
 * ──────────────────────────────────────────────────────────────── */

export function validateVerificationEmail(
  appointment: Appointment,
  email: string
): string | null {
  if (email !== appointment.customer_email) {
    return "Email verification failed.";
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
 *  Auto-assignment algorithm
 * ──────────────────────────────────────────────────────────────── */

export function autoAssign(
  appointment: Appointment,
  currentAssignee: string | null,
  ctx: AutoAssignContext
): string | null {
  const existing = getAssigneeFromLatestOpportunity(
    appointment.party,
    ctx.opportunities
  );
  if (existing) {
    return existing;
  }

  if (currentAssignee) {
    return null;
  }

  const sortedAgents = getAgentsSortedByAscWorkload(
    ctx.agentList,
    ctx.appointments,
    appointment.scheduled_time
  );

  for (const [agent] of sortedAgents) {
    if (checkAgentAvailability(agent, appointment.scheduled_time, ctx.appointments)) {
      return agent;
    }
  }

  return null;
}

export function getAssigneeFromLatestOpportunity(
  party: string | null | undefined,
  opportunities: Opportunity[]
): string | null {
  if (!party) {
    return null;
  }

  const relevant = opportunities
    .filter((o) => o.party_name === party)
    .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  if (relevant.length === 0) {
    return null;
  }

  const latest = relevant[0];
  if (latest.assignees && latest.assignees.length > 0) {
    return latest.assignees[0];
  }

  return null;
}

/* ────────────────────────────────────────────────────────────────
 *  Agent workload sorting
 * ──────────────────────────────────────────────────────────────── */

export function getAgentsSortedByAscWorkload(
  agentList: string[],
  appointments: Appointment[],
  date: Date
): Array<[string, number]> {
  const counter = new Map<string, number>();
  for (const agent of agentList) {
    counter.set(agent, 0);
  }

  const targetDate = stripTime(date);

  for (const appt of appointments) {
    if (!appt.assigned_to) {
      continue;
    }
    if (
      agentList.includes(appt.assigned_to) &&
      stripTime(appt.scheduled_time).getTime() === targetDate.getTime()
    ) {
      counter.set(appt.assigned_to, (counter.get(appt.assigned_to) ?? 0) + 1);
    }
  }

  const entries = Array.from(counter.entries());
  entries.sort((a, b) => a[1] - b[1]);
  return entries;
}

/* ────────────────────────────────────────────────────────────────
 *  Agent availability check
 * ──────────────────────────────────────────────────────────────── */

export function checkAgentAvailability(
  agentEmail: string,
  scheduledTime: Date,
  appointments: Appointment[]
): boolean {
  return !appointments.some(
    (appt) =>
      appt.scheduled_time.getTime() === scheduledTime.getTime() &&
      appt.assigned_to === agentEmail
  );
}

/* ────────────────────────────────────────────────────────────────
 *  Utilities
 * ──────────────────────────────────────────────────────────────── */

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
