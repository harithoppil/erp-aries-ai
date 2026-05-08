/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ⚠️  DEPRECATED — DO NOT USE IN NEW CODE
 *
 * This file is a TYPE STUB only. All functions throw "Migrate to Prisma".
 * It exists solely to keep existing imports compilable during the migration.
 *
 * NEW code must use:
 *   import { prisma } from "@/lib/prisma";
 *   import { validateX } from "@/lib/erpnext/controllers/...";
 *
 * Agents: DO NOT import or reference this file. Write pure logic in
 * lib/erpnext/controllers/ instead.
 * ═══════════════════════════════════════════════════════════════════════════════
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

export class FrappeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FrappeError";
  }
}

function migrateError(): never {
  throw new Error(
    "Frappe client is deprecated. Migrate to Prisma: import { prisma } from '@/lib/prisma'"
  );
}

/* ── DocType CRUD ────────────────────────────────────────────────────────── */

export async function frappeGetList<T = unknown>(
  doctype: string,
  _options?: Record<string, unknown>
): Promise<T[]> {
  return migrateError();
}

export async function frappeGetDoc<T = unknown>(
  _doctype: string,
  _name?: string,
  _options?: Record<string, unknown>
): Promise<T> {
  return migrateError();
}

export async function frappeInsertDoc<T = unknown>(
  _doctype: string,
  _data: Record<string, unknown>
): Promise<T> {
  return migrateError();
}

export async function frappeUpdateDoc<T = unknown>(
  _doctype: string,
  _name: string,
  _data: Record<string, unknown>
): Promise<T> {
  return migrateError();
}

export async function frappeDeleteDoc(
  _doctype: string,
  _name: string
): Promise<void> {
  return migrateError();
}

export async function frappeSubmitDoc<T = unknown>(
  _doctype: string,
  _name: string
): Promise<T> {
  return migrateError();
}

export async function frappeCancelDoc<T = unknown>(
  _doctype: string,
  _name: string
): Promise<T> {
  return migrateError();
}

/* ── RPC / Method calls ──────────────────────────────────────────────────── */

export async function frappeCallMethod<T = unknown>(
  _method: string,
  _args?: Record<string, unknown>
): Promise<T> {
  return migrateError();
}

/* ── Reports ─────────────────────────────────────────────────────────────── */

export async function frappeRunReport<T = unknown>(
  _report: string,
  _filters?: Record<string, unknown>
): Promise<T[]> {
  return migrateError();
}

/* ── Misc ────────────────────────────────────────────────────────────────── */

export async function frappeGetCount(
  _doctype: string,
  _filters?: Record<string, unknown>
): Promise<number> {
  return migrateError();
}

export async function frappeSetValue(
  _doctype: string,
  _name: string,
  _fieldname: string,
  _value: unknown
): Promise<void> {
  return migrateError();
}

export async function frappeUploadFile(
  _file: File | Buffer,
  _fileName?: string,
  _options?: { attach_to_doctype?: string; attach_to_name?: string; is_private?: boolean; doctype?: string; docname?: string }
): Promise<{ file_url: string }> {
  return migrateError();
}

export function frappePath(_path: string): string {
  return migrateError();
}
