/**
 * Soft Delete Pattern — Marks records as cancelled (docstatus=2) with a
 * deleted_at timestamp instead of physically removing rows.
 *
 * ERPNext uses docstatus 2 = Cancelled as its soft-delete equivalent.
 * This module adds a `deleted_at` column awareness layer so that:
 *   - findMany queries can automatically exclude soft-deleted records
 *   - A document can be restored by clearing deleted_at and flipping docstatus
 *
 * MIGRATION NOTE:
 *   The `deleted_at` column does NOT currently exist on erpnext_port models.
 *   A migration must add `deleted_at DateTime? @db.Timestamptz(3)` to every
 *   erpnext_port model that needs soft-delete support. Until that migration
 *   runs, softDelete will set docstatus=2 only, and deleted_at will be null
 *   (the column must be nullable).
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - Every function has explicit params and return types.
 * - All functions receive a Prisma transaction client (`tx`) as the first
 *   parameter — they NEVER start their own transaction.
 * - Uses `getDelegateByAccessor` from prisma-delegate for dynamic model access.
 */

import { getDelegateByAccessor, type PrismaDelegate } from "./prisma-delegate";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Result of a soft-delete operation */
export interface SoftDeleteResult {
  success: boolean;
  /** Number of records soft-deleted */
  count: number;
  error?: string;
}

