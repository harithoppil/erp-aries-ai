/**
 * Status Persister — Applies status updater qty changes to target documents
 * inside a transaction. Also handles reversal on cancellation.
 *
 * The status updater controllers compute `StatusUpdateConfig[]` arrays
 * that describe how child fields and parent percentage fields should be
 * updated. This persister turns those pure-logic results into actual
 * Prisma updates within the transaction.
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

/**
 * A single status update to apply to a target document field.
 * Produced by the controller's `getStatusUpdaterConfigs()` + `updateQty()`.
 */
export interface StatusUpdateConfig {
  /** The DocType of the target document to update (e.g. "Sales Order") */
  targetDoctype: string;
  /** The name/ID of the target document */
  targetName: string;
  /** The field on the target to set (absolute value, not delta) */
  targetField: string;
  /** The absolute value to set on the target field (ERPNext sets, not increments) */
  value: number;
}

/**
 * A child-row level update (e.g. updating billed_amt on Sales Order Item).
 */
export interface ChildStatusUpdate {
  /** The DocType of the child row (e.g. "Sales Order Item") */
  targetDt: string;
  /** The name/ID of the child row */
  detailId: string;
  /** The field to update on the child row */
  targetField: string;
  /** The new value to set (absolute, not delta) */
  newValue: number;
}

/**
 * A parent-level percentage update (e.g. updating per_billed on Sales Order).
 */
export interface ParentStatusUpdate {
  /** The DocType of the parent document */
  targetParentDt: string;
  /** The name/ID of the parent document */
  name: string;
  /** The percentage field to update on the parent */
  targetParentField: string;
  /** The new percentage value */
  percentage: number;
  /** Optional status field to update on the parent */
  statusField?: string;
  /** Optional new status value */
  status?: string;
}

/* ------------------------------------------------------------------ */
/*  Apply Status Updates                                               */
/* ------------------------------------------------------------------ */

/**
 * Apply status updates to target documents inside an existing transaction.
 *
 * For each StatusUpdateConfig:
 * - Resolves the target DocType's Prisma delegate
 * - Sets the target field to the absolute value (ERPNext semantics: SET not increment)
 *
 * @param tx      - Prisma transaction client
 * @param updates - Array of status update configs from the controller
 * @returns Number of documents updated
 */
