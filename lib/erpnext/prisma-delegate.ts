import { PrismaClient } from "@/prisma/client";

// ── DMMF field type ──────────────────────────────────────────────────────────

export interface DmmfField {
  name: string;
  type: string;
  kind: string;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  isGenerated: boolean;
  isList: boolean;
  hasDefaultValue: boolean;
  default?: unknown;
  dbName?: string | null;
  relationName?: string | null;
  relationType?: string | null;
  relationFromFields?: string[] | null;
  relationToFields?: string[] | null;
}

// ── DMMF model type ──────────────────────────────────────────────────────────

export interface DmmfModel {
  name: string;
  dbName?: string | null;
  fields: DmmfField[];
  uniqueFields: string[][];
  uniqueIndexes: unknown[];
  primaryKey?: { fields: string[] } | null;
}

// ── Prisma delegate type ─────────────────────────────────────────────────────

/** Type for any Prisma model delegate (has findMany, create, etc.) */
export interface PrismaDelegate {
  findUnique(args: unknown): Promise<unknown>;
  findMany(args?: unknown): Promise<unknown[]>;
  findFirst(args?: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  createMany(args: { data: unknown[]; skipDuplicates?: boolean }): Promise<{ count: number }>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<unknown>;
  deleteMany(args: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
}

// ── Helper functions ──────────────────────────────────────────────────────────

const ACRONYMS = new Set(['bom', 'uom', 'gst', 'pos', 'gl', 'hrm', 'crm', 'erp', 'hsm', 'sku', 'qty', 'amt']);

/** Convert a kebab-case/camelCase/PascalCase doctype to a human-readable label. */
export function toDisplayLabel(doctype: string): string {
  return doctype
    .split(/[-_]/)
    .map((part) => ACRONYMS.has(part.toLowerCase()) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** Convert any doctype string (PascalCase, kebab-case, snake_case) to the camelCase Prisma accessor. */
export function toAccessor(doctype: string): string {
  // If it's already PascalCase or camelCase (no hyphens/underscores), use directly
  if (!/[-_]/.test(doctype)) {
    return doctype.charAt(0).toLowerCase() + doctype.slice(1);
  }
  // Normalize: kebab-case / snake_case → PascalCase → camelCase
  const pascal = doctype
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** Safely resolve a Prisma model delegate from a DocType name. */
export function getDelegate(prisma: PrismaClient, doctype: string): PrismaDelegate | null {
  const accessor = toAccessor(doctype);
  const delegate = (prisma as unknown as Record<string, unknown>)[accessor];
  if (!delegate || typeof delegate !== "object" || !("findMany" in (delegate as object))) return null;
  return delegate as PrismaDelegate;
}

/** Safely resolve a Prisma model delegate from a transaction client. */
export function getTxDelegate(tx: Record<string, unknown>, doctype: string): PrismaDelegate | null {
  const accessor = toAccessor(doctype);
  const delegate = tx[accessor];
  if (!delegate || typeof delegate !== "object" || !("findMany" in (delegate as object))) return null;
  return delegate as PrismaDelegate;
}

/** Safely resolve a Prisma delegate using an already-computed accessor string. */
export function getDelegateByAccessor(
  client: PrismaClient | Record<string, unknown>,
  accessor: string,
): PrismaDelegate | null {
  const delegate = (client as unknown as Record<string, unknown>)[accessor];
  if (!delegate || typeof delegate !== "object" || !("findMany" in (delegate as object))) return null;
  return delegate as PrismaDelegate;
}

// ── Filter types ──────────────────────────────────────────────────────────────

export type FilterTriple = [string, string, string | number | boolean | null | (string | number)[]];
export type WhereClause = Record<string, unknown>;