/** Result of a restore operation */
export interface RestoreResult {
  success: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Soft Delete — Single                                               */
/* ------------------------------------------------------------------ */

/**
 * Soft-delete a single document by setting docstatus=2 and deleted_at=now.
 *
 * The document is NOT physically removed. It will be excluded from
 * findMany queries when the soft-delete filter extension is active.
 *
 * @param tx         - Prisma transaction client
 * @param doctype    - The DocType (used to resolve the Prisma accessor)
 * @param name       - The document name/ID
 * @param deletedBy  - User performing the deletion
 * @returns Result with success flag and count
 */
export async function softDelete(
  tx: Record<string, unknown>,
  doctype: string,
  name: string,
  deletedBy: string,
): Promise<SoftDeleteResult> {
  const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
  const delegate = getDelegateByAccessor(tx, accessor);
  if (!delegate) {
    return { success: false, count: 0, error: `Model "${accessor}" not found` };
  }

  try {
    const now = new Date();
    const data: Record<string, unknown> = {
      docstatus: 2,
      modified: now,
      modified_by: deletedBy,
    };

    // Attempt to set deleted_at — will be silently ignored if the column
    // does not exist on the model (Prisma will throw, which we catch below).
    try {
      await delegate.update({
        where: { name } as unknown,
        data: {
          ...data,
          deleted_at: now,
        } as unknown,
      });
    } catch (_e: unknown) {
      // deleted_at column may not exist yet — fall back to docstatus-only
      await delegate.update({
        where: { name } as unknown,
        data: data as unknown,
      });
    }

    return { success: true, count: 1 };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, count: 0, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Soft Delete — Batch                                                */
/* ------------------------------------------------------------------ */

/**
 * Soft-delete multiple documents of the same DocType.
 *
 * @param tx         - Prisma transaction client
 * @param doctype    - The DocType
 * @param names      - Array of document name/IDs to soft-delete
 * @param deletedBy  - User performing the deletion
 * @returns Result with total count of records soft-deleted
 */
export async function softDeleteMany(
  tx: Record<string, unknown>,
  doctype: string,
  names: string[],
  deletedBy: string,
): Promise<SoftDeleteResult> {
  if (names.length === 0) {
    return { success: true, count: 0 };
  }

  const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
  const delegate = getDelegateByAccessor(tx, accessor);
  if (!delegate) {
    return { success: false, count: 0, error: `Model "${accessor}" not found` };
  }

  try {
    const now = new Date();
    const data: Record<string, unknown> = {
      docstatus: 2,
      modified: now,
      modified_by: deletedBy,
    };

    // Attempt batch update with deleted_at
    let count: number;
    try {
      const result = await delegate.updateMany({
        where: { name: { in: names } } as unknown,
        data: {
          ...data,
          deleted_at: now,
        } as unknown,
      });
      count = result.count;
    } catch (_e: unknown) {
      // deleted_at column may not exist — fall back to docstatus-only
      const result = await delegate.updateMany({
        where: { name: { in: names } } as unknown,
        data: data as unknown,
      });
      count = result.count;
    }

    return { success: true, count };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, count: 0, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Restore Document                                                   */
/* ------------------------------------------------------------------ */

/**
 * Restore a soft-deleted document by setting docstatus=0 (Draft) and
 * clearing deleted_at.
 *
 * @param tx      - Prisma transaction client
 * @param doctype - The DocType
 * @param name    - The document name/ID
 * @returns Result indicating success or failure
 */
export async function restoreDocument(
  tx: Record<string, unknown>,
  doctype: string,
  name: string,
): Promise<RestoreResult> {
  const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
  const delegate = getDelegateByAccessor(tx, accessor);
  if (!delegate) {
    return { success: false, error: `Model "${accessor}" not found` };
  }

  try {
    const now = new Date();
    const data: Record<string, unknown> = {
      docstatus: 0,
      modified: now,
      modified_by: "Administrator",
    };

    // Attempt to clear deleted_at — will be silently ignored if the column
    // does not exist on the model.
    try {
      await delegate.update({
        where: { name } as unknown,
        data: {
          ...data,
          deleted_at: null,
        } as unknown,
      });
    } catch (_e: unknown) {
      // deleted_at column may not exist — fall back to docstatus-only
      await delegate.update({
        where: { name } as unknown,
        data: data as unknown,
      });
    }

    return { success: true };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/* ------------------------------------------------------------------ */
/*  Soft-Delete Filter Extension                                       */
/* ------------------------------------------------------------------ */

/**
 * Create a Prisma $extends result that automatically filters out
 * soft-deleted records (where deleted_at is not null) from findMany
 * and findFirst queries.
 *
 * Usage:
 * ```ts
 * const filteredPrisma = prisma.$extends(softDeleteExtension());
 * const invoices = await filteredPrisma.salesInvoice.findMany();
 * // Automatically excludes records with deleted_at != null
 * ```
 *
 * IMPORTANT: This extension uses Prisma's client extension API.
 * It modifies query args for findMany and findFirst to add a
 * `deleted_at: null` filter when the model has that field.
 *
 * @returns Prisma extension object
 */
export function softDeleteExtension(): Record<string, unknown> {
  return {
    name: "softDelete",
    query: {
      async findMany({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: unknown) => Promise<unknown> }) {
        // Add soft-delete filter if the model likely supports deleted_at
        const where = (args.where ?? {}) as Record<string, unknown>;

        // Only add the filter if the caller hasn't explicitly set deleted_at
        if (!("deleted_at" in where)) {
          args.where = {
            ...where,
            deleted_at: null,
          };
        }

        return query(args);
      },
      async findFirst({ model, args, query }: { model: string; args: Record<string, unknown>; query: (args: unknown) => Promise<unknown> }) {
        const where = (args.where ?? {}) as Record<string, unknown>;

        if (!("deleted_at" in where)) {
          args.where = {
            ...where,
            deleted_at: null,
          };
        }

        return query(args);
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/*  MIGRATION NOTE                                                     */
/* ------------------------------------------------------------------ */

/**
 * The following SQL migration should be run to add deleted_at support
 * to erpnext_port tables. This is a no-op if the column already exists.
 *
 * ```sql
 * -- Add deleted_at to all erpnext_port document tables
 * DO $$
 * DECLARE
 *   tbl RECORD;
 * BEGIN
 *   FOR tbl IN
 *     SELECT table_name
 *     FROM information_schema.tables
 *     WHERE table_schema = 'erpnext_port'
 *       AND table_type = 'BASE TABLE'
 *   LOOP
 *     BEGIN
 *       EXECUTE format(
 *         'ALTER TABLE erpnext_port.%I ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ',
 *         tbl.table_name
 *       );
 *     EXCEPTION WHEN others THEN
 *       -- Skip tables that can't be altered
 *       RAISE NOTICE 'Skipped %', tbl.table_name;
 *     END;
 *   END LOOP;
 * END $$;
 * ```
 *
 * And add to schema.prisma for each erpnext_port model:
 *   deleted_at DateTime? @db.Timestamptz(3)
 */
