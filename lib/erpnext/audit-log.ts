/**
 * Audit Log — Tracks CREATE, UPDATE, SUBMIT, CANCEL, DELETE, PRINT, EMAIL
 * actions on ERPNext documents for full traceability.
 *
 * SCHEMA NOTE:
 *   There is no `Version` or `AuditTrail` model in the erpnext_port Prisma
 *   schema yet. This module expects a model named `Version` in the
 *   erpnext_port schema with the following fields:
 *
 *     model Version {
 *       name        String    @id @db.VarChar(140)
 *       creation    DateTime? @default(now()) @db.Timestamptz(3)
 *       modified    DateTime? @updatedAt @db.Timestamptz(3)
 *       modified_by String?   @db.VarChar(255)
 *       owner       String?   @db.VarChar(255)
 *       docstatus   Int?      @default(0)
 *       idx         Int?      @default(0)
 *       ref_doctype String    @db.VarChar(140)
 *       docname     String    @db.VarChar(140)
 *       action      String    @db.VarChar(50)
 *       user        String    @db.VarChar(255)
 *       old_values  String?   // JSON string of previous field values
 *       new_values  String?   // JSON string of new field values
 *       timestamp   DateTime  @db.Timestamptz(3)
 *
 *       @@map("version")
 *       @@schema("erpnext_port")
 *     }
 *
 *   A migration must create this table before the audit-log functions
 *   will work. The module gracefully degrades — if the Version delegate
 *   is not available, it logs a warning and returns a no-op result.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - All functions receive a Prisma transaction client (`tx`) as the first
 *   parameter — they NEVER start their own transaction.
 * - Uses `getDelegateByAccessor` from prisma-delegate for dynamic model access.
 */

import { getDelegateByAccessor, type PrismaDelegate } from "./prisma-delegate";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** The set of auditable actions */
export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "SUBMIT"
  | "CANCEL"
  | "DELETE"
  | "PRINT"
  | "EMAIL";

/** Parameters for logging a single audit action */
export interface AuditLogParams {
  /** The DocType of the document (e.g. "Sales Invoice") */
  doctype: string;
  /** The name/ID of the document */
  docname: string;
  /** The action being performed */
  action: AuditAction;
  /** The user performing the action */
  user: string;
  /** Previous field values before the action (JSON-serializable object) */
  oldValues?: Record<string, unknown>;
  /** New field values after the action (JSON-serializable object) */
  newValues?: Record<string, unknown>;
  /** Timestamp of the action (defaults to now) */
  timestamp?: Date;
}

/** Internal row representation for the Version Prisma model */
interface VersionRow {
  name: string;
  creation: Date;
  modified: Date;
  modified_by: string;
  owner: string;
  docstatus: number;
  idx: number;
  ref_doctype: string;
  docname: string;
  action: string;
  user: string;
  old_values: string | null;
  new_values: string | null;
  timestamp: Date;
}

/** Result of a single audit log operation */
export interface AuditLogResult {
  success: boolean;
  error?: string;
}

/** Result of a batch audit log operation */
export interface BatchAuditLogResult {
  success: boolean;
  count: number;
  error?: string;
}

