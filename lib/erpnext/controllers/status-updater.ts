/**
 * Ported from erpnext/controllers/status_updater.py
 * Status transition and quantity-update logic for ERPNext documents.
 *
 * Pure business logic — no Frappe / Prisma imports.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StatusUpdaterConfig {
  source_dt: string;
  target_dt: string;
  join_field: string;
  target_field: string;
  target_parent_dt?: string;
  target_parent_field?: string;
  target_ref_field: string;
  source_field: string;
  percent_join_field?: string;
  percent_join_field_parent?: string;
  status_field?: string;
  keyword?: string;
  second_source_dt?: string;
  second_source_field?: string;
  second_join_field?: string;
  second_source_extra_cond?: string;
  extra_cond?: string;
  cond?: string;
  validate_qty?: boolean;
  no_allowance?: boolean;
  overflow_type?: string;
}

export interface StatusDoc {
  doctype: string;
  docstatus: number;
  status?: string;
  per_delivered?: number;
  per_billed?: number;
  per_received?: number;
  per_returned?: number;
  per_ordered?: number;
  per_picked?: number;
  skip_delivery_note?: boolean;
  is_return?: boolean;
  advance_payment_status?: string;
  material_request_type?: string;
  pos_closing_entry?: string;
  purpose?: string;
  delivery_status?: string;
  grand_total?: number;
  billing_status?: string;
  is_internal_customer?: boolean;
  is_internal_supplier?: boolean;
  /** Boolean flags for method-based status rules (e.g. has_lost_quotation). */
  [key: string]: string | number | boolean | undefined;
}

export type DocLike = Record<string, string | number | boolean | undefined>;

