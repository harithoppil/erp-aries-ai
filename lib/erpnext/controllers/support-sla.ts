/**
 * Ported from erpnext/support/doctype/service_level_agreement/service_level_agreement.py
 * Pure business logic — no Frappe / Prisma imports.
 */

import {
  Issue,
  AgreementStatus,
  CommunicationRef,
  SupportDay,
  calculateFirstResponseTime,
  getDatetime,
  getTimeInSeconds,
  fmtDate,
} from "./support-issue";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type EntityType = "" | "Customer" | "Customer Group" | "Territory";

export interface ServiceLevelPriority {
  priority: string;
  response_time: number; // seconds
  resolution_time: number; // seconds
  default_priority: boolean;
}

export interface PauseSLAOnStatus {
  status: string;
}

export interface SLAFulfilledOnStatus {
  status: string;
}

export interface ServiceLevelAgreement {
  name?: string;
  service_level: string;
  document_type: string;
  enabled: boolean;
  default_service_level_agreement: boolean;
  entity_type?: EntityType;
  entity?: string;
  start_date?: string;
  end_date?: string;
  holiday_list?: string;
  apply_sla_for_resolution: boolean;
  condition?: string;
  default_priority?: string;
  priorities: ServiceLevelPriority[];
  support_and_resolution: SupportDay[];
  pause_sla_on: PauseSLAOnStatus[];
  sla_fulfilled_on: SLAFulfilledOnStatus[];
}

export interface SLASummary {
  name: string;
  default_priority: string;
  apply_sla_for_resolution: boolean;
  condition?: string;
}

export interface SLAPriorityWithSupport {
  priority: string;
  response_time: number;
  resolution_time: number;
  support_and_resolution: SupportDay[];
  holidays: string[];
}

export interface SLAValidationResult {
  success: boolean;
  error?: string;
  doc?: ServiceLevelAgreement;
}

export interface StatusChangeResult {
  first_responded_on?: string;
  first_response_time?: number;
  on_hold_since?: string | null;
  total_hold_time?: number;
  sla_resolution_date?: string | null;
  resolution_time?: number | null;
  user_resolution_time?: number | null;
  response_by?: string | null;
  sla_resolution_by?: string | null;
  comment?: string;
}

