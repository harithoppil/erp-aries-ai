/**
 * Pure business logic ported from ERPNext CRM Contract DocType.
 * Source: erpnext/crm/doctype/contract/contract.py
 *
 * These functions accept plain objects and return validation results / updates.
 * They do NOT perform any I/O (no Prisma, no Frappe API calls).
 */

export type ContractStatus = "Unsigned" | "Active" | "Inactive" | "Cancelled";
export type FulfilmentStatus =
  | "N/A"
  | "Unfulfilled"
  | "Partially Fulfilled"
  | "Fulfilled"
  | "Lapsed";
export type PartyType = "Customer" | "Supplier" | "Employee";
export type DocumentType =
  | ""
  | "Quotation"
  | "Project"
  | "Sales Order"
  | "Purchase Order"
  | "Sales Invoice"
  | "Purchase Invoice";

export interface ContractFulfilmentChecklist {
  id: string;
  name: string;
  parent_id?: string | null;
  fulfilled: boolean;
  requirement?: string | null;
  notes?: string | null;
  amended_from?: string | null;
  idx: number;
}

export interface Contract {
  id: string;
  name: string;
  party_type: PartyType;
  party_name: string;
  party_full_name?: string | null;
  party_user?: string | null;
  is_signed: boolean;
  status: ContractStatus;
  start_date?: Date | null;
  end_date?: Date | null;
  signee?: string | null;
  signed_on?: Date | null;
  signed_by_company?: string | null;
  ip_address?: string | null;
  contract_template?: string | null;
  contract_terms: string;
  requires_fulfilment: boolean;
  fulfilment_deadline?: Date | null;
  fulfilment_status: FulfilmentStatus;
  fulfilment_terms: ContractFulfilmentChecklist[];
  document_type?: DocumentType | null;
  document_name?: string | null;
  amended_from?: string | null;
  docstatus: number;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: string[];
  updates: Partial<T>;
}

export interface ContractValidationContext {
  now: Date;
  partyRecord?: Record<string, unknown>;
}

/* ────────────────────────────────────────────────────────────────
 *  Validation entry-point
 * ──────────────────────────────────────────────────────────────── */

export function validateContract(
  contract: Contract,
  ctx: ContractValidationContext
): ValidationResult<Contract> {
  const errors: string[] = [];
  const updates: Partial<Contract> = {};

  // 1. Set missing values (e.g. party_full_name)
  const missingUpdates = setMissingValues(contract, ctx.partyRecord);
  Object.assign(updates, missingUpdates);

  // 2. Date validation
  const dateError = validateDates(contract);
  if (dateError) {
    errors.push(dateError);
  }

  // 3. Status updates
  updates.status = getContractStatus(
    contract.start_date ?? null,
    contract.end_date ?? null,
    contract.is_signed,
    ctx.now
  );

  updates.fulfilment_status = getFulfilmentStatus(contract, ctx.now);

  return {
    valid: errors.length === 0,
    errors,
    updates,
  };
}

/* ────────────────────────────────────────────────────────────────
 *  Missing values
 * ──────────────────────────────────────────────────────────────── */

export function setMissingValues(
  contract: Contract,
  partyRecord?: Record<string, unknown>
): Partial<Contract> {
  const updates: Partial<Contract> = {};

  if (!contract.party_full_name && partyRecord) {
    const field = `${contract.party_type.toLowerCase()}_name`;
    const value = partyRecord[field];
    if (typeof value === "string") {
      updates.party_full_name = value;
    }
  }

  return updates;
}

/* ────────────────────────────────────────────────────────────────
 *  Date validation
 * ──────────────────────────────────────────────────────────────── */

export function validateDates(contract: Contract): string | null {
  if (
    contract.end_date &&
    contract.start_date &&
    contract.end_date < contract.start_date
  ) {
    return "End Date cannot be before Start Date.";
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────
 *  Contract status
 * ──────────────────────────────────────────────────────────────── */

export function getContractStatus(
  startDate: Date | null,
  endDate: Date | null,
  isSigned: boolean,
  now: Date
): ContractStatus {
  if (!isSigned) {
    return "Unsigned";
  }
  return computeStatusFromDates(startDate, endDate, now);
}

function computeStatusFromDates(
  startDate: Date | null,
  endDate: Date | null,
  now: Date
): ContractStatus {
  if (!endDate) {
    return "Active";
  }

  const start = startDate ?? new Date(0);
  const n = stripTime(now);
  const s = stripTime(start);
  const e = stripTime(endDate);

  return s <= n && n <= e ? "Active" : "Inactive";
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/* ────────────────────────────────────────────────────────────────
 *  Fulfilment status
 * ──────────────────────────────────────────────────────────────── */

export function getFulfilmentStatus(
  contract: Contract,
  now: Date
): FulfilmentStatus {
  if (!contract.requires_fulfilment) {
    return "N/A";
  }

  const progress = getFulfilmentProgress(contract.fulfilment_terms);
  const total = contract.fulfilment_terms.length;

  let status: FulfilmentStatus = "Unfulfilled";

  if (progress === 0) {
    status = "Unfulfilled";
  } else if (progress < total) {
    status = "Partially Fulfilled";
  } else if (progress === total) {
    status = "Fulfilled";
  }

  if (status !== "Fulfilled" && contract.fulfilment_deadline) {
    const nowDate = stripTime(now);
    const deadlineDate = stripTime(contract.fulfilment_deadline);
    if (nowDate > deadlineDate) {
      status = "Lapsed";
    }
  }

  return status;
}

export function getFulfilmentProgress(
  fulfilmentTerms: ContractFulfilmentChecklist[]
): number {
  return fulfilmentTerms.filter((term) => term.fulfilled).length;
}

/* ────────────────────────────────────────────────────────────────
 *  Lifecycle hooks (return updates to be applied by caller)
 * ──────────────────────────────────────────────────────────────── */

export function beforeSubmit(contract: Contract, user: string): Partial<Contract> {
  return {
    signed_by_company: user,
  };
}

export function onDiscard(): Partial<Contract> {
  return {
    status: "Cancelled",
  };
}

export function beforeUpdateAfterSubmit(
  contract: Contract,
  now: Date
): Partial<Contract> {
  return {
    status: getContractStatus(
      contract.start_date ?? null,
      contract.end_date ?? null,
      contract.is_signed,
      now
    ),
    fulfilment_status: getFulfilmentStatus(contract, now),
  };
}

/* ────────────────────────────────────────────────────────────────
 *  Batch status update (daily hook equivalent)
 * ──────────────────────────────────────────────────────────────── */

export interface ContractStatusUpdate {
  name: string;
  status: ContractStatus;
}

export function updateStatusForContracts(
  contracts: Contract[],
  now: Date
): ContractStatusUpdate[] {
  const updates: ContractStatusUpdate[] = [];

  for (const contract of contracts) {
    if (!contract.is_signed || contract.docstatus !== 1) {
      continue;
    }

    const status = computeStatusFromDates(
      contract.start_date ?? null,
      contract.end_date ?? null,
      now
    );

    updates.push({ name: contract.name, status });
  }

  return updates;
}
