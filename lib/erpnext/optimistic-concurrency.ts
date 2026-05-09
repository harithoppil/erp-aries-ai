/**
 * Optimistic Concurrency Control — Prevents lost-update anomalies when
 * multiple users or processes try to modify the same document concurrently.
 *
 * Uses the `modified` field (present on all erpnext_port models with
 * `@updatedAt`) as the concurrency token. Before updating, the current
 * modified timestamp is compared against the caller's expected value.
 * If they differ, another transaction has already changed the document.
 *
 * CONCURRENCY TOKEN NOTE:
 *   The erpnext_port Prisma schema does NOT have a `version` Int field or
 *   `_user_tags` field on document models. All models DO have `modified
 *   DateTime? @updatedAt @db.Timestamptz(3)`, which is the standard
 *   ERPNext approach for detecting concurrent edits. This module uses
 *   `modified` as the concurrency token.
 *
 *   If a numeric version field is added to the schema in the future,
 *   this module can be extended to use that instead for higher precision.
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - Uses `getDelegateByAccessor` from prisma-delegate for dynamic model access.
 */

import { prisma } from "@/lib/prisma";
import { getDelegate, getDelegateByAccessor } from "./prisma-delegate";
import { safeTransaction, type TxClient } from "./transaction-wrapper";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Thrown when the concurrency token (modified timestamp) does not match */
export class ConcurrencyConflictError extends Error {
  public readonly doctype: string;
  public readonly docname: string;
  public readonly expectedModified: Date;
  public readonly actualModified: Date;

  constructor(
    doctype: string,
    docname: string,
    expectedModified: Date,
    actualModified: Date,
  ) {
    super(
      `Concurrency conflict on ${doctype} "${docname}": ` +
      `expected modified=${expectedModified.toISOString()}, ` +
      `actual modified=${actualModified.toISOString()}. ` +
      `The document was modified by another transaction.`,
    );
    this.name = "ConcurrencyConflictError";
    this.doctype = doctype;
    this.docname = docname;
    this.expectedModified = expectedModified;
    this.actualModified = actualModified;
  }
}

/** Result of an optimistic-lock update */
export interface OptimisticLockResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  conflict?: boolean;
}

/* ------------------------------------------------------------------ */
/*  withOptimisticLock                                                 */
/* ------------------------------------------------------------------ */

/**
 * Perform an update with optimistic concurrency control using the `modified`
 * field as the concurrency token.
 *
 * Flow:
 * 1. Read the current document, capturing its `modified` value
 * 2. Compare the current `modified` against the caller's `expectedModified`
 * 3. If they match, run `updateFn` inside a safeTransaction
 * 4. If they don't match, throw ConcurrencyConflictError
 *
 * The updateFn receives the transaction client and must return the data
 * that safeTransaction should return as `data`.
 *
 * @param doctype          - The DocType name
 * @param name             - The document name/ID
 * @param expectedModified - The modified timestamp the caller expects
 * @param updateFn         - Function to execute within the transaction
 * @returns Result with success flag, data, or conflict info
 */
export async function withOptimisticLock<T>(
  doctype: string,
  name: string,
  expectedModified: Date,
  updateFn: (tx: TxClient) => Promise<T>,
): Promise<OptimisticLockResult<T>> {
  const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);

  // Step 1: Read the current document to check the concurrency token
  const delegate = getDelegate(prisma, accessor);
  if (!delegate) {
    return { success: false, error: `Model "${accessor}" not found` };
  }

  const current = await delegate.findUnique({
    where: { name },
  }) as Record<string, unknown> | null;

  if (!current) {
    return { success: false, error: `${doctype} "${name}" not found` };
  }

  // Step 2: Compare modified timestamps
  const actualModified = current.modified as Date | null;
  if (!actualModified) {
    return { success: false, error: `${doctype} "${name}" has no modified timestamp` };
  }

  if (actualModified.getTime() !== expectedModified.getTime()) {
    return {
      success: false,
      conflict: true,
      error: new ConcurrencyConflictError(
        doctype,
        name,
        expectedModified,
        actualModified,
      ).message,
    };
  }

  // Step 3: Run update within safeTransaction
  const result = await safeTransaction(async (tx) => {
    // Re-verify the modified timestamp inside the transaction to prevent
    // a race between the read above and the write below
    const txRecord = tx as unknown as Record<string, unknown>;
    const txDelegate = getDelegateByAccessor(txRecord, accessor);
    if (!txDelegate) {
      throw new Error(`Model "${accessor}" not found in transaction`);
    }

    const fresh = await txDelegate.findUnique({
      where: { name },
    }) as Record<string, unknown> | null;

    if (!fresh) {
      throw new Error(`${doctype} "${name}" not found (deleted during lock check)`);
    }

    const freshModified = fresh.modified as Date | null;
    if (!freshModified || freshModified.getTime() !== expectedModified.getTime()) {
      throw new ConcurrencyConflictError(
        doctype,
        name,
        expectedModified,
        freshModified ?? new Date(0),
      );
    }

    // Run the caller's update function
    return updateFn(tx);
  });

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Check if the error is a concurrency conflict
  const isConflict = result.code === "UNKNOWN" &&
    result.error?.includes("Concurrency conflict");

  return {
    success: false,
    error: result.error,
    conflict: isConflict,
  };
}

/* ------------------------------------------------------------------ */
/*  checkModifiedVersion — Read-only check                             */
/* ------------------------------------------------------------------ */

/**
 * Read the current `modified` timestamp for a document without performing
 * any update. Useful for pre-flight checks before rendering an edit form.
 *
 * @param doctype - The DocType name
 * @param name    - The document name/ID
 * @returns The current modified timestamp, or null if not found
 */
export async function getCurrentModified(
  doctype: string,
  name: string,
): Promise<Date | null> {
  const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
  const delegate = getDelegate(prisma, accessor);
  if (!delegate) return null;

  try {
    const doc = await delegate.findUnique({
      where: { name },
    }) as Record<string, unknown> | null;

    if (!doc) return null;
    return (doc.modified as Date) ?? null;
  } catch (_e: unknown) {
    return null;
  }
}