export interface ChildItem {
  doctype: string;
  name?: string;
  idx?: number;
  qty?: number;
  item_code?: string;
  rate?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface AllowanceResult {
  allowance: number;
  itemAllowance: Record<string, { qty?: number; amount?: number }>;
  globalQtyAllowance: number | null;
  globalAmountAllowance: number | null;
}

export interface StatusRule {
  status: string;
  condition: null | ((doc: StatusDoc) => boolean);
}

export interface QtyUpdateResult {
  childUpdates: Array<{
    detailId: string;
    targetDt: string;
    targetField: string;
    newValue: number;
  }>;
  parentUpdates: Array<{
    name: string;
    targetParentDt: string;
    targetParentField: string;
    percentage: number;
    statusField?: string;
    status?: string;
  }>;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function flt(value: number | string | undefined, precision = 2): number {
  const v = typeof value === "string" ? parseFloat(value) : value ?? 0;
  const factor = 10 ** precision;
  return Math.round(v * factor) / factor;
}

function getDocProp(doc: DocLike, key: string): string | number | boolean | undefined {
  return doc[key];
}

/* ------------------------------------------------------------------ */
/*  validate_status (top-level)                                        */
/* ------------------------------------------------------------------ */

/**
 * Validates that a status string is one of the allowed options.
 */
export function validateStatusValue(
  status: string,
  options: string[]
): { success: true } | { success: false; error: string } {
  if (!options.includes(status)) {
    return {
      success: false,
      error: `Status must be one of ${options.join(", ")}`,
    };
  }
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  status_map                                                         */
/* ------------------------------------------------------------------ */

/**
 * Maps DocType names to status transition rules.
 * Rules are evaluated in reverse order; the first matching rule wins.
 */
export const statusMap: Record<string, StatusRule[]> = {
  Lead: [
    { status: "Lost Quotation", condition: (doc) => getDocProp(doc, "has_lost_quotation") === true },
    { status: "Opportunity", condition: (doc) => getDocProp(doc, "has_opportunity") === true },
    { status: "Quotation", condition: (doc) => getDocProp(doc, "has_quotation") === true },
    { status: "Converted", condition: (doc) => getDocProp(doc, "has_customer") === true },
  ],
  Opportunity: [
    { status: "Lost", condition: (doc) => doc.status === "Lost" },
    { status: "Lost", condition: (doc) => getDocProp(doc, "has_lost_quotation") === true },
    { status: "Quotation", condition: (doc) => getDocProp(doc, "has_active_quotation") === true },
    { status: "Converted", condition: (doc) => getDocProp(doc, "has_ordered_quotation") === true },
    { status: "Closed", condition: (doc) => doc.status === "Closed" },
  ],
  Quotation: [
    { status: "Draft", condition: null },
    { status: "Open", condition: (doc) => doc.docstatus === 1 },
    { status: "Lost", condition: (doc) => doc.status === "Lost" },
    { status: "Partially Ordered", condition: (doc) => getDocProp(doc, "is_partially_ordered") === true },
    { status: "Ordered", condition: (doc) => getDocProp(doc, "is_fully_ordered") === true },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
  ],
  "Sales Order": [
    { status: "Draft", condition: null },
    {
      status: "To Deliver and Bill",
      condition: (doc) =>
        flt(doc.per_delivered) < 100 &&
        flt(doc.per_billed) < 100 &&
        doc.docstatus === 1,
    },
    {
      status: "To Bill",
      condition: (doc) =>
        (flt(doc.per_delivered) >= 100 || doc.skip_delivery_note === true) &&
        flt(doc.per_billed) < 100 &&
        doc.docstatus === 1,
    },
    {
      status: "To Deliver",
      condition: (doc) =>
        flt(doc.per_delivered) < 100 &&
        flt(doc.per_billed) >= 100 &&
        doc.docstatus === 1 &&
        !doc.skip_delivery_note,
    },
    {
      status: "To Pay",
      condition: (doc) =>
        doc.advance_payment_status === "Requested" && doc.docstatus === 1,
    },
    {
      status: "Completed",
      condition: (doc) =>
        (flt(doc.per_delivered) >= 100 || doc.skip_delivery_note === true) &&
        flt(doc.per_billed) >= 100 &&
        doc.docstatus === 1,
    },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
    {
      status: "Closed",
      condition: (doc) => doc.status === "Closed" && doc.docstatus !== 2,
    },
    { status: "On Hold", condition: (doc) => doc.status === "On Hold" },
  ],
  "Purchase Order": [
    { status: "Draft", condition: null },
    {
      status: "To Bill",
      condition: (doc) =>
        flt(doc.per_received) >= 100 &&
        flt(doc.per_billed) < 100 &&
        doc.docstatus === 1,
    },
    {
      status: "To Receive",
      condition: (doc) =>
        flt(doc.per_received) < 100 &&
        flt(doc.per_billed) === 100 &&
        doc.docstatus === 1,
    },
    {
      status: "To Receive and Bill",
      condition: (doc) =>
        flt(doc.per_received) < 100 &&
        flt(doc.per_billed) < 100 &&
        doc.docstatus === 1,
    },
    {
      status: "To Pay",
      condition: (doc) =>
        doc.advance_payment_status === "Initiated" && doc.docstatus === 1,
    },
    {
      status: "Completed",
      condition: (doc) =>
        flt(doc.per_received) >= 100 &&
        flt(doc.per_billed) === 100 &&
        doc.docstatus === 1,
    },
    { status: "Delivered", condition: (doc) => doc.status === "Delivered" },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
    { status: "On Hold", condition: (doc) => doc.status === "On Hold" },
    {
      status: "Closed",
      condition: (doc) => doc.status === "Closed" && doc.docstatus !== 2,
    },
  ],
  "Delivery Note": [
    { status: "Draft", condition: null },
    {
      status: "To Bill",
      condition: (doc) => flt(doc.per_billed) === 0 && doc.docstatus === 1,
    },
    {
      status: "Partially Billed",
      condition: (doc) =>
        flt(doc.per_billed) < 100 && flt(doc.per_billed) > 0 && doc.docstatus === 1,
    },
    {
      status: "Completed",
      condition: (doc) => flt(doc.per_billed) === 100 && doc.docstatus === 1,
    },
    {
      status: "Return Issued",
      condition: (doc) => flt(doc.per_returned) === 100 && doc.docstatus === 1,
    },
    {
      status: "Return",
      condition: (doc) =>
        doc.is_return === true && flt(doc.per_billed) === 0 && doc.docstatus === 1,
    },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
    {
      status: "Closed",
      condition: (doc) => doc.status === "Closed" && doc.docstatus !== 2,
    },
  ],
  "Purchase Receipt": [
    { status: "Draft", condition: null },
    {
      status: "To Bill",
      condition: (doc) => flt(doc.per_billed) === 0 && doc.docstatus === 1,
    },
    {
      status: "Partly Billed",
      condition: (doc) =>
        flt(doc.per_billed) > 0 && flt(doc.per_billed) < 100 && doc.docstatus === 1,
    },
    {
      status: "Return",
      condition: (doc) =>
        doc.is_return === true && flt(doc.per_billed) === 0 && doc.docstatus === 1,
    },
    {
      status: "Return Issued",
      condition: (doc) => flt(doc.per_returned) === 100 && doc.docstatus === 1,
    },
    {
      status: "Completed",
      condition: (doc) =>
        (flt(doc.per_billed) >= 100 && doc.docstatus === 1) ||
        (doc.docstatus === 1 &&
          flt(doc.grand_total) === 0 &&
          flt(doc.per_returned) !== 100 &&
          !doc.is_return),
    },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
    {
      status: "Closed",
      condition: (doc) => doc.status === "Closed" && doc.docstatus !== 2,
    },
  ],
  "Material Request": [
    { status: "Draft", condition: null },
    { status: "Stopped", condition: (doc) => doc.status === "Stopped" },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
    {
      status: "Pending",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_ordered) === 0 &&
        doc.docstatus === 1,
    },
    {
      status: "Ordered",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_ordered) === 100 &&
        doc.docstatus === 1 &&
        ["Purchase", "Manufacture", "Subcontracting"].includes(
          doc.material_request_type ?? ""
        ),
    },
    {
      status: "Transferred",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_ordered) === 100 &&
        doc.docstatus === 1 &&
        doc.material_request_type === "Material Transfer",
    },
    {
      status: "Issued",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_ordered) === 100 &&
        doc.docstatus === 1 &&
        doc.material_request_type === "Material Issue",
    },
    {
      status: "Received",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        doc.docstatus === 1 &&
        ((flt(doc.per_received) === 100 && doc.material_request_type === "Purchase") ||
          (flt(doc.per_ordered) === 100 &&
            doc.material_request_type === "Customer Provided")),
    },
    {
      status: "Partially Received",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_received) > 0 &&
        flt(doc.per_received) < 100 &&
        doc.docstatus === 1 &&
        doc.material_request_type === "Purchase",
    },
    {
      status: "Partially Received",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_ordered) < 100 &&
        flt(doc.per_ordered) > 0 &&
        doc.docstatus === 1 &&
        ["Material Transfer", "Customer Provided"].includes(
          doc.material_request_type ?? ""
        ),
    },
    {
      status: "Partially Ordered",
      condition: (doc) =>
        doc.status !== "Stopped" &&
        flt(doc.per_ordered) < 100 &&
        flt(doc.per_ordered) > 0 &&
        doc.docstatus === 1 &&
        !["Material Transfer", "Customer Provided"].includes(
          doc.material_request_type ?? ""
        ),
    },
  ],
  "POS Opening Entry": [
    { status: "Draft", condition: null },
    {
      status: "Open",
      condition: (doc) => doc.docstatus === 1 && !doc.pos_closing_entry,
    },
    {
      status: "Closed",
      condition: (doc) => doc.docstatus === 1 && !!doc.pos_closing_entry,
    },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
  ],
  "POS Closing Entry": [
    { status: "Draft", condition: null },
    { status: "Submitted", condition: (doc) => doc.docstatus === 1 },
    { status: "Queued", condition: (doc) => doc.status === "Queued" },
    { status: "Failed", condition: (doc) => doc.status === "Failed" },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
  ],
  "Transaction Deletion Record": [
    { status: "Draft", condition: null },
    { status: "Completed", condition: (doc) => doc.docstatus === 1 },
  ],
  "Pick List": [
    { status: "Draft", condition: null },
    { status: "Open", condition: (doc) => doc.docstatus === 1 },
    { status: "Completed", condition: (doc) => getDocProp(doc, "stock_entry_exists") === true },
    {
      status: "Partly Delivered",
      condition: (doc) =>
        doc.purpose === "Delivery" && doc.delivery_status === "Partly Delivered",
    },
    {
      status: "Completed",
      condition: (doc) =>
        doc.purpose === "Delivery" && doc.delivery_status === "Fully Delivered",
    },
    { status: "Cancelled", condition: (doc) => doc.docstatus === 2 },
  ],
};

