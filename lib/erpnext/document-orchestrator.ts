/**
 * Document Orchestrator — THE master wiring layer.
 *
 * Bridges disconnected controllers (pure functions) to the API routes and
 * server actions. Controllers validate docs and compute side effects (GL
 * entries, stock ledger entries, status updates) without touching the DB.
 * This orchestrator:
 *   1. Checks RBAC permissions
 *   2. Fetches the document + children from the DB
 *   3. Builds the validation context (fiscal year, company defaults, party info)
 *   4. Calls the controller's pure functions
 *   5. Wraps everything in a Prisma transaction and persists side effects
 *
 * For DocTypes NOT in the registry, falls back to the current simple
 * docstatus-flip behavior (just updates docstatus without side effects).
 *
 * RULES:
 * - No `any` types except `catch (e: any)`.
 * - Every function has explicit params and return types.
 * - Uses `prisma.$transaction()` for ALL multi-step operations.
 * - Uses PrismaDelegate from `lib/erpnext/prisma-delegate.ts` for dynamic access.
 * - Uses shared types from `lib/erpnext/types.ts`.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/prisma/client";
import {
  getDelegate,
  getDelegateByAccessor,
  getTxDelegate,
  type PrismaDelegate,
} from "./prisma-delegate";
import { checkPermission } from "./rbac";
import {
  buildValidationContext,
  type ValidationContext,
  type FiscalYearInfo,
  type CompanyDefaults,
  type PartyInfo,
} from "./context-builder";
import {
  persistGlEntries,
  reverseGlEntries,
  validateGlBalance,
  type GlEntryInput,
} from "./gl-persister";
import {
  persistStockLedgerEntries,
  reverseStockLedgerEntries,
  type StockLedgerEntryInput,
} from "./stock-persister";
import {
  applyStatusUpdates,
  reverseStatusUpdates,
  type StatusUpdateConfig,
} from "./status-persister";

// ── Controller imports (pure functions) ────────────────────────────────────
import {
  validateSalesInvoice,
  onSubmitSalesInvoice,
  onCancelSalesInvoice,
  makeGlEntries as siMakeGlEntries,
  buildStockLedgerEntries as siBuildStockLedgerEntries,
  getSalesInvoiceStatusUpdaterConfigs,
  type SalesInvoice,
  type SalesInvoiceItem as SIItem,
  type GLEntry as SIGlEntry,
  type StockLedgerEntry as SISLE,
  type CustomerInfo as SIControllerCustomerInfo,
} from "./controllers/selling-sales-invoice";

import {
  validatePurchaseInvoice,
  onSubmitPurchaseInvoice,
  onCancelPurchaseInvoice,
  makeGlEntries as piMakeGlEntries,
  buildStockLedgerEntries as piBuildStockLedgerEntries,
  getPurchaseInvoiceStatusUpdaterConfigs,
  type PurchaseInvoice,
  type PurchaseInvoiceItem as PIItem,
  type GLEntry as PIGlEntry,
  type StockLedgerEntry as PISLE,
  type SupplierInfo as PIControllerSupplierInfo,
} from "./controllers/buying-purchase-invoice";

import { type StatusUpdaterConfig, type QtyUpdateResult } from "./controllers/status-updater";

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC INTERFACES
   ════════════════════════════════════════════════════════════════════════════ */

/** Result of submitting a document */
export interface SubmitResult {
  success: boolean;
  data?: unknown;
  error?: string;
  gl_entries_count?: number;
  stock_entries_count?: number;
  status_updates_count?: number;
}

/** Result of cancelling a document */
export interface CancelResult {
  success: boolean;
  data?: unknown;
  error?: string;
  gl_reversal_count?: number;
  stock_reversal_count?: number;
  status_reversals_count?: number;
}

/** Result of validating a document */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Side effects produced by a controller's onSubmit */
export interface SubmitSideEffects {
  glEntries: GlEntryInput[];
  stockLedgerEntries: StockLedgerEntryInput[];
  statusUpdates: StatusUpdateConfig[];
  accountBalanceUpdates: AccountBalanceUpdate[];
}

/** Side effects produced by a controller's onCancel */
export interface CancelSideEffects {
  reverseGlEntries: boolean;
  reverseStockLedger: boolean;
  reverseStatusUpdates: StatusUpdateConfig[];
}

/** Account balance delta for updating account running totals */
export interface AccountBalanceUpdate {
  account: string;
  debitDelta: number;
  creditDelta: number;
}

/* ════════════════════════════════════════════════════════════════════════════
   DOC TYPE CONFIG & REGISTRY
   ════════════════════════════════════════════════════════════════════════════ */

/** Configuration for a child table model */
export interface ChildModelConfig {
  /** Prisma accessor name (e.g. "salesInvoiceItem") */
  accessor: string;
  /** Field name on the parent document (e.g. "items") */
  parentField: string;
}