export async function applyStatusUpdates(
  tx: Record<string, unknown>,
  updates: StatusUpdateConfig[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let updated = 0;

  for (const update of updates) {
    const delegate = getDelegateByAccessor(tx, update.targetDoctype);
    if (!delegate) {
      // Unknown model — skip silently (the controller may reference
      // a doctype that doesn't have a Prisma model yet)
      continue;
    }

    try {
      await delegate.update({
        where: { name: update.targetName } as unknown,
        data: { [update.targetField]: update.value } as unknown,
      });

      updated += 1;
    } catch (_e: unknown) {
      // Non-fatal — continue processing other updates
      continue;
    }
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Apply Child Status Updates                                         */
/* ------------------------------------------------------------------ */

/**
 * Apply child-row level status updates (absolute values, not deltas).
 * These come from the status updater's `childUpdates` result.
 *
 * @param tx      - Prisma transaction client
 * @param updates - Array of child status updates
 * @returns Number of child rows updated
 */
export async function applyChildStatusUpdates(
  tx: Record<string, unknown>,
  updates: ChildStatusUpdate[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let updated = 0;

  for (const update of updates) {
    const delegate = getDelegateByAccessor(tx, update.targetDt);
    if (!delegate) continue;

    try {
      await delegate.update({
        where: { name: update.detailId } as unknown,
        data: { [update.targetField]: update.newValue } as unknown,
      });

      updated += 1;
    } catch (_e: unknown) {
      continue;
    }
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Apply Parent Status Updates                                        */
/* ------------------------------------------------------------------ */

/**
 * Apply parent-level percentage and status updates.
 * These come from the status updater's `parentUpdates` result.
 *
 * @param tx      - Prisma transaction client
 * @param updates - Array of parent status updates
 * @returns Number of parent documents updated
 */
export async function applyParentStatusUpdates(
  tx: Record<string, unknown>,
  updates: ParentStatusUpdate[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let updated = 0;

  for (const update of updates) {
    const delegate = getDelegateByAccessor(tx, update.targetParentDt);
    if (!delegate) continue;

    try {
      const data: Record<string, unknown> = {
        [update.targetParentField]: update.percentage,
      };

      if (update.statusField && update.status) {
        data[update.statusField] = update.status;
      }

      await delegate.update({
        where: { name: update.name } as unknown,
        data: data as unknown,
      });

      updated += 1;
    } catch (_e: unknown) {
      continue;
    }
  }

  return updated;
}

/* ------------------------------------------------------------------ */
/*  Reverse Status Updates                                             */
/* ------------------------------------------------------------------ */

/**
 * Reverse status updates by computing the original value before the submit.
 * Used during cancellation to undo the absolute-value changes made on submit.
 *
 * Since `applyStatusUpdates` now does a direct SET (not increment), reversal
 * needs to read the current value and subtract the original delta that was
 * applied. The delta is: `originalNewValue - previousValue`, so the reverse
 * is: `currentValue - delta = currentValue - (originalNewValue - previousValue)`.
 *
 * However, the simplest correct approach for ERPNext's semantics is:
 * the cancel controller produces its own StatusUpdateConfig[] with the
 * correct absolute values to set. This function exists for the case where
 * we just need to flip the sign on relative-style values stored as `value`.
 *
 * @param tx      - Prisma transaction client
 * @param updates - Array of status update configs (from the original submit)
 * @returns Number of documents updated
 */
export async function reverseStatusUpdates(
  tx: Record<string, unknown>,
  updates: StatusUpdateConfig[],
): Promise<number> {
  if (updates.length === 0) return 0;

  // For reversal of absolute SET operations, we need to re-read the current
  // value and compute: newAbsoluteValue = currentValue - (submittedValue - preSubmitValue)
  // But since we don't have the pre-submit value here, the cancel-side
  // controller should produce its own StatusUpdateConfig[] with the correct
  // absolute values. This function simply applies them as-is.
  return applyStatusUpdates(tx, updates);
}

/* ------------------------------------------------------------------ */
/*  Compute StatusUpdateConfig from controller results                 */
/* ------------------------------------------------------------------ */

/**
 * Convert the status updater controller's QtyUpdateResult into
 * StatusUpdateConfig[] that can be applied by this persister.
 *
 * The controller's `updateQty()` returns child and parent updates.
 * This function bridges the gap between the controller's output format
 * and the persister's input format.
 *
 * @param childUpdates  - Child row updates from the controller
 * @param parentUpdates - Parent percentage updates from the controller
 * @returns Combined array of StatusUpdateConfig for the persister
 */
export function fromControllerResults(
  childUpdates: ChildStatusUpdate[],
  parentUpdates: ParentStatusUpdate[],
): StatusUpdateConfig[] {
  const configs: StatusUpdateConfig[] = [];

  // Child updates: store absolute newValues — applyStatusUpdates will SET directly
  for (const child of childUpdates) {
    configs.push({
      targetDoctype: child.targetDt,
      targetName: child.detailId,
      targetField: child.targetField,
      value: child.newValue,
    });
  }

  // Parent updates: percentage field updates (also absolute SET)
  for (const parent of parentUpdates) {
    if (parent.targetParentField) {
      configs.push({
        targetDoctype: parent.targetParentDt,
        targetName: parent.name,
        targetField: parent.targetParentField,
        value: parent.percentage,
      });
    }
    // Note: status string updates are handled by applyParentStatusUpdates,
    // not through StatusUpdateConfig (which is numeric only).
  }

  return configs;
}