/* ------------------------------------------------------------------ */
/*  get_status                                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns the computed status for a document based on statusMap rules.
 * Rules are evaluated in reverse order; the first matching rule wins.
 */
export function getStatus(doc: StatusDoc): { status: string } {
  if (!statusMap[doc.doctype]) {
    return { status: doc.status ?? "" };
  }

  const rules = [...statusMap[doc.doctype]].reverse();

  for (const rule of rules) {
    if (rule.condition === null) {
      return { status: rule.status };
    }
    if (rule.condition(doc)) {
      return { status: rule.status };
    }
  }

  return { status: doc.status ?? "" };
}

/* ------------------------------------------------------------------ */
/*  set_status                                                         */
/* ------------------------------------------------------------------ */

/**
 * Sets the status on a document based on the status transition rules.
 * Mirrors Python StatusUpdater.set_status().
 */
export function setStatus(
  doc: StatusDoc,
  update = false,
  forcedStatus?: string,
  updateModified = true
):
  | { success: true; doc: StatusDoc; newStatus: string; changed: boolean; updateModified: boolean }
  | { success: false; error: string } {
  try {
    if (!statusMap[doc.doctype]) {
      return { success: true, doc, newStatus: doc.status ?? "", changed: false, updateModified };
    }

    const previousStatus = doc.status;
    if (forcedStatus) {
      doc.status = forcedStatus;
    }

    const { status: newStatus } = getStatus(doc);

    if (newStatus !== previousStatus) {
      doc.status = newStatus;
    }

    return {
      success: true,
      doc,
      newStatus,
      changed: newStatus !== previousStatus,
      updateModified,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  update_qty                                                         */
/* ------------------------------------------------------------------ */

/**
 * Pure TypeScript equivalent of StatusUpdater.update_qty().
 * Computes child and parent quantity/percentage updates without touching a database.
 *
 * @param doc        The source document (e.g. Delivery Note).
 * @param children   All child rows belonging to the source document.
 * @param configs    Status-updater configurations.
 * @returns Computed updates for target children and target parents.
 */
export function updateQty(
  doc: StatusDoc,
  children: ChildItem[],
  configs: StatusUpdaterConfig[]
): { success: true; result: QtyUpdateResult } | { success: false; error: string } {
  try {
    const childUpdates: QtyUpdateResult["childUpdates"] = [];
    const parentUpdates: QtyUpdateResult["parentUpdates"] = [];

    for (const args of configs) {
      // Build a map of target detail IDs → sum of source_field values
      const detailSums: Record<string, number> = {};

      for (const child of children) {
        if (child.doctype !== args.source_dt) continue;

        const detailId = getDocProp(child, args.join_field) as string | undefined;
        if (!detailId) continue;

        const sourceValue = flt(getDocProp(child, args.source_field) as number | string | undefined);
        detailSums[detailId] = (detailSums[detailId] ?? 0) + sourceValue;
      }

      // Child updates
      for (const [detailId, newValue] of Object.entries(detailSums)) {
        childUpdates.push({
          detailId,
          targetDt: args.target_dt,
          targetField: args.target_field,
          newValue: flt(newValue),
        });
      }

      // Parent percentage updates
      if (args.percent_join_field || args.percent_join_field_parent) {
        const distinctParents = new Set<string>();

        if (args.percent_join_field_parent) {
          const parentName = getDocProp(doc, args.percent_join_field_parent) as string | undefined;
          if (parentName) distinctParents.add(parentName);
        } else if (args.percent_join_field) {
          for (const child of children) {
            if (child.doctype !== args.source_dt) continue;
            const parentName = getDocProp(child, args.percent_join_field) as string | undefined;
            if (parentName) distinctParents.add(parentName);
          }
        }

        for (const parentName of distinctParents) {
          if (!parentName) continue;
          // Percentage is computed externally or passed in; here we leave it
          // to the caller to fill in after fetching target children.
          if (args.target_parent_field) {
            parentUpdates.push({
              name: parentName,
              targetParentDt: args.target_parent_dt ?? doc.doctype,
              targetParentField: args.target_parent_field,
              percentage: 0, // placeholder; caller should recalc
              statusField: args.status_field,
              status: undefined,
            });
          }
        }
      }
    }

    return { success: true, result: { childUpdates, parentUpdates } };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  calculate_target_parent_percentage                                 */
/* ------------------------------------------------------------------ */

/**
 * Calculates the completion percentage for a parent document
 * based on its child rows.  Mirrors the Python static method.
 */
export function calculateTargetParentPercentage(
  targetChildren: Array<Record<string, number>>,
  targetRefField: string,
  targetField: string
): number {
  const sumRef = targetChildren.reduce(
    (sum, row) => sum + Math.abs(flt(row[targetRefField] as number | string | undefined)),
    0
  );

  if (sumRef === 0) return 0;

  const percentage =
    (targetChildren.reduce(
      (sum, row) =>
        sum +
        Math.min(
          Math.abs(flt(row[targetField] as number | string | undefined)),
          Math.abs(flt(row[targetRefField] as number | string | undefined))
        ),
      0
    ) /
      sumRef) *
    100;

  return flt(percentage, 6);
}

/* ------------------------------------------------------------------ */
/*  determine_status                                                   */
/* ------------------------------------------------------------------ */

/**
 * Returns a textual status for a given percentage and keyword.
 */
export function determineStatus(percentage: number, keyword: string): string {
  if (percentage < 0.001) {
    return `Not ${keyword}`;
  } else if (percentage >= 99.999999) {
    return `Fully ${keyword}`;
  }
  return `Partly ${keyword}`;
}

/* ------------------------------------------------------------------ */
/*  validate_status (doc-level)  →  mirrors validate_qty               */
/* ------------------------------------------------------------------ */

export interface ValidateStatusInput {
  configs: StatusUpdaterConfig[];
  children: ChildItem[];
  itemAllowance?: Record<string, { qty?: number; amount?: number }>;
  globalQtyAllowance?: number | null;
  globalAmountAllowance?: number | null;
  sellingNegativeRateAllowed?: boolean;
  buyingNegativeRateAllowed?: boolean;
  itemAllowanceOverrides?: Record<string, { qty?: number; amount?: number }>;
  stockSettingsAllowance?: number;
  accountsSettingsAllowance?: number;
}

/**
 * Validates quantities and rates at row level.
 * Mirrors Python StatusUpdater.validate_qty().
 */
export function validateStatus(
  doc: StatusDoc,
  input: ValidateStatusInput
): { success: true; doc: StatusDoc } | { success: false; error: string } {
  try {
    for (const args of input.configs) {
      if (!args.target_ref_field || args.validate_qty === false) {
        continue;
      }

      for (const child of input.children) {
        if (child.doctype !== args.source_dt) continue;

        const qty = flt(child.qty);
        if (qty < 0 && !doc.is_return) {
          return {
            success: false,
            error: `For item ${child.item_code ?? ""}, quantity must be positive`,
          };
        }
        if (qty > 0 && doc.is_return) {
          return {
            success: false,
            error: `For item ${child.item_code ?? ""}, quantity must be negative`,
          };
        }

        if (
          (!input.sellingNegativeRateAllowed &&
            ["Sales Invoice", "Delivery Note"].includes(doc.doctype)) ||
          (!input.buyingNegativeRateAllowed &&
            ["Purchase Invoice", "Purchase Receipt"].includes(doc.doctype))
        ) {
          const rate = flt(child.rate);
          if (rate < 0) {
            return {
              success: false,
              error: `For item ${child.item_code ?? ""}, rate must be positive`,
            };
          }
        }
      }
    }

    return { success: true, doc };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  update_status  →  mirrors update_prevdoc_status                    */
/* ------------------------------------------------------------------ */

/**
 * Combines quantity updates and validation.
 * Mirrors Python StatusUpdater.update_prevdoc_status().
 */
export function updateStatus(
  doc: StatusDoc,
  children: ChildItem[],
  configs: StatusUpdaterConfig[],
  input: Omit<ValidateStatusInput, "configs" | "children">
):
  | {
      success: true;
      doc: StatusDoc;
      qtyResult: QtyUpdateResult;
    }
  | { success: false; error: string } {
  const qtyResult = updateQty(doc, children, configs);
  if (!qtyResult.success) return qtyResult;

  const validation = validateStatus(doc, { ...input, configs, children });
  if (!validation.success) return validation;

  return { success: true, doc, qtyResult: qtyResult.result };
}

/* ------------------------------------------------------------------ */
/*  get_allowance_for                                                  */
/* ------------------------------------------------------------------ */

/**
 * Returns the allowance for an item.
 * Mirrors the Python module-level get_allowance_for().
 *
 * Pure version — accepts cached values instead of hitting the database.
 */
export function getAllowanceFor(
  itemCode: string,
  itemAllowance: Record<string, { qty?: number; amount?: number }> = {},
  globalQtyAllowance: number | null = null,
  globalAmountAllowance: number | null = null,
  qtyOrAmount: "qty" | "amount" = "qty",
  itemAllowanceOverrides?: Record<string, { qty?: number; amount?: number }>,
  stockSettingsAllowance?: number,
  accountsSettingsAllowance?: number
): AllowanceResult | { success: false; error: string } {
  try {
    // Check cache / overrides first
    const override = itemAllowanceOverrides?.[itemCode];
    if (qtyOrAmount === "qty" && override?.qty !== undefined) {
      return {
        allowance: override.qty,
        itemAllowance,
        globalQtyAllowance,
        globalAmountAllowance,
      };
    }
    if (qtyOrAmount === "amount" && override?.amount !== undefined) {
      return {
        allowance: override.amount,
        itemAllowance,
        globalQtyAllowance,
        globalAmountAllowance,
      };
    }

    const cached = itemAllowance[itemCode];
    if (qtyOrAmount === "qty" && cached?.qty !== undefined) {
      return {
        allowance: cached.qty,
        itemAllowance,
        globalQtyAllowance,
        globalAmountAllowance,
      };
    }
    if (qtyOrAmount === "amount" && cached?.amount !== undefined) {
      return {
        allowance: cached.amount,
        itemAllowance,
        globalQtyAllowance,
        globalAmountAllowance,
      };
    }

    let allowance: number;

    if (qtyOrAmount === "qty") {
      let qtyAllowance = stockSettingsAllowance ?? 0;
      if (!qtyAllowance && globalQtyAllowance !== null) {
        qtyAllowance = globalQtyAllowance;
      }
      if (!qtyAllowance) {
        qtyAllowance = globalQtyAllowance ?? 0;
      }
      allowance = qtyAllowance;
      itemAllowance[itemCode] = { ...(itemAllowance[itemCode] ?? {}), qty: qtyAllowance };
    } else {
      let overBillingAllowance = accountsSettingsAllowance ?? 0;
      if (!overBillingAllowance && globalAmountAllowance !== null) {
        overBillingAllowance = globalAmountAllowance;
      }
      if (!overBillingAllowance) {
        overBillingAllowance = globalAmountAllowance ?? 0;
      }
      allowance = overBillingAllowance;
      itemAllowance[itemCode] = {
        ...(itemAllowance[itemCode] ?? {}),
        amount: overBillingAllowance,
      };
    }

    return {
      allowance,
      itemAllowance,
      globalQtyAllowance,
      globalAmountAllowance,
    };
  } catch (error: any) {
    return { success: false, error: error?.message ?? String(error) };
  }
}

/* ------------------------------------------------------------------ */
/*  update_billing_status_for_zero_amount_refdoc                       */
/* ------------------------------------------------------------------ */

/**
 * Pure helper for zero-amount reference-doc billing status.
 * Returns the computed per_billed and billing_status values.
 */
export function updateBillingStatusForZeroAmountRefdoc(
  refDocQty: number,
  billedQty: number
): { perBilled: number; billingStatus: string } {
  const safeRefDocQty = flt(refDocQty);
  const safeBilledQty = flt(billedQty);

  if (safeRefDocQty === 0) {
    return { perBilled: 0, billingStatus: "Not Billed" };
  }

  const perBilled = flt((Math.min(safeRefDocQty, safeBilledQty) / safeRefDocQty) * 100, 6);

  let billingStatus: string;
  if (perBilled < 0.001) {
    billingStatus = "Not Billed";
  } else if (perBilled > 99.999999) {
    billingStatus = "Fully Billed";
  } else {
    billingStatus = "Partly Billed";
  }

  return { perBilled, billingStatus };
}