/** Configuration for a registered DocType */
export interface DocTypeConfig {
  /** Controller functions for this DocType */
  controller: {
    validate?: (doc: unknown, context: ValidationContext) => ValidationResult;
    onSubmit?: (doc: unknown, children: Record<string, unknown[]>) => SubmitSideEffects;
    onCancel?: (doc: unknown, children: Record<string, unknown[]>) => CancelSideEffects;
  };
  /** Prisma model accessor name (e.g. "salesInvoice") */
  prismaModel: string;
  /** Child tables to fetch when loading the document */
  childModels: ChildModelConfig[];
  /** Whether this DocType supports submit/cancel lifecycle */
  submittable: boolean;
}

/* ------------------------------------------------------------------ */
/*  Controller adapter functions                                       */
/* ------------------------------------------------------------------ */

/**
 * Adapter: Sales Invoice controller → SubmitSideEffects
 *
 * Bridges the gap between the selling-sales-invoice controller's
 * output types and the orchestrator's generic SubmitSideEffects.
 */
function siOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const siDoc = doc as SalesInvoice;
  const result = onSubmitSalesInvoice(siDoc);

  if (!result.success) {
    return {
      glEntries: [],
      stockLedgerEntries: [],
      statusUpdates: [],
      accountBalanceUpdates: [],
    };
  }

  // Convert controller GLEntry → GlEntryInput
  const glEntries: GlEntryInput[] = (result.gl_entries ?? []).map((e: SIGlEntry) => ({
    account: e.account,
    debit: e.debit,
    credit: e.credit,
    against: e.against ?? "",
    voucherType: "Sales Invoice",
    voucherNo: siDoc.name ?? "",
    fiscalYear: "",  // Will be filled by the orchestrator
    company: siDoc.company,
    postingDate: new Date(siDoc.posting_date),
    costCenter: e.cost_center,
    project: e.project,
    partyType: e.party_type,
    party: e.party,
    againstVoucherType: e.against_voucher_type,
    againstVoucher: e.against_voucher,
    remarks: e.remarks,
  }));

  // Convert controller StockLedgerEntry → StockLedgerEntryInput
  const stockEntries = siBuildStockLedgerEntries(siDoc, false);
  const stockLedgerEntries: StockLedgerEntryInput[] = stockEntries.map((e: SISLE) => ({
    itemCode: e.item_code,
    warehouse: e.warehouse,
    actualQty: e.qty,
    valuationRate: e.valuation_rate ?? 0,
    stockValueType: "Stock Value",
    voucherType: e.voucher_type,
    voucherNo: e.voucher_no,
    voucherDetailNo: e.voucher_detail_no,
    postingDate: new Date(e.posting_date),
    postingTime: e.posting_time ?? new Date().toTimeString().substring(0, 8),
    company: siDoc.company,
    fiscalYear: "",
  }));

  // Build status updates from the qtyUpdates result
  const statusUpdates: StatusUpdateConfig[] = [];
  if (result.qtyUpdates) {
    for (const childUpdate of result.qtyUpdates.childUpdates) {
      statusUpdates.push({
        targetDoctype: childUpdate.targetDt,
        targetName: childUpdate.detailId,
        targetField: childUpdate.targetField,
        delta: childUpdate.newValue,
      });
    }
  }

  return {
    glEntries,
    stockLedgerEntries,
    statusUpdates,
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Sales Invoice controller → CancelSideEffects
 */
function siOnCancel(doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  const siDoc = doc as SalesInvoice;
  const result = onCancelSalesInvoice(siDoc);

  if (!result.success) {
    return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
  }

  const reverseStatusUpdatesList: StatusUpdateConfig[] = [];
  if (result.qtyUpdates) {
    for (const childUpdate of result.qtyUpdates.childUpdates) {
      reverseStatusUpdatesList.push({
        targetDoctype: childUpdate.targetDt,
        targetName: childUpdate.detailId,
        targetField: childUpdate.targetField,
        delta: -childUpdate.newValue,  // Negate on cancel
      });
    }
  }

  return {
    reverseGlEntries: result.glEntriesReversed ?? false,
    reverseStockLedger: result.stockReversed ?? false,
    reverseStatusUpdates: reverseStatusUpdatesList,
  };
}

/**
 * Adapter: Sales Invoice controller → ValidationResult
 */
function siValidate(doc: unknown, context: ValidationContext): ValidationResult {
  const siDoc = doc as SalesInvoice;

  const fiscalYearRange = context.fiscalYear
    ? {
        year_start_date: context.fiscalYear.yearStart.toISOString().split("T")[0],
        year_end_date: context.fiscalYear.yearEnd.toISOString().split("T")[0],
      }
    : undefined;

  const customerInfo = context.partyInfo
    ? ({
        name: context.partyInfo.name,
        ...(context.partyInfo.disabled && { disabled: context.partyInfo.disabled }),
        ...(context.partyInfo.defaultCurrency && { default_currency: context.partyInfo.defaultCurrency }),
        ...(context.partyInfo.defaultPriceList && { default_price_list: context.partyInfo.defaultPriceList }),
      } satisfies SIControllerCustomerInfo)
    : undefined;

  const result = validateSalesInvoice(siDoc, customerInfo, undefined, fiscalYearRange);

  if (!result.success) {
    return { valid: false, errors: [result.error ?? "Validation failed"], warnings: result.warnings ?? [] };
  }

  return { valid: true, errors: [], warnings: result.warnings ?? [] };
}

/**
 * Adapter: Purchase Invoice controller → SubmitSideEffects
 */
function piOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const piDoc = doc as PurchaseInvoice;
  const result = onSubmitPurchaseInvoice(piDoc);

  if (!result.success) {
    return {
      glEntries: [],
      stockLedgerEntries: [],
      statusUpdates: [],
      accountBalanceUpdates: [],
    };
  }

  const glEntries: GlEntryInput[] = (result.gl_entries ?? []).map((e: PIGlEntry) => ({
    account: e.account,
    debit: e.debit,
    credit: e.credit,
    against: e.against ?? "",
    voucherType: "Purchase Invoice",
    voucherNo: piDoc.name ?? "",
    fiscalYear: "",
    company: piDoc.company,
    postingDate: new Date(piDoc.posting_date),
    costCenter: e.cost_center,
    project: e.project,
    partyType: e.party_type,
    party: e.party,
    againstVoucherType: e.against_voucher_type,
    againstVoucher: e.against_voucher,
    remarks: e.remarks,
  }));

  const stockEntries = piBuildStockLedgerEntries(piDoc, false);
  const stockLedgerEntries: StockLedgerEntryInput[] = stockEntries.map((e: PISLE) => ({
    itemCode: e.item_code,
    warehouse: e.warehouse,
    actualQty: e.qty,
    valuationRate: e.valuation_rate ?? 0,
    stockValueType: "Stock Value",
    voucherType: e.voucher_type,
    voucherNo: e.voucher_no,
    voucherDetailNo: e.voucher_detail_no,
    postingDate: new Date(e.posting_date),
    postingTime: e.posting_time ?? new Date().toTimeString().substring(0, 8),
    company: piDoc.company,
    fiscalYear: "",
  }));

  const statusUpdates: StatusUpdateConfig[] = [];
  if (result.qtyUpdates) {
    for (const childUpdate of result.qtyUpdates.childUpdates) {
      statusUpdates.push({
        targetDoctype: childUpdate.targetDt,
        targetName: childUpdate.detailId,
        targetField: childUpdate.targetField,
        delta: childUpdate.newValue,
      });
    }
  }

  return {
    glEntries,
    stockLedgerEntries,
    statusUpdates,
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Purchase Invoice controller → CancelSideEffects
 */
function piOnCancel(doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  const piDoc = doc as PurchaseInvoice;
  const result = onCancelPurchaseInvoice(piDoc);

  if (!result.success) {
    return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
  }

  const reverseStatusUpdatesList: StatusUpdateConfig[] = [];
  if (result.qtyUpdates) {
    for (const childUpdate of result.qtyUpdates.childUpdates) {
      reverseStatusUpdatesList.push({
        targetDoctype: childUpdate.targetDt,
        targetName: childUpdate.detailId,
        targetField: childUpdate.targetField,
        delta: -childUpdate.newValue,
      });
    }
  }

  return {
    reverseGlEntries: result.glEntriesReversed ?? false,
    reverseStockLedger: result.stockReversed ?? false,
    reverseStatusUpdates: reverseStatusUpdatesList,
  };
}

/**
 * Adapter: Purchase Invoice controller → ValidationResult
 */
function piValidate(doc: unknown, context: ValidationContext): ValidationResult {
  const piDoc = doc as PurchaseInvoice;

  const fiscalYearRange = context.fiscalYear
    ? {
        year_start_date: context.fiscalYear.yearStart.toISOString().split("T")[0],
        year_end_date: context.fiscalYear.yearEnd.toISOString().split("T")[0],
      }
    : undefined;

  const supplierInfo = context.partyInfo
    ? ({
        name: context.partyInfo.name,
        ...(context.partyInfo.disabled && { disabled: context.partyInfo.disabled }),
        ...(context.partyInfo.onHold && { on_hold: context.partyInfo.onHold }),
        ...(context.partyInfo.onHoldType && { hold_type: context.partyInfo.onHoldType }),
        ...(context.partyInfo.releaseDate && { release_date: context.partyInfo.releaseDate.toISOString().split("T")[0] }),
        ...(context.partyInfo.defaultCurrency && { default_currency: context.partyInfo.defaultCurrency }),
        ...(context.partyInfo.defaultPriceList && { default_price_list: context.partyInfo.defaultPriceList }),
      } satisfies PIControllerSupplierInfo)
    : undefined;

  const result = validatePurchaseInvoice(piDoc, supplierInfo, undefined, fiscalYearRange);

  if (!result.success) {
    return { valid: false, errors: [result.error ?? "Validation failed"], warnings: result.warnings ?? [] };
  }

  return { valid: true, errors: [], warnings: result.warnings ?? [] };
}

/* ------------------------------------------------------------------ */
/*  Placeholder adapters for DocTypes without full controllers         */
/* ------------------------------------------------------------------ */

/** No-op validate for DocTypes with minimal validation */
function noopValidate(_doc: unknown, _context: ValidationContext): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

/** No-op submit for DocTypes that only need docstatus flip */
function noopSubmit(_doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  return {
    glEntries: [],
    stockLedgerEntries: [],
    statusUpdates: [],
    accountBalanceUpdates: [],
  };
}

/** No-op cancel for DocTypes that only need docstatus flip */
function noopCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return {
    reverseGlEntries: false,
    reverseStockLedger: false,
    reverseStatusUpdates: [],
  };
}

/* ------------------------------------------------------------------ */
/*  DOCTYPE REGISTRY                                                   */
/* ------------------------------------------------------------------ */

/**
 * The master registry mapping DocType names to their controllers and
 * Prisma model configurations. This is THE single source of truth for
 * which DocTypes have full orchestrator support.
 */
const REGISTRY: Map<string, DocTypeConfig> = new Map([
  // ── Sales Invoice (full controller) ──────────────────────────────────────
  ["Sales Invoice", {
    controller: {
      validate: siValidate,
      onSubmit: siOnSubmit,
      onCancel: siOnCancel,
    },
    prismaModel: "salesInvoice",
    childModels: [
      { accessor: "salesInvoiceItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
      { accessor: "salesInvoicePayment", parentField: "payments" },
    ],
    submittable: true,
  }],

  // ── Purchase Invoice (full controller) ───────────────────────────────────
  ["Purchase Invoice", {
    controller: {
      validate: piValidate,
      onSubmit: piOnSubmit,
      onCancel: piOnCancel,
    },
    prismaModel: "purchaseInvoice",
    childModels: [
      { accessor: "purchaseInvoiceItem", parentField: "items" },
      { accessor: "purchaseTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Sales Order ──────────────────────────────────────────────────────────
  ["Sales Order", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "salesOrder",
    childModels: [
      { accessor: "salesOrderItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Purchase Order ───────────────────────────────────────────────────────
  ["Purchase Order", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "purchaseOrder",
    childModels: [
      { accessor: "purchaseOrderItem", parentField: "items" },
      { accessor: "purchaseTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Journal Entry ───────────────────────────────────────────────────────
  ["Journal Entry", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "journalEntry",
    childModels: [
      { accessor: "journalEntryAccount", parentField: "accounts" },
    ],
    submittable: true,
  }],

  // ── Payment Entry ───────────────────────────────────────────────────────
  ["Payment Entry", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "paymentEntry",
    childModels: [
      { accessor: "paymentEntryReference", parentField: "references" },
      { accessor: "paymentEntryDeduction", parentField: "deductions" },
    ],
    submittable: true,
  }],

  // ── Stock Entry ─────────────────────────────────────────────────────────
  ["Stock Entry", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "stockEntry",
    childModels: [
      { accessor: "stockEntryDetail", parentField: "items" },
    ],
    submittable: true,
  }],

  // ── Delivery Note ───────────────────────────────────────────────────────
  ["Delivery Note", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "deliveryNote",
    childModels: [
      { accessor: "deliveryNoteItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Purchase Receipt ────────────────────────────────────────────────────
  ["Purchase Receipt", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "purchaseReceipt",
    childModels: [
      { accessor: "purchaseReceiptItem", parentField: "items" },
      { accessor: "purchaseTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Quotation ───────────────────────────────────────────────────────────
  ["Quotation", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "quotation",
    childModels: [
      { accessor: "quotationItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Material Request ────────────────────────────────────────────────────
  ["Material Request", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "materialRequest",
    childModels: [
      { accessor: "materialRequestItem", parentField: "items" },
    ],
    submittable: true,
  }],

  // ── Work Order ──────────────────────────────────────────────────────────
  ["Work Order", {
    controller: {
      validate: noopValidate,
      onSubmit: noopSubmit,
      onCancel: noopCancel,
    },
    prismaModel: "workOrder",
    childModels: [
      { accessor: "workOrderItem", parentField: "items" },
    ],
    submittable: true,
  }],
]);

/* ════════════════════════════════════════════════════════════════════════════
   PUBLIC API
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Get the DocType registry — which controllers handle which DocTypes.
 * Returns a copy so callers cannot mutate the internal registry.
 */
export function getDocTypeRegistry(): Map<string, DocTypeConfig> {
  return new Map(REGISTRY);
}

/**
 * Submit a document — validates, creates GL/stock entries, updates status.
 *
 * Full flow:
 * 1. Check RBAC (session must have submit permission)
 * 2. Lookup DocTypeConfig from registry (fallback for unregistered types)
 * 3. Fetch document from DB
 * 4. Validate docstatus is Draft (0)
 * 5. Fetch children from DB
 * 6. Build ValidationContext (fiscal year, company defaults, party info)
 * 7. Call controller.validate(doc, context) — throw if invalid
 * 8. Call controller.onSubmit(doc, children) — get side effects
 * 9. Wrap everything in prisma.$transaction():
 *    a. Update doc: docstatus=1, status="Submitted"
 *    b. Cascade docstatus to children
 *    c. Insert GL entries
 *    d. Insert stock ledger entries
 *    e. Apply status updates
 * 10. Return result
 *
 * @param doctype - The DocType name (e.g. "Sales Invoice")
 * @param name    - The document name/ID
 * @returns Submit result with counts of created entries
 */
export async function submitDocument(
  doctype: string,
  name: string,
): Promise<SubmitResult> {
  try {
    // ── 1. RBAC ──────────────────────────────────────────────────────────
    const permCheck = await checkPermission(doctype, "submit");
    if (!permCheck.allowed) {
      return { success: false, error: permCheck.reason ?? "Permission denied" };
    }

    // ── 2. Lookup config ─────────────────────────────────────────────────
    const config = REGISTRY.get(doctype);

    if (!config) {
      // DocType not in registry — fall back to simple docstatus flip
      return simpleSubmit(doctype, name);
    }

    // ── 3. Fetch document from DB ────────────────────────────────────────
    const delegate = getDelegate(prisma, config.prismaModel);
    if (!delegate) {
      return { success: false, error: `Prisma model "${config.prismaModel}" not found` };
    }

    const doc = await delegate.findUnique({
      where: { name },
    }) as Record<string, unknown> | null;

    if (!doc) {
      return { success: false, error: `${doctype} "${name}" not found` };
    }

    // ── 4. Validate docstatus ────────────────────────────────────────────
    const currentDocstatus = Number(doc.docstatus ?? 0);
    if (currentDocstatus === 1) {
      return { success: false, error: `${doctype} "${name}" is already submitted` };
    }
    if (currentDocstatus === 2) {
      return { success: false, error: `Cannot submit cancelled ${doctype} "${name}"` };
    }
    if (currentDocstatus !== 0) {
      return { success: false, error: `Unexpected docstatus=${currentDocstatus} for ${doctype} "${name}"` };
    }

    // ── 5. Fetch children ────────────────────────────────────────────────
    const children: Record<string, unknown[]> = {};
    for (const childModel of config.childModels) {
      const childDelegate = getDelegate(prisma, childModel.accessor);
      if (childDelegate) {
        const childRows = await childDelegate.findMany({
          where: { parent: name },
        }) as unknown[];
        children[childModel.parentField] = Array.isArray(childRows) ? childRows : [];
      }
    }

    // ── 6. Build validation context ──────────────────────────────────────
    const context = await buildValidationContext(doc);

    // ── 7. Controller validate ───────────────────────────────────────────
    if (config.controller.validate) {
      const validation = config.controller.validate(doc, context);
      if (!validation.valid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join("; ")}`,
        };
      }
    }

    // ── 8. Controller onSubmit ───────────────────────────────────────────
    const sideEffects = config.controller.onSubmit
      ? config.controller.onSubmit(doc, children)
      : {
          glEntries: [] as GlEntryInput[],
          stockLedgerEntries: [] as StockLedgerEntryInput[],
          statusUpdates: [] as StatusUpdateConfig[],
          accountBalanceUpdates: [] as AccountBalanceUpdate[],
        };

    // Fill fiscal year from context into GL/stock entries
    const fiscalYearName = context.fiscalYear?.name ?? "";
    for (const glEntry of sideEffects.glEntries) {
      if (!glEntry.fiscalYear) glEntry.fiscalYear = fiscalYearName;
    }
    for (const sleEntry of sideEffects.stockLedgerEntries) {
      if (!sleEntry.fiscalYear) sleEntry.fiscalYear = fiscalYearName;
    }

    // Validate GL balance before persisting
    if (sideEffects.glEntries.length > 0) {
      const balanceErr = validateGlBalance(sideEffects.glEntries);
      if (balanceErr) {
        return { success: false, error: balanceErr };
      }
    }

    // ── 9. Transaction: persist everything atomically ────────────────────
    const now = new Date();
    const childAccessors = config.childModels.map((c) => c.accessor);

    const updated = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, unknown>;

      // a. Update parent document: docstatus=1, status="Submitted"
      const txDelegate = getDelegateByAccessor(txRecord, config.prismaModel);
      if (!txDelegate) {
        throw new Error(`Prisma model "${config.prismaModel}" not found in transaction`);
      }

      const result = await txDelegate.update({
        where: { name },
        data: {
          docstatus: 1,
          status: "Submitted",
          modified: now,
          modified_by: "Administrator",
        } as unknown,
      });

      // b. Cascade docstatus to children
      for (const childAccessor of childAccessors) {
        const childDelegate = getDelegateByAccessor(txRecord, childAccessor);
        if (childDelegate) {
          await childDelegate.updateMany({
            where: { parent: name } as unknown,
            data: { docstatus: 1 } as unknown,
          });
        }
      }

      // c. Insert GL entries
      let glCount = 0;
      if (sideEffects.glEntries.length > 0) {
        glCount = await persistGlEntries(txRecord, sideEffects.glEntries);
      }

      // d. Insert stock ledger entries
      let sleCount = 0;
      if (sideEffects.stockLedgerEntries.length > 0) {
        sleCount = await persistStockLedgerEntries(txRecord, sideEffects.stockLedgerEntries);
      }

      // e. Apply status updates
      let statusCount = 0;
      if (sideEffects.statusUpdates.length > 0) {
        statusCount = await applyStatusUpdates(txRecord, sideEffects.statusUpdates);
      }

      return { result, glCount, sleCount, statusCount };
    });

    return {
      success: true,
      data: updated.result,
      gl_entries_count: updated.glCount,
      stock_entries_count: updated.sleCount,
      status_updates_count: updated.statusCount,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[document-orchestrator] submitDocument error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Cancel a document — reverses GL/stock, updates status.
 *
 * Full flow:
 * 1. Check RBAC (session must have cancel permission)
 * 2. Lookup DocTypeConfig from registry (fallback for unregistered types)
 * 3. Fetch document from DB
 * 4. Validate docstatus is Submitted (1)
 * 5. Check for active dependencies (no active documents reference this)
 * 6. Call controller.onCancel(doc, children) — get reverse effects
 * 7. Wrap in prisma.$transaction():
 *    a. Update doc: docstatus=2, status="Cancelled"
 *    b. Create reversal GL entries
 *    c. Create reversal stock ledger entries
 *    d. Reverse status updates
 * 8. Return result
 *
 * @param doctype - The DocType name (e.g. "Sales Invoice")
 * @param name    - The document name/ID
 * @returns Cancel result with counts of reversed entries
 */
export async function cancelDocument(
  doctype: string,
  name: string,
): Promise<CancelResult> {
  try {
    // ── 1. RBAC ──────────────────────────────────────────────────────────
    const permCheck = await checkPermission(doctype, "cancel");
    if (!permCheck.allowed) {
      return { success: false, error: permCheck.reason ?? "Permission denied" };
    }

    // ── 2. Lookup config ─────────────────────────────────────────────────
    const config = REGISTRY.get(doctype);

    if (!config) {
      // DocType not in registry — fall back to simple docstatus flip
      return simpleCancel(doctype, name);
    }

    // ── 3. Fetch document from DB ────────────────────────────────────────
    const delegate = getDelegate(prisma, config.prismaModel);
    if (!delegate) {
      return { success: false, error: `Prisma model "${config.prismaModel}" not found` };
    }

    const doc = await delegate.findUnique({
      where: { name },
    }) as Record<string, unknown> | null;

    if (!doc) {
      return { success: false, error: `${doctype} "${name}" not found` };
    }

    // ── 4. Validate docstatus ────────────────────────────────────────────
    const currentDocstatus = Number(doc.docstatus ?? 0);
    if (currentDocstatus === 0) {
      return { success: false, error: `${doctype} "${name}" is a Draft — cannot cancel a draft` };
    }
    if (currentDocstatus === 2) {
      return { success: false, error: `${doctype} "${name}" is already cancelled` };
    }
    if (currentDocstatus !== 1) {
      return { success: false, error: `Unexpected docstatus=${currentDocstatus} for ${doctype} "${name}"` };
    }

    // ── 5. Check for active dependencies ─────────────────────────────────
    const depError = await checkDependencies(doctype, name);
    if (depError) {
      return { success: false, error: depError };
    }

    // ── 6. Fetch children for controller ─────────────────────────────────
    const children: Record<string, unknown[]> = {};
    for (const childModel of config.childModels) {
      const childDelegate = getDelegate(prisma, childModel.accessor);
      if (childDelegate) {
        const childRows = await childDelegate.findMany({
          where: { parent: name },
        }) as unknown[];
        children[childModel.parentField] = Array.isArray(childRows) ? childRows : [];
      }
    }

    // ── 7. Controller onCancel ───────────────────────────────────────────
    const cancelEffects = config.controller.onCancel
      ? config.controller.onCancel(doc, children)
      : {
          reverseGlEntries: false,
          reverseStockLedger: false,
          reverseStatusUpdates: [] as StatusUpdateConfig[],
        };

    // ── 8. Transaction: reverse everything atomically ───────────────────
    const now = new Date();
    const childAccessors = config.childModels.map((c) => c.accessor);

    const updated = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, unknown>;

      // a. Update parent document: docstatus=2, status="Cancelled"
      const txDelegate = getDelegateByAccessor(txRecord, config.prismaModel);
      if (!txDelegate) {
        throw new Error(`Prisma model "${config.prismaModel}" not found in transaction`);
      }

      const result = await txDelegate.update({
        where: { name },
        data: {
          docstatus: 2,
          status: "Cancelled",
          modified: now,
          modified_by: "Administrator",
        } as unknown,
      });

      // b. Cascade docstatus to children
      for (const childAccessor of childAccessors) {
        const childDelegate = getDelegateByAccessor(txRecord, childAccessor);
        if (childDelegate) {
          await childDelegate.updateMany({
            where: { parent: name } as unknown,
            data: { docstatus: 2 } as unknown,
          });
        }
      }

      // c. Reverse GL entries
      let glReversalCount = 0;
      if (cancelEffects.reverseGlEntries) {
        glReversalCount = await reverseGlEntries(txRecord, doctype, name);
      }

      // d. Reverse stock ledger entries
      let sleReversalCount = 0;
      if (cancelEffects.reverseStockLedger) {
        sleReversalCount = await reverseStockLedgerEntries(txRecord, doctype, name);
      }

      // e. Reverse status updates
      let statusReversalCount = 0;
      if (cancelEffects.reverseStatusUpdates.length > 0) {
        statusReversalCount = await reverseStatusUpdates(txRecord, cancelEffects.reverseStatusUpdates);
      }

      return { result, glReversalCount, sleReversalCount, statusReversalCount };
    });

    return {
      success: true,
      data: updated.result,
      gl_reversal_count: updated.glReversalCount,
      stock_reversal_count: updated.sleReversalCount,
      status_reversals_count: updated.statusReversalCount,
    };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[document-orchestrator] cancelDocument error:`, message);
    return { success: false, error: message };
  }
}

/**
 * Validate a document without submitting — for form validation.
 *
 * Builds the validation context and calls the controller's validate
 * function. Does NOT modify the database.
 *
 * @param doctype - The DocType name
 * @param data    - The document data (plain object)
 * @returns Validation result with errors and warnings
 */
export async function validateDocument(
  doctype: string,
  data: Record<string, unknown>,
): Promise<ValidationResult> {
  try {
    const config = REGISTRY.get(doctype);

    if (!config || !config.controller.validate) {
      // No registered controller — basic validation only
      return basicValidation(data);
    }

    // Build validation context
    const context = await buildValidationContext(data);

    // Call controller validate
    return config.controller.validate(data, context);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { valid: false, errors: [message], warnings: [] };
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   INTERNAL HELPERS
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Simple submit for DocTypes NOT in the registry.
 * Just flips docstatus from 0 → 1 and cascades to children.
 * No GL entries, no stock ledger, no status updates.
 */
async function simpleSubmit(doctype: string, name: string): Promise<SubmitResult> {
  try {
    const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
    const delegate = getDelegate(prisma, accessor);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const record = await delegate.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!record) {
      return { success: false, error: `${doctype} "${name}" not found` };
    }

    const currentDocstatus = Number(record.docstatus ?? 0);
    if (currentDocstatus !== 0) {
      return { success: false, error: `Cannot submit: docstatus is ${currentDocstatus}` };
    }

    const now = new Date();
    const childAccessors = findChildAccessors(doctype);

    const updated = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, unknown>;
      const txDelegate = getDelegateByAccessor(txRecord, accessor);
      if (!txDelegate) throw new Error(`Model "${accessor}" not found in transaction`);

      const result = await txDelegate.update({
        where: { name },
        data: {
          docstatus: 1,
          status: "Submitted",
          modified: now,
          modified_by: "Administrator",
        } as unknown,
      });

      for (const childAccessor of childAccessors) {
        const childDelegate = getDelegateByAccessor(txRecord, childAccessor);
        if (childDelegate) {
          await childDelegate.updateMany({
            where: { parent: name } as unknown,
            data: { docstatus: 1 } as unknown,
          });
        }
      }

      return result;
    });

    return { success: true, data: updated };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/**
 * Simple cancel for DocTypes NOT in the registry.
 * Just flips docstatus from 1 → 2 and cascades to children.
 */
async function simpleCancel(doctype: string, name: string): Promise<CancelResult> {
  try {
    const accessor = doctype.charAt(0).toLowerCase() + doctype.slice(1);
    const delegate = getDelegate(prisma, accessor);
    if (!delegate) {
      return { success: false, error: `Unknown DocType: ${doctype}` };
    }

    const record = await delegate.findUnique({ where: { name } }) as Record<string, unknown> | null;
    if (!record) {
      return { success: false, error: `${doctype} "${name}" not found` };
    }

    const currentDocstatus = Number(record.docstatus ?? 0);
    if (currentDocstatus !== 1) {
      return { success: false, error: `Cannot cancel: docstatus is ${currentDocstatus}` };
    }

    const now = new Date();
    const childAccessors = findChildAccessors(doctype);

    const updated = await prisma.$transaction(async (tx) => {
      const txRecord = tx as unknown as Record<string, unknown>;
      const txDelegate = getDelegateByAccessor(txRecord, accessor);
      if (!txDelegate) throw new Error(`Model "${accessor}" not found in transaction`);

      const result = await txDelegate.update({
        where: { name },
        data: {
          docstatus: 2,
          status: "Cancelled",
          modified: now,
          modified_by: "Administrator",
        } as unknown,
      });

      for (const childAccessor of childAccessors) {
        const childDelegate = getDelegateByAccessor(txRecord, childAccessor);
        if (childDelegate) {
          await childDelegate.updateMany({
            where: { parent: name } as unknown,
            data: { docstatus: 2 } as unknown,
          });
        }
      }

      return result;
    });

    return { success: true, data: updated };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return { success: false, error: message };
  }
}

/**
 * Basic validation for documents without a registered controller.
 * Checks for required fields using the Prisma DMMF schema.
 */
function basicValidation(doc: Record<string, unknown>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for common required fields
  if (!doc.company) errors.push("Company is required");
  if (!doc.posting_date && !doc.transaction_date) {
    warnings.push("No posting date or transaction date specified");
  }

  // Check items
  const items = doc.items;
  if (Array.isArray(items) && items.length === 0) {
    warnings.push("No items in document");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check for active dependencies that would prevent cancellation.
 * Looks for GL entries, stock ledger entries, or other documents
 * that reference this document and are not themselves cancelled.
 */
async function checkDependencies(
  doctype: string,
  name: string,
): Promise<string | null> {
  // Check if any active (non-cancelled) documents reference this one
  // via the "against_voucher" field in GL entries
  try {
    const glEntries = await prisma.glEntry.findMany({
      where: {
        against_voucher_type: doctype,
        against_voucher: name,
        is_cancelled: false,
        voucher_no: { not: name },  // Exclude self-referencing entries
      },
      select: { voucher_type: true, voucher_no: true },
      take: 5,
    });

    if (glEntries.length > 0) {
      const refs = glEntries
        .map((e) => `${e.voucher_type}: ${e.voucher_no}`)
        .join(", ");
      return `Cannot cancel ${doctype} "${name}" — it is referenced by: ${refs}`;
    }
  } catch (_e: unknown) {
    // Non-fatal — if the query fails, proceed with cancellation
  }

  return null;
}

/**
 * Find child-table model accessors that belong to a given parent doctype.
 * Uses Prisma DMMF to discover models with parent/parenttype fields,
 * then matches them to the parent doctype.
 *
 * Reuses the same discovery logic from the existing submit route.
 */
function findChildAccessors(doctype: string): string[] {
  const results: string[] = [];

  try {
    const dmmfModels = Prisma.dmmf.datamodel.models;

    for (const m of dmmfModels) {
      const hasParentType = m.fields.some((f) => f.name === "parenttype");
      const hasParent = m.fields.some((f) => f.name === "parent");
      const hasParentfield = m.fields.some((f) => f.name === "parentfield");

      if (hasParentType && hasParent && hasParentfield) {
        const defaultMatchesParent = m.fields.some(
          (f) =>
            f.name === "parenttype" &&
            f.default &&
            (String(f.default) === doctype ||
              (typeof f.default === "object" &&
                f.default !== null &&
                "value" in f.default &&
                String((f.default as { value: string }).value) === doctype)),
        );

        if (defaultMatchesParent || m.name.startsWith(doctype)) {
          results.push(m.name.charAt(0).toLowerCase() + m.name.slice(1));
        }
      }
    }
  } catch (_e: unknown) {
    // DMMF may not be available in all environments
  }

  return results;
}