export interface CommunicationUpdateResult {
  doc?: Issue;
  statusRevert?: string;
  flags?: { on_first_reply?: boolean };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getWeekdays(): string[] {
  return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
}

export function getRepeated(values: string[]): string | null {
  const seen = new Set<string>();
  const diff = new Set<string>();
  for (const v of values) {
    if (seen.has(v)) {
      diff.add(v);
    } else {
      seen.add(v);
    }
  }
  return diff.size > 0 ? Array.from(diff).join(" ") : null;
}

function validateConditionSyntax(condition: string): string | null {
  let depth = 0;
  for (const ch of condition) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return `The Condition '${condition}' is invalid`;
  }
  if (depth !== 0) return `The Condition '${condition}' is invalid`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  SLA Validation                                                     */
/* ------------------------------------------------------------------ */

export function validateServiceLevelAgreement(
  sla: ServiceLevelAgreement,
  validDocumentTypes: string[],
  hasStatusField: boolean,
  trackSlaEnabled: boolean,
  existingDefaults: string[],
  existingEntitySlas: string[]
): SLAValidationResult {
  const errors: string[] = [];

  // validate_selected_doctype
  if (!validDocumentTypes.includes(sla.document_type)) {
    errors.push("Please select valid document type.");
  }

  // validate_doc
  if (sla.enabled && sla.document_type === "Issue" && !trackSlaEnabled) {
    errors.push("Track Service Level Agreement is not enabled in Support Settings.");
  }
  if (sla.default_service_level_agreement && existingDefaults.length > 0) {
    errors.push(`Default Service Level Agreement for ${sla.document_type} already exists.`);
  }
  if (sla.start_date && sla.end_date && sla.start_date > sla.end_date) {
    errors.push("Start Date cannot be after End Date.");
  }
  if (sla.entity_type && sla.entity && existingEntitySlas.length > 0) {
    errors.push(`Service Level Agreement for ${sla.entity_type} ${sla.entity} already exists.`);
  }

  // validate_status_field
  if (!hasStatusField) {
    errors.push(
      `The Document Type ${sla.document_type} must have a Status field to configure Service Level Agreement`
    );
  }

  // check_priorities
  const priorityNames: string[] = [];
  for (const p of sla.priorities) {
    if (!p.response_time) {
      errors.push(`Set Response Time for Priority ${p.priority}.`);
    }
    if (sla.apply_sla_for_resolution) {
      if (!p.resolution_time) {
        errors.push(`Set Resolution Time for Priority ${p.priority}.`);
      }
      if (p.response_time > p.resolution_time) {
        errors.push(
          `Response Time for ${p.priority} priority can't be greater than Resolution Time.`
        );
      }
    }
    priorityNames.push(p.priority);
  }
  const repeatedPriority = getRepeated(priorityNames);
  if (repeatedPriority) {
    errors.push(`Priority ${repeatedPriority} has been repeated.`);
  }
  const defaultPriority = sla.priorities.find((p) => p.default_priority);
  if (!defaultPriority) {
    errors.push("Select a Default Priority.");
  }

  // check_support_and_resolution
  const supportDays: string[] = [];
  for (const day of sla.support_and_resolution) {
    supportDays.push(day.workday);
    if (day.start_time >= day.end_time) {
      errors.push(
        `Start Time can't be greater than or equal to End Time for ${day.workday}.`
      );
    }
  }
  const repeatedDays = getRepeated(supportDays);
  if (repeatedDays) {
    errors.push(`Workday ${repeatedDays} has been repeated.`);
  }

  // validate_condition
  if (sla.condition) {
    const condError = validateConditionSyntax(sla.condition);
    if (condError) errors.push(condError);
  }

  if (errors.length > 0) {
    return { success: false, error: errors.join("; ") };
  }

  return {
    success: true,
    doc: {
      ...sla,
      default_priority: defaultPriority?.priority,
    },
  };
}

/* ------------------------------------------------------------------ */
/*  SLA Application                                                    */
/* ------------------------------------------------------------------ */

export function removeSlaIfApplied(doc: Issue): Partial<Issue> {
  return {
    service_level_agreement: undefined,
    response_by: undefined,
    sla_resolution_by: undefined,
  };
}

export function applySla(
  doc: Issue,
  prevStatus: string,
  sla: ServiceLevelAgreement,
  now: Date,
  communications: CommunicationRef[],
  holidays: string[],
  holdStatuses: string[],
  fulfillmentStatuses: string[],
  assignedUsers?: string[]
): Issue {
  let updated = { ...doc };

  if (!updated.creation) {
    updated.creation = now.toISOString();
    updated.service_level_agreement_creation = now.toISOString();
  }

  updated.service_level_agreement = sla.name;
  updated.priority = updated.priority || sla.default_priority;

  const statusResult = handleStatusChange(
    updated,
    prevStatus,
    sla.apply_sla_for_resolution,
    now,
    sla.support_and_resolution,
    communications,
    holdStatuses,
    fulfillmentStatuses,
    assignedUsers
  );
  updated = { ...updated, ...statusResult };

  const priority = getResponseAndResolutionDuration(updated, sla, holidays);
  const metrics = updateResponseAndResolutionMetrics(updated, sla.apply_sla_for_resolution, priority);
  updated = { ...updated, ...metrics };

  updated.agreement_status = updateAgreementStatus(updated, sla.apply_sla_for_resolution);

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Status Change Handling                                             */
/* ------------------------------------------------------------------ */

export function handleStatusChange(
  doc: Issue,
  prevStatus: string,
  applySlaForResolution: boolean,
  now: Date,
  supportHours: SupportDay[],
  communications: CommunicationRef[],
  holdStatuses: string[],
  fulfillmentStatuses: string[],
  assignedUsers?: string[]
): StatusChangeResult {
  const result: StatusChangeResult = {};

  const isHoldStatus = (status: string): boolean => holdStatuses.includes(status);
  const isFulfilledStatus = (status: string): boolean => fulfillmentStatuses.includes(status);
  const isOpenStatus = (status: string): boolean => !isHoldStatus(status) && !isFulfilledStatus(status);

  const setFirstResponse = (): void => {
    if (!doc.first_responded_on) {
      result.first_responded_on = now.toISOString();
      result.first_response_time = calculateFirstResponseTime(doc, now, supportHours);
      if (now > getDatetime(doc.response_by)) {
        const comment = recordAssignedUsersOnFailure(assignedUsers || []);
        if (comment) result.comment = comment;
      }
    }
  };

  const calculateHoldHours = (): void => {
    const onHoldSince = doc.sla_resolution_date || doc.on_hold_since;
    if (onHoldSince) {
      const currentHoldHours = Math.round(
        (now.getTime() - new Date(onHoldSince).getTime()) / 1000
      );
      result.total_hold_time = (doc.total_hold_time || 0) + currentHoldHours;
    }
    result.on_hold_since = null;
  };

  const onFirstReply = (doc as unknown as Record<string, unknown>).on_first_reply === true;

  if ((isOpenStatus(prevStatus) && !isOpenStatus(doc.status)) || onFirstReply) {
    setFirstResponse();
  }

  // Open -> Replied
  if (isOpenStatus(prevStatus) && isHoldStatus(doc.status)) {
    result.on_hold_since = now.toISOString();
    Object.assign(result, resetExpectedResponseAndResolution(doc));
  }

  // Replied -> Open
  if (isHoldStatus(prevStatus) && isOpenStatus(doc.status)) {
    calculateHoldHours();
    Object.assign(result, resetResolutionMetrics());
  }

  // Open -> Closed
  if (isOpenStatus(prevStatus) && isFulfilledStatus(doc.status)) {
    result.sla_resolution_date = now.toISOString();
    Object.assign(
      result,
      setResolutionTime({ ...doc, sla_resolution_date: now.toISOString() }, communications)
    );
  }

  // Closed -> Open
  if (isFulfilledStatus(prevStatus) && isOpenStatus(doc.status)) {
    calculateHoldHours();
    Object.assign(result, resetResolutionMetrics());
  }

  // Closed -> Replied
  if (isFulfilledStatus(prevStatus) && isHoldStatus(doc.status)) {
    calculateHoldHours();
    result.on_hold_since = now.toISOString();
    Object.assign(result, resetExpectedResponseAndResolution(doc));
  }

  // Replied -> Closed
  if (isHoldStatus(prevStatus) && isFulfilledStatus(doc.status)) {
    calculateHoldHours();
    if (applySlaForResolution) {
      result.sla_resolution_date = now.toISOString();
      Object.assign(
        result,
        setResolutionTime({ ...doc, sla_resolution_date: now.toISOString() }, communications)
      );
    }
  }

  return result;
}

export function getHoldStatuses(sla: ServiceLevelAgreement): string[] {
  return sla.pause_sla_on.map((s) => s.status);
}

export function getFulfillmentStatuses(sla: ServiceLevelAgreement): string[] {
  return sla.sla_fulfilled_on.map((s) => s.status);
}

export function resetResolutionMetrics(): {
  sla_resolution_date: null;
  resolution_time: null;
  user_resolution_time: null;
} {
  return { sla_resolution_date: null, resolution_time: null, user_resolution_time: null };
}

export function resetExpectedResponseAndResolution(doc: Issue): {
  response_by: null;
  sla_resolution_by: null;
} {
  const res: { response_by: null; sla_resolution_by: null } = {
    response_by: null,
    sla_resolution_by: null,
  };
  if (doc.first_responded_on) res.response_by = null;
  if (doc.sla_resolution_date) res.sla_resolution_by = null;
  return res;
}

/* ------------------------------------------------------------------ */
/*  Response / Resolution Metrics                                      */
/* ------------------------------------------------------------------ */

export function updateResponseAndResolutionMetrics(
  doc: Issue,
  applySlaForResolution: boolean,
  priority: SLAPriorityWithSupport
): { response_by?: string; sla_resolution_by?: string } {
  const result: { response_by?: string; sla_resolution_by?: string } = {};
  const startDateTime = getDatetime(doc.service_level_agreement_creation || doc.creation);

  result.response_by = setResponseBy(startDateTime, priority, doc.total_hold_time, !!doc.first_responded_on);

  if (applySlaForResolution && !doc.on_hold_since) {
    result.sla_resolution_by = setResolutionBy(startDateTime, priority, doc.total_hold_time);
  }

  return result;
}

export function getResponseAndResolutionDuration(
  doc: Issue,
  sla: ServiceLevelAgreement,
  holidays: string[]
): SLAPriorityWithSupport {
  const priority = sla.priorities.find((p) => p.priority === doc.priority) || sla.priorities[0];
  return {
    priority: priority.priority,
    response_time: priority.response_time,
    resolution_time: priority.resolution_time,
    support_and_resolution: sla.support_and_resolution,
    holidays,
  };
}

/* ------------------------------------------------------------------ */
/*  Expected Time Calculations                                         */
/* ------------------------------------------------------------------ */

export function getExpectedTimeFor(
  parameter: "response" | "resolution",
  serviceLevel: SLAPriorityWithSupport,
  startDateTime: Date
): Date {
  let currentDateTime = new Date(startDateTime);
  let expectedTime = new Date(currentDateTime);
  let startTime: number | null = null;
  let endTime: number | null = null;
  let expectedTimeIsSet = false;

  let allottedSeconds = getAllottedSeconds(parameter, serviceLevel);
  const supportDays = getSupportDays(serviceLevel.support_and_resolution);
  const holidays = serviceLevel.holidays;
  const weekdays = getWeekdays();

  // Guard against zero or negative allotted seconds
  if (allottedSeconds <= 0) {
    return currentDateTime;
  }

  let safety = 0;
  while (!expectedTimeIsSet && safety < 366) {
    safety++;
    const currentWeekday = weekdays[currentDateTime.getDay()];

    if (!isHoliday(currentDateTime, holidays) && currentWeekday in supportDays) {
      const day = supportDays[currentWeekday];
      const currentDateOnly = fmtDate(currentDateTime);
      const startDateOnly = fmtDate(startDateTime);
      const currentTimeSeconds = getTimeInSeconds(currentDateTime);

      if (currentDateOnly === startDateOnly && currentTimeSeconds > day.start_time) {
        startTime = currentTimeSeconds;
      } else {
        startTime = day.start_time;
      }

      endTime = day.end_time;
      const timeLeftToday = (endTime ?? 0) - (startTime ?? 0);
      if (timeLeftToday <= 0) {
        // pass
      } else {
        if (timeLeftToday >= allottedSeconds) {
          const base = new Date(
            currentDateTime.getFullYear(),
            currentDateTime.getMonth(),
            currentDateTime.getDate(),
            0,
            0,
            0
          );
          base.setSeconds((startTime ?? 0) + allottedSeconds);
          expectedTime = base;
          expectedTimeIsSet = true;
        } else {
          allottedSeconds = allottedSeconds - timeLeftToday;
        }
      }
    }

    if (!expectedTimeIsSet) {
      currentDateTime.setDate(currentDateTime.getDate() + 1);
      currentDateTime.setHours(0, 0, 0, 0);
    }
  }

  // The original Python dead-code branch (allotted_seconds >= 86400) is omitted.
  return expectedTime;
}

export function getAllottedSeconds(
  parameter: "response" | "resolution",
  serviceLevel: { response_time: number; resolution_time: number }
): number {
  if (parameter === "response") return serviceLevel.response_time;
  if (parameter === "resolution") return serviceLevel.resolution_time;
  throw new Error(`Invalid parameter: ${parameter}`);
}

export function getSupportDays(supportDays: SupportDay[]): Record<string, SupportDay> {
  const days: Record<string, SupportDay> = {};
  for (const d of supportDays) {
    days[d.workday] = d;
  }
  return days;
}

export function isHoliday(date: Date, holidays: string[]): boolean {
  return holidays.includes(fmtDate(date));
}

export function setResponseBy(
  startDateTime: Date,
  priority: SLAPriorityWithSupport,
  totalHoldTime?: number,
  hasFirstRespondedOn?: boolean
): string {
  let responseBy = getExpectedTimeFor("response", priority, startDateTime);
  if (totalHoldTime && !hasFirstRespondedOn) {
    responseBy = new Date(responseBy.getTime() + totalHoldTime * 1000);
  }
  return responseBy.toISOString();
}

export function setResolutionBy(
  startDateTime: Date,
  priority: SLAPriorityWithSupport,
  totalHoldTime?: number
): string {
  let resolutionBy = getExpectedTimeFor("resolution", priority, startDateTime);
  if (totalHoldTime) {
    resolutionBy = new Date(resolutionBy.getTime() + totalHoldTime * 1000);
  }
  return resolutionBy.toISOString();
}

/* ------------------------------------------------------------------ */
/*  Resolution Time                                                    */
/* ------------------------------------------------------------------ */

export function setResolutionTime(
  doc: Issue,
  communications: CommunicationRef[]
): { resolution_time?: number; user_resolution_time?: number } {
  const startDateTime = getDatetime(doc.service_level_agreement_creation || doc.creation);
  const slaResolutionDate = getDatetime(doc.sla_resolution_date);
  const result: { resolution_time?: number; user_resolution_time?: number } = {};

  result.resolution_time = Math.round(
    (slaResolutionDate.getTime() - startDateTime.getTime()) / 1000
  );

  const pendingTime: number[] = [];
  for (let i = 0; i < communications.length; i++) {
    if (
      communications[i].sent_or_received === "Received" &&
      communications[i - 1]?.sent_or_received === "Sent"
    ) {
      const waitTime = Math.round(
        (new Date(communications[i].creation).getTime() -
          new Date(communications[i - 1].creation).getTime()) /
          1000
      );
      if (waitTime > 0) {
        pendingTime.push(waitTime);
      }
    }
  }

  const totalPendingTime = pendingTime.reduce((a, b) => a + b, 0);
  result.user_resolution_time = (result.resolution_time || 0) - totalPendingTime;

  return result;
}

/* ------------------------------------------------------------------ */
/*  Agreement Status                                                   */
/* ------------------------------------------------------------------ */

export function updateAgreementStatus(
  doc: Issue,
  applySlaForResolution: boolean
): AgreementStatus {
  if (applySlaForResolution) {
    if (!doc.first_responded_on) return "First Response Due";
    if (!doc.sla_resolution_date) return "Resolution Due";
    const resolutionDate = getDatetime(doc.sla_resolution_date);
    const resolutionBy = getDatetime(doc.sla_resolution_by);
    return resolutionDate <= resolutionBy ? "Fulfilled" : "Failed";
  } else {
    if (!doc.first_responded_on) return "First Response Due";
    const firstRespondedOn = getDatetime(doc.first_responded_on);
    const responseBy = getDatetime(doc.response_by);
    return firstRespondedOn <= responseBy ? "Fulfilled" : "Failed";
  }
}

/* ------------------------------------------------------------------ */
/*  SLA Selection                                                      */
/* ------------------------------------------------------------------ */

export function getActiveServiceLevelAgreementFor(
  docType: string,
  doc: Issue,
  slas: ServiceLevelAgreement[],
  trackSla: boolean,
  customerGroups: string[],
  customerTerritories: string[],
  conditionEvaluator?: (condition: string) => boolean
): SLASummary | null {
  if (!trackSla) return null;

  let matches = slas.filter((sla) => sla.document_type === docType && sla.enabled);

  if (doc.priority) {
    matches = matches.filter((sla) =>
      sla.priorities.some((p) => p.priority === doc.priority)
    );
  }

  const orMatches: ServiceLevelAgreement[] = [];
  for (const sla of matches) {
    let include = false;
    if (doc.service_level_agreement && sla.name === doc.service_level_agreement) {
      include = true;
    }
    if (doc.customer) {
      const entities = [doc.customer, ...customerGroups, ...customerTerritories];
      if (sla.entity && entities.includes(sla.entity)) {
        include = true;
      }
      if (!sla.entity_type) {
        include = true;
      }
    } else {
      if (!sla.entity_type) {
        include = true;
      }
    }
    if (include) orMatches.push(sla);
  }

  const defaults = orMatches.filter((sla) => sla.default_service_level_agreement);
  const nonDefaults = orMatches.filter((sla) => !sla.default_service_level_agreement);

  const filtered: SLASummary[] = [];
  for (const sla of nonDefaults) {
    if (!sla.condition || (conditionEvaluator ? conditionEvaluator(sla.condition) : true)) {
      filtered.push({
        name: sla.name!,
        default_priority:
          sla.default_priority ||
          sla.priorities.find((p) => p.default_priority)?.priority ||
          "",
        apply_sla_for_resolution: sla.apply_sla_for_resolution,
        condition: sla.condition,
      });
    }
  }

  for (const sla of defaults) {
    filtered.push({
      name: sla.name!,
      default_priority:
        sla.default_priority ||
        sla.priorities.find((p) => p.default_priority)?.priority ||
        "",
      apply_sla_for_resolution: sla.apply_sla_for_resolution,
      condition: sla.condition,
    });
  }

  return filtered[0] || null;
}

/* ------------------------------------------------------------------ */
/*  SLA Status Checks                                                  */
/* ------------------------------------------------------------------ */

export function getSlasToDisable(
  slas: ServiceLevelAgreement[],
  today: Date
): string[] {
  const todayStr = fmtDate(today);
  return slas
    .filter(
      (sla) =>
        sla.enabled &&
        !sla.default_service_level_agreement &&
        sla.end_date &&
        sla.end_date < todayStr
    )
    .map((sla) => sla.name!);
}

/* ------------------------------------------------------------------ */
/*  Priority / SLA Change                                              */
/* ------------------------------------------------------------------ */

export function changeServiceLevelAgreementAndPriority(
  doc: Issue,
  oldPriority?: string,
  oldSla?: string,
  trackSla: boolean = true
): { priorityChanged: boolean; slaChanged: boolean; doc?: Issue } {
  if (!doc.service_level_agreement || !trackSla) {
    return { priorityChanged: false, slaChanged: false };
  }

  let updated = { ...doc };
  let priorityChanged = false;
  let slaChanged = false;

  if (oldPriority !== undefined && doc.priority !== oldPriority) {
    priorityChanged = true;
    updated = { ...updated, ...resetExpectedResponseAndResolution(updated) };
  }

  if (oldSla !== undefined && doc.service_level_agreement !== oldSla) {
    slaChanged = true;
    updated = { ...updated, ...resetExpectedResponseAndResolution(updated) };
  }

  return { priorityChanged, slaChanged, doc: updated };
}

/* ------------------------------------------------------------------ */
/*  Communication Hook                                                 */
/* ------------------------------------------------------------------ */

export function onCommunicationUpdate(
  parent: Issue,
  prevParent: Issue,
  communication: CommunicationRef,
  sla: ServiceLevelAgreement,
  now: Date,
  supportHours: SupportDay[],
  communications: CommunicationRef[],
  holdStatuses: string[],
  fulfillmentStatuses: string[],
  assignedUsers?: string[]
): CommunicationUpdateResult {
  if (
    communication.sent_or_received === "Received" &&
    parent.status === "Open" &&
    prevParent &&
    parent.status !== prevParent.status
  ) {
    return { statusRevert: prevParent.status };
  }

  if (
    communication.sent_or_received === "Sent" &&
    parent.first_responded_on &&
    prevParent &&
    !prevParent.first_responded_on
  ) {
    const updated: Issue = { ...parent, first_responded_on: undefined };

    const statusResult = handleStatusChange(
      updated,
      prevParent.status,
      sla.apply_sla_for_resolution,
      now,
      supportHours,
      communications,
      holdStatuses,
      fulfillmentStatuses,
      assignedUsers
    );

    const priority = getResponseAndResolutionDuration(
      { ...updated, ...statusResult },
      sla,
      []
    );
    const metrics = updateResponseAndResolutionMetrics(
      { ...updated, ...statusResult },
      sla.apply_sla_for_resolution,
      priority
    );
    const agreementStatus = updateAgreementStatus(
      { ...updated, ...statusResult, ...metrics },
      sla.apply_sla_for_resolution
    );

    return {
      doc: {
        ...updated,
        ...statusResult,
        ...metrics,
        agreement_status: agreementStatus,
      },
      flags: { on_first_reply: true },
    };
  }

  return {};
}

/* ------------------------------------------------------------------ */
/*  Assigned Users Failure                                             */
/* ------------------------------------------------------------------ */

export function recordAssignedUsersOnFailure(assignedUsers: string[]): string | null {
  if (!assignedUsers || assignedUsers.length === 0) return null;
  const users = assignedUsers.join(", ");
  return `First Response SLA Failed by ${users}`;
}

/* ------------------------------------------------------------------ */
/*  SLA Doctypes                                                       */
/* ------------------------------------------------------------------ */

export function getSlaDoctypes(slas: ServiceLevelAgreement[]): string[] {
  const doctypes = new Set<string>();
  for (const sla of slas) {
    if (sla.enabled) doctypes.add(sla.document_type);
  }
  return Array.from(doctypes);
}

/* ------------------------------------------------------------------ */
/*  Service Level Priority lookup                                      */
/* ------------------------------------------------------------------ */

export function getServiceLevelAgreementPriority(
  sla: ServiceLevelAgreement,
  priorityName: string
): { priority: string; response_time: number; resolution_time: number } | null {
  const p = sla.priorities.find((pr) => pr.priority === priorityName);
  if (!p) return null;
  return {
    priority: p.priority,
    response_time: p.response_time,
    resolution_time: p.resolution_time,
  };
}