/** Audit trail entry returned by getAuditTrail */
export interface AuditTrailEntry {
  name: string;
  ref_doctype: string;
  docname: string;
  action: string;
  user: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  timestamp: Date;
  creation: Date;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let versionCounter = 0;

/**
 * Generate a unique name for a Version audit log row.
 */
function generateVersionName(doctype: string, docname: string): string {
  versionCounter += 1;
  const hash = Math.random().toString(36).substring(2, 10);
  return `VER-${doctype.substring(0, 3).toUpperCase()}-${docname.substring(0, 8)}-${hash}-${versionCounter}`;
}

/**
 * Resolve the Version delegate from a transaction client.
 */
function getVersionDelegate(
  tx: Record<string, unknown>,
): PrismaDelegate | null {
  return getDelegateByAccessor(tx, "version");
}

/**
 * Safely JSON.stringify, returning null on failure.
 */
function safeJsonStringify(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (_e: unknown) {
    return null;
  }
}

/**
 * Safely JSON.parse, returning null on failure.
 */
function safeJsonParse(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (_e: unknown) {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  logAction — Single audit log entry                                 */
/* ------------------------------------------------------------------ */

/**
 * Log a single audit action for a document.
 *
 * Creates a record in the erpnext_port.Version table tracking who did
 * what to which document, with optional before/after snapshots.
 *
 * @param tx     - Prisma transaction client
 * @param params - Audit log parameters
 * @returns Result indicating success or failure
 */
export async function logAction(
  tx: Record<string, unknown>,
  params: AuditLogParams,
): Promise<AuditLogResult> {
  const delegate = getVersionDelegate(tx);
  if (!delegate) {
    // Version model not yet in schema — log a warning and degrade gracefully
    console.warn(
      `[audit-log] Version model not found — audit entry skipped for ` +
      `${params.doctype} "${params.docname}" action=${params.action}`,
    );
    return { success: false, error: "Version model not found in Prisma schema" };
  }

  const now = new Date();
  const row: VersionRow = {
    name: generateVersionName(params.doctype, params.docname),
    creation: now,
    modified: now,
    modified_by: params.user,
    owner: params.user,
    docstatus: 0,
    idx: 0,
    ref_doctype: params.doctype,
    docname: params.docname,
    action: params.action,
    user: params.user,
    old_values: safeJsonStringify(params.oldValues),
    new_values: safeJsonStringify(params.newValues),
    timestamp: params.timestamp ?? now,
  };

  try {
    await delegate.create({
      data: row as unknown,
    });

    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  logBatchAction — Bulk audit log entries                             */
/* ------------------------------------------------------------------ */

/**
 * Log multiple audit actions in a single batch createMany call.
 * All entries are inserted within the same transaction context.
 *
 * @param tx      - Prisma transaction client
 * @param entries - Array of audit log parameters
 * @returns Result with count of entries created
 */
export async function logBatchAction(
  tx: Record<string, unknown>,
  entries: AuditLogParams[],
): Promise<BatchAuditLogResult> {
  if (entries.length === 0) {
    return { success: true, count: 0 };
  }

  const delegate = getVersionDelegate(tx);
  if (!delegate) {
    console.warn(
      `[audit-log] Version model not found — ${entries.length} audit entries skipped`,
    );
    return { success: false, count: 0, error: "Version model not found in Prisma schema" };
  }

  const now = new Date();
  const rows: VersionRow[] = entries.map((params, idx) => ({
    name: generateVersionName(params.doctype, params.docname),
    creation: now,
    modified: now,
    modified_by: params.user,
    owner: params.user,
    docstatus: 0,
    idx: idx + 1,
    ref_doctype: params.doctype,
    docname: params.docname,
    action: params.action,
    user: params.user,
    old_values: safeJsonStringify(params.oldValues),
    new_values: safeJsonStringify(params.newValues),
    timestamp: params.timestamp ?? now,
  }));

  try {
    await delegate.createMany({
      data: rows as unknown[],
      skipDuplicates: true,
    });

    return { success: true, count: rows.length };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, count: 0, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  getAuditTrail — Query full history for a document                  */
/* ------------------------------------------------------------------ */

/**
 * Retrieve the full audit trail for a document.
 *
 * Returns all Version entries for the given doctype + docname,
 * ordered by timestamp ascending (oldest first).
 *
 * @param doctype - The DocType to query
 * @param docname - The document name/ID
 * @returns Array of audit trail entries
 */
export async function getAuditTrail(
  doctype: string,
  docname: string,
): Promise<AuditTrailEntry[]> {
  const delegate = getVersionDelegate(
    prisma as unknown as Record<string, unknown>,
  );
  if (!delegate) return [];

  try {
    const records = await delegate.findMany({
      where: {
        ref_doctype: doctype,
        docname: docname,
      } as unknown,
    }) as unknown[];

    if (!Array.isArray(records)) return [];

    return (records as Record<string, unknown>[])
      .map((r) => ({
        name: r.name as string,
        ref_doctype: r.ref_doctype as string,
        docname: r.docname as string,
        action: r.action as string,
        user: r.user as string,
        old_values: safeJsonParse(r.old_values as string | null),
        new_values: safeJsonParse(r.new_values as string | null),
        timestamp: r.timestamp as Date,
        creation: r.creation as Date,
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (_e: unknown) {
    return [];
  }
}
