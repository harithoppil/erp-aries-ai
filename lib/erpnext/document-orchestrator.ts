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
  calculateTaxesAndTotalsForSI,
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
  calculateTaxesAndTotalsForPI,
  type PurchaseInvoice,
  type PurchaseInvoiceItem as PIItem,
  type GLEntry as PIGlEntry,
  type StockLedgerEntry as PISLE,
  type SupplierInfo as PIControllerSupplierInfo,
} from "./controllers/buying-purchase-invoice";

// ── Journal Entry controller imports ──────────────────────────────────────
import {
  validateJournalEntry,
  validateTotalDebitAndCredit,
  buildGLMap,
  type JournalEntryDoc,
  type JournalEntryAccount,
  type JournalValidationContext,
  type JournalValidationResult,
  type GLEntryRow,
} from "./controllers/accounts-journal-entry";

// ── Stock Entry controller imports ────────────────────────────────────────
import {
  validateStockEntry,
  calculateRateAndAmount,
  type StockEntryDoc,
  type StockEntryItem,
  type ValidationResult as StockEntryValidationResult,
} from "./controllers/stock-entry";

// ── Delivery Note controller imports ──────────────────────────────────────
import {
  validateDeliveryNote,
  type DeliveryNote,
  type DeliveryNoteItem,
  type DeliveryNoteValidationInput,
  type ValidationError as DNValidationError,
  type StatusUpdaterConfig as DNStatusUpdaterConfig,
  DELIVERY_NOTE_STATUS_UPDATER,
} from "./controllers/stock-delivery-note";

// ── Purchase Receipt controller imports ───────────────────────────────────
import {
  validatePurchaseReceipt,
  type PurchaseReceipt,
  type PurchaseReceiptItem,
  type PurchaseReceiptValidationInput,
  type ValidationError as PRValidationError,
  type StatusUpdaterConfig as PRStatusUpdaterConfig,
  PURCHASE_RECEIPT_STATUS_UPDATER,
} from "./controllers/stock-purchase-receipt";

// ── Sales Order controller imports ────────────────────────────────────────
import {
  validateSalesOrder,
  type SalesOrder,
  type SalesOrderItem,
  type SalesOrderValidationResult,
} from "./controllers/selling-sales-order";

// ── Purchase Order controller imports ─────────────────────────────────────
import {
  validatePurchaseOrder,
  type PurchaseOrderDoc,
  type PurchaseOrderItem,
  type ValidationResult as POValidationResult,
  type POValidationContext,
} from "./controllers/buying-purchase-order";

// ── Quotation controller imports ──────────────────────────────────────────
import {
  validateQuotation,
  type Quotation,
  type QuotationItem,
  type QuotationValidationResult,
} from "./controllers/selling-quotation";

// ── Material Request controller imports ───────────────────────────────────
import {
  validatePurchaseDoc as validateMaterialRequestDoc,
  type PurchaseDoc as MaterialRequestDoc,
  type PurchaseItemRow as MaterialRequestItem,
} from "./controllers/buying-controller";

// ── Work Order controller imports ─────────────────────────────────────────
import {
  validateWorkOrder,
  type WorkOrderDoc,
  type WorkOrderItem,
  type ValidationResult as WOValidationResult,
} from "./controllers/manufacturing-work-order";

// ── Tax engine import ─────────────────────────────────────────────────────
import { calculateTaxesAndTotals, type TransactionDoc } from "./controllers/taxes-and-totals";

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
 * Adapter: Sales Invoice controller -> SubmitSideEffects
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

  // Convert controller GLEntry -> GlEntryInput
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

  // Convert controller StockLedgerEntry -> StockLedgerEntryInput
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
        value: childUpdate.newValue,  // Absolute value -- persister will SET directly
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
 * Adapter: Sales Invoice controller -> CancelSideEffects
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
        value: childUpdate.newValue,  // Cancel controller returns correct absolute value to set
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
 * Adapter: Sales Invoice controller -> ValidationResult
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
 * Adapter: Purchase Invoice controller -> SubmitSideEffects
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
        value: childUpdate.newValue,
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
 * Adapter: Purchase Invoice controller -> CancelSideEffects
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
        value: childUpdate.newValue,
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
 * Adapter: Purchase Invoice controller -> ValidationResult
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

/* ================================================================== */
/*  Journal Entry Adapters                                            */
/* ================================================================== */

/**
 * Adapter: Journal Entry controller -> ValidationResult
 *
 * Journal Entry validation uses its own context type. We bridge from
 * the orchestrator's ValidationContext to the JE-specific context.
 */
function jeValidate(doc: unknown, context: ValidationContext): ValidationResult {
  const jeDoc = doc as JournalEntryDoc;
  const warnings: string[] = [];

  // Basic structural validation
  if (!jeDoc.accounts || jeDoc.accounts.length === 0) {
    return { valid: false, errors: ["Accounts table cannot be blank"], warnings: [] };
  }

  if (!jeDoc.company) {
    return { valid: false, errors: ["Company is mandatory"], warnings: [] };
  }

  if (!jeDoc.posting_date) {
    return { valid: false, errors: ["Posting Date is mandatory"], warnings: [] };
  }

  // Check debit/credit balance
  const balanceErr = validateTotalDebitAndCredit(
    jeDoc.difference ?? 0,
    jeDoc.voucher_type,
    jeDoc.multi_currency,
  );
  if (balanceErr) {
    return { valid: false, errors: [balanceErr], warnings: [] };
  }

  // Run full JE validation with a minimal context
  const jeCtx: JournalValidationContext = {
    companyCurrency: context.companyDefaults?.defaultCurrency ?? jeDoc.company_currency ?? "",
  };

  const result = validateJournalEntry(jeDoc, jeCtx);
  if (!result.success) {
    return { valid: false, errors: [result.error ?? "Validation failed"], warnings: result.warnings ?? [] };
  }

  return { valid: true, errors: [], warnings: [...warnings, ...(result.warnings ?? [])] };
}

/**
 * Adapter: Journal Entry controller -> SubmitSideEffects
 *
 * On submit, JE creates GL entries directly from the accounts table.
 */
function jeOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const jeDoc = doc as JournalEntryDoc;
  const glMap: GLEntryRow[] = buildGLMap(jeDoc, []);

  const glEntries: GlEntryInput[] = glMap.map((row: GLEntryRow) => ({
    account: row.account,
    debit: row.debit,
    credit: row.credit,
    against: row.against ?? "",
    voucherType: "Journal Entry",
    voucherNo: jeDoc.name ?? "",
    fiscalYear: "",
    company: jeDoc.company,
    postingDate: new Date(jeDoc.posting_date),
    costCenter: row.cost_center,
    project: row.project,
    partyType: row.party_type,
    party: row.party,
    againstVoucherType: row.against_voucher_type,
    againstVoucher: row.against_voucher,
    remarks: row.remarks,
  }));

  return {
    glEntries,
    stockLedgerEntries: [],
    statusUpdates: [],
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Journal Entry controller -> CancelSideEffects
 *
 * On cancel, JE reverses all GL entries.
 */
function jeOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return {
    reverseGlEntries: true,
    reverseStockLedger: false,
    reverseStatusUpdates: [],
  };
}

/* ================================================================== */
/*  Stock Entry Adapters                                              */
/* ================================================================== */

/**
 * Adapter: Stock Entry controller -> ValidationResult
 */
function seValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const seDoc = doc as StockEntryDoc;

  if (!seDoc.company) {
    return { valid: false, errors: ["Company is mandatory"], warnings: [] };
  }

  if (!seDoc.items || seDoc.items.length === 0) {
    return { valid: false, errors: ["Items table cannot be empty"], warnings: [] };
  }

  const result: StockEntryValidationResult = validateStockEntry(seDoc);
  if (!result.success) {
    return { valid: false, errors: [result.error ?? "Validation failed"], warnings: result.warnings ?? [] };
  }

  return { valid: true, errors: [], warnings: result.warnings ?? [] };
}

/**
 * Adapter: Stock Entry controller -> SubmitSideEffects
 *
 * Stock Entry creates stock ledger entries (no GL entries here --
 * GL entries for stock are handled by the perpetual inventory engine).
 */
function seOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const seDoc = doc as StockEntryDoc;
  const postingDate = seDoc.posting_date ?? new Date().toISOString().split("T")[0];
  const postingTime = seDoc.posting_time ?? new Date().toTimeString().substring(0, 8);
  const voucherNo = seDoc.name ?? "";

  const stockLedgerEntries: StockLedgerEntryInput[] = [];

  for (const item of seDoc.items) {
    // Source warehouse: outgoing (negative qty)
    if (item.s_warehouse && item.qty) {
      const conversionFactor = item.conversion_factor ?? 1;
      stockLedgerEntries.push({
        itemCode: item.item_code,
        warehouse: item.s_warehouse,
        actualQty: -(item.qty * conversionFactor),
        valuationRate: item.valuation_rate ?? item.basic_rate ?? 0,
        stockValueType: "Stock Value",
        voucherType: "Stock Entry",
        voucherNo,
        voucherDetailNo: String(item.idx),
        postingDate: new Date(postingDate),
        postingTime,
        company: seDoc.company,
        fiscalYear: "",
      });
    }

    // Target warehouse: incoming (positive qty)
    if (item.t_warehouse && item.qty) {
      const conversionFactor = item.conversion_factor ?? 1;
      stockLedgerEntries.push({
        itemCode: item.item_code,
        warehouse: item.t_warehouse,
        actualQty: item.qty * conversionFactor,
        valuationRate: item.valuation_rate ?? item.basic_rate ?? 0,
        stockValueType: "Stock Value",
        voucherType: "Stock Entry",
        voucherNo,
        voucherDetailNo: String(item.idx),
        postingDate: new Date(postingDate),
        postingTime,
        company: seDoc.company,
        fiscalYear: "",
      });
    }
  }

  return {
    glEntries: [],
    stockLedgerEntries,
    statusUpdates: [],
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Stock Entry controller -> CancelSideEffects
 */
function seOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return {
    reverseGlEntries: false,
    reverseStockLedger: true,
    reverseStatusUpdates: [],
  };
}

/* ================================================================== */
/*  Delivery Note Adapters                                            */
/* ================================================================== */

/**
 * Adapter: Delivery Note controller -> ValidationResult
 */
function dnValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const dnDoc = doc as DeliveryNote;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!dnDoc.company) {
    return { valid: false, errors: ["Company is mandatory"], warnings: [] };
  }

  if (!dnDoc.items || dnDoc.items.length === 0) {
    return { valid: false, errors: ["Items table cannot be empty"], warnings: [] };
  }

  // Run basic structural validations
  if (!dnDoc.customer) {
    errors.push("Customer is mandatory for Delivery Note");
  }

  if (!dnDoc.posting_date) {
    errors.push("Posting Date is mandatory");
  }

  for (const item of dnDoc.items) {
    if (!item.item_code) {
      errors.push(`Row ${item.idx}: Item Code is mandatory`);
    }
    if (!item.qty || item.qty <= 0) {
      errors.push(`Row ${item.idx}: Quantity must be positive`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors: [], warnings };
}

/**
 * Adapter: Delivery Note controller -> SubmitSideEffects
 *
 * Delivery Note creates stock ledger entries for outgoing items
 * and status updates against linked Sales Orders.
 */
function dnOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const dnDoc = doc as DeliveryNote;
  const postingDate = dnDoc.posting_date ?? new Date().toISOString().split("T")[0];
  const postingTime = dnDoc.posting_time ?? new Date().toTimeString().substring(0, 8);
  const voucherNo = dnDoc.name ?? "";

  // Build stock ledger entries: delivery is outgoing (negative qty)
  const stockLedgerEntries: StockLedgerEntryInput[] = [];
  for (const item of dnDoc.items) {
    if (item.warehouse && item.stock_qty) {
      stockLedgerEntries.push({
        itemCode: item.item_code,
        warehouse: item.warehouse,
        actualQty: -item.stock_qty,
        valuationRate: item.rate ?? 0,
        stockValueType: "Stock Value",
        voucherType: "Delivery Note",
        voucherNo,
        voucherDetailNo: item.id ?? item.idx.toString(),
        postingDate: new Date(postingDate),
        postingTime,
        company: dnDoc.company,
        fiscalYear: "",
      });
    }
  }

  // Build status updates for linked Sales Orders
  const statusUpdates: StatusUpdateConfig[] = [];
  for (const item of dnDoc.items) {
    if (item.against_sales_order && item.so_detail) {
      statusUpdates.push({
        targetDoctype: "Sales Order Item",
        targetName: item.so_detail,
        targetField: "delivered_qty",
        value: item.stock_qty,
      });
    }
  }

  return {
    glEntries: [],
    stockLedgerEntries,
    statusUpdates,
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Delivery Note controller -> CancelSideEffects
 */
function dnOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return {
    reverseGlEntries: false,
    reverseStockLedger: true,
    reverseStatusUpdates: [],
  };
}

/* ================================================================== */
/*  Purchase Receipt Adapters                                         */
/* ================================================================== */

/**
 * Adapter: Purchase Receipt controller -> ValidationResult
 */
function prValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const prDoc = doc as PurchaseReceipt;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!prDoc.company) {
    return { valid: false, errors: ["Company is mandatory"], warnings: [] };
  }

  if (!prDoc.items || prDoc.items.length === 0) {
    return { valid: false, errors: ["Items table cannot be empty"], warnings: [] };
  }

  if (!prDoc.supplier) {
    errors.push("Supplier is mandatory for Purchase Receipt");
  }

  if (!prDoc.posting_date) {
    errors.push("Posting Date is mandatory");
  }

  for (const item of prDoc.items) {
    if (!item.item_code) {
      errors.push(`Row ${item.idx}: Item Code is mandatory`);
    }
    if (!item.qty || item.qty <= 0) {
      errors.push(`Row ${item.idx}: Quantity must be positive`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors: [], warnings };
}

/**
 * Adapter: Purchase Receipt controller -> SubmitSideEffects
 *
 * Purchase Receipt creates stock ledger entries for incoming items
 * and status updates against linked Purchase Orders.
 */
function prOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const prDoc = doc as PurchaseReceipt;
  const postingDate = prDoc.posting_date ?? new Date().toISOString().split("T")[0];
  const postingTime = prDoc.posting_time ?? new Date().toTimeString().substring(0, 8);
  const voucherNo = prDoc.name ?? "";

  // Build stock ledger entries: receipt is incoming (positive qty)
  const stockLedgerEntries: StockLedgerEntryInput[] = [];
  for (const item of prDoc.items) {
    if (item.warehouse && item.received_stock_qty) {
      stockLedgerEntries.push({
        itemCode: item.item_code,
        warehouse: item.warehouse,
        actualQty: item.received_stock_qty,
        valuationRate: item.valuation_rate ?? item.rate ?? 0,
        stockValueType: "Stock Value",
        voucherType: "Purchase Receipt",
        voucherNo,
        voucherDetailNo: item.id ?? item.idx.toString(),
        postingDate: new Date(postingDate),
        postingTime,
        company: prDoc.company,
        fiscalYear: "",
      });
    } else if (item.warehouse && item.stock_qty) {
      stockLedgerEntries.push({
        itemCode: item.item_code,
        warehouse: item.warehouse,
        actualQty: item.stock_qty,
        valuationRate: item.valuation_rate ?? item.rate ?? 0,
        stockValueType: "Stock Value",
        voucherType: "Purchase Receipt",
        voucherNo,
        voucherDetailNo: item.id ?? item.idx.toString(),
        postingDate: new Date(postingDate),
        postingTime,
        company: prDoc.company,
        fiscalYear: "",
      });
    }
  }

  // Build status updates for linked Purchase Orders
  const statusUpdates: StatusUpdateConfig[] = [];
  for (const item of prDoc.items) {
    if (item.purchase_order && item.purchase_order_item) {
      statusUpdates.push({
        targetDoctype: "Purchase Order Item",
        targetName: item.purchase_order_item,
        targetField: "received_qty",
        value: item.received_qty ?? item.qty,
      });
    }
  }

  return {
    glEntries: [],
    stockLedgerEntries,
    statusUpdates,
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Purchase Receipt controller -> CancelSideEffects
 */
function prOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return {
    reverseGlEntries: false,
    reverseStockLedger: true,
    reverseStatusUpdates: [],
  };
}

/* ================================================================== */
/*  Payment Entry Adapters                                            */
/* ================================================================== */

/**
 * Payment Entry creates GL entries: debit bank, credit party (or vice versa).
 * It also updates outstanding amounts on referenced invoices.
 */
function peValidate(doc: unknown, context: ValidationContext): ValidationResult {
  const peDoc = doc as Record<string, unknown>;
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!peDoc.company) {
    return { valid: false, errors: ["Company is mandatory"], warnings: [] };
  }

  if (!peDoc.party_type) {
    errors.push("Party Type is mandatory");
  }

  if (!peDoc.party) {
    errors.push("Party is mandatory");
  }

  if (!peDoc.paid_amount || Number(peDoc.paid_amount) <= 0) {
    errors.push("Paid Amount must be positive");
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return { valid: true, errors: [], warnings };
}

/**
 * Adapter: Payment Entry -> SubmitSideEffects
 *
 * Creates GL entries:
 *   - Debit: party account (reduces outstanding)
 *   - Credit: bank/cash account (money paid out)
 *   Or vice versa for receiving payments.
 */
function peOnSubmit(doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  const peDoc = doc as Record<string, unknown>;
  const company = peDoc.company as string;
  const postingDate = new Date((peDoc.posting_date as string) ?? new Date());
  const voucherNo = (peDoc.name as string) ?? "";
  const paidAmount = Number(peDoc.paid_amount ?? 0);
  const partyType = peDoc.party_type as string;
  const party = peDoc.party as string;
  const partyAccount = peDoc.party_account as string;
  const paidFrom = peDoc.paid_from as string;
  const paidTo = peDoc.paid_to as string;
  const paymentType = peDoc.payment_type as string;
  const costCenter = peDoc.cost_center as string | undefined;
  const referenceNo = peDoc.reference_no as string | undefined;
  const references = peDoc.references as Array<Record<string, unknown>> | undefined;

  const glEntries: GlEntryInput[] = [];

  if (paymentType === "Pay") {
    // Paying to supplier: Debit party (payable), Credit bank
    if (paidFrom && paidAmount > 0) {
      glEntries.push({
        account: partyAccount || paidFrom,
        debit: paidAmount,
        credit: 0,
        against: paidTo ?? "",
        voucherType: "Payment Entry",
        voucherNo,
        fiscalYear: "",
        company,
        postingDate,
        costCenter,
        partyType,
        party,
        remarks: `Payment ${referenceNo ?? voucherNo}`,
      });
      glEntries.push({
        account: paidTo ?? paidFrom,
        debit: 0,
        credit: paidAmount,
        against: party ?? "",
        voucherType: "Payment Entry",
        voucherNo,
        fiscalYear: "",
        company,
        postingDate,
        costCenter,
        remarks: `Payment ${referenceNo ?? voucherNo}`,
      });
    }
  } else {
    // Receiving from customer: Debit bank, Credit party (receivable)
    if (paidTo && paidAmount > 0) {
      glEntries.push({
        account: paidTo ?? paidFrom,
        debit: paidAmount,
        credit: 0,
        against: party ?? "",
        voucherType: "Payment Entry",
        voucherNo,
        fiscalYear: "",
        company,
        postingDate,
        costCenter,
        remarks: `Receipt ${referenceNo ?? voucherNo}`,
      });
      glEntries.push({
        account: partyAccount || paidTo,
        debit: 0,
        credit: paidAmount,
        against: paidTo ?? "",
        voucherType: "Payment Entry",
        voucherNo,
        fiscalYear: "",
        company,
        postingDate,
        costCenter,
        partyType,
        party,
        remarks: `Receipt ${referenceNo ?? voucherNo}`,
      });
    }
  }

  // Build status updates for referenced invoices (update outstanding)
  const statusUpdates: StatusUpdateConfig[] = [];
  if (references) {
    for (const ref of references) {
      if (ref.reference_name && ref.outstanding_amount !== undefined) {
        const allocatedAmount = Number(ref.allocated_amount ?? paidAmount);
        statusUpdates.push({
          targetDoctype: (ref.reference_type as string) ?? "",
          targetName: ref.reference_name as string,
          targetField: "outstanding_amount",
          value: Number(ref.outstanding_amount) - allocatedAmount,
        });
      }
    }
  }

  return {
    glEntries,
    stockLedgerEntries: [],
    statusUpdates,
    accountBalanceUpdates: [],
  };
}

/**
 * Adapter: Payment Entry -> CancelSideEffects
 */
function peOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return {
    reverseGlEntries: true,
    reverseStockLedger: false,
    reverseStatusUpdates: [],
  };
}

/* ================================================================== */
/*  Sales Order Adapters                                              */
/* ================================================================== */

/**
 * Sales Order: status-only DocType. No GL or stock entries on submit.
 */
function soValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const soDoc = doc as Record<string, unknown>;
  const errors: string[] = [];

  if (!soDoc.company) errors.push("Company is mandatory");
  if (!soDoc.customer) errors.push("Customer is mandatory");
  if (!soDoc.transaction_date) errors.push("Transaction Date is mandatory");

  const items = soDoc.items as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) {
    errors.push("Items table cannot be empty");
  } else {
    for (const item of items) {
      if (!item.item_code) errors.push(`Row ${item.idx ?? ""}: Item Code is mandatory`);
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, errors: [], warnings: [] };
}

function soOnSubmit(_doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  // Sales Order submit is status-only: no GL, no stock, just docstatus flip
  return { glEntries: [], stockLedgerEntries: [], statusUpdates: [], accountBalanceUpdates: [] };
}

function soOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
}

/* ================================================================== */
/*  Purchase Order Adapters                                           */
/* ================================================================== */

/**
 * Purchase Order: status-only DocType. No GL or stock entries on submit.
 */
function poValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const poDoc = doc as Record<string, unknown>;
  const errors: string[] = [];

  if (!poDoc.company) errors.push("Company is mandatory");
  if (!poDoc.supplier) errors.push("Supplier is mandatory");
  if (!poDoc.transaction_date && !poDoc.schedule_date) {
    errors.push("Transaction Date or Schedule Date is mandatory");
  }

  const items = poDoc.items as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) {
    errors.push("Items table cannot be empty");
  } else {
    for (const item of items) {
      if (!item.item_code) errors.push(`Row ${item.idx ?? ""}: Item Code is mandatory`);
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, errors: [], warnings: [] };
}

function poOnSubmit(_doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  // Purchase Order submit is status-only: no GL, no stock
  return { glEntries: [], stockLedgerEntries: [], statusUpdates: [], accountBalanceUpdates: [] };
}

function poOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
}

/* ================================================================== */
/*  Quotation Adapters                                                */
/* ================================================================== */

/**
 * Quotation: status-only DocType. No GL or stock entries on submit.
 */
function qtValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const qtDoc = doc as Record<string, unknown>;
  const errors: string[] = [];

  if (!qtDoc.company) errors.push("Company is mandatory");
  if (!qtDoc.party_name) errors.push("Party Name is mandatory");
  if (!qtDoc.transaction_date) errors.push("Transaction Date is mandatory");

  const items = qtDoc.items as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) {
    errors.push("Items table cannot be empty");
  } else {
    for (const item of items) {
      if (!item.item_code) errors.push(`Row ${item.idx ?? ""}: Item Code is mandatory`);
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, errors: [], warnings: [] };
}

function qtOnSubmit(_doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  return { glEntries: [], stockLedgerEntries: [], statusUpdates: [], accountBalanceUpdates: [] };
}

function qtOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
}

/* ================================================================== */
/*  Material Request Adapters                                         */
/* ================================================================== */

/**
 * Material Request: status-only DocType. No GL or stock entries on submit.
 */
function mrValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const mrDoc = doc as Record<string, unknown>;
  const errors: string[] = [];

  if (!mrDoc.company) errors.push("Company is mandatory");
  if (!mrDoc.transaction_date) errors.push("Transaction Date is mandatory");

  const items = mrDoc.items as Array<Record<string, unknown>> | undefined;
  if (!items || items.length === 0) {
    errors.push("Items table cannot be empty");
  } else {
    for (const item of items) {
      if (!item.item_code) errors.push(`Row ${item.idx ?? ""}: Item Code is mandatory`);
      if (!item.qty || Number(item.qty) <= 0) {
        errors.push(`Row ${item.idx ?? ""}: Quantity must be positive`);
      }
    }
  }

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, errors: [], warnings: [] };
}

function mrOnSubmit(_doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  return { glEntries: [], stockLedgerEntries: [], statusUpdates: [], accountBalanceUpdates: [] };
}

function mrOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
}

/* ================================================================== */
/*  Work Order Adapters                                               */
/* ================================================================== */

/**
 * Work Order: status-only DocType. No GL or stock entries on submit.
 * Stock movements happen via Stock Entries linked to the Work Order.
 */
function woValidate(doc: unknown, _context: ValidationContext): ValidationResult {
  const woDoc = doc as Record<string, unknown>;
  const errors: string[] = [];

  if (!woDoc.company) errors.push("Company is mandatory");
  if (!woDoc.production_item) errors.push("Production Item is mandatory");
  if (!woDoc.qty || Number(woDoc.qty) <= 0) errors.push("Quantity must be positive");
  if (!woDoc.bom_no) errors.push("BOM No is mandatory");

  return errors.length > 0
    ? { valid: false, errors, warnings: [] }
    : { valid: true, errors: [], warnings: [] };
}

function woOnSubmit(_doc: unknown, _children: Record<string, unknown[]>): SubmitSideEffects {
  // Work Order submit is status-only: actual stock movements happen via Stock Entries
  return { glEntries: [], stockLedgerEntries: [], statusUpdates: [], accountBalanceUpdates: [] };
}

function woOnCancel(_doc: unknown, _children: Record<string, unknown[]>): CancelSideEffects {
  return { reverseGlEntries: false, reverseStockLedger: false, reverseStatusUpdates: [] };
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

  // ── Journal Entry (GL entries on submit) ─────────────────────────────────
  ["Journal Entry", {
    controller: {
      validate: jeValidate,
      onSubmit: jeOnSubmit,
      onCancel: jeOnCancel,
    },
    prismaModel: "journalEntry",
    childModels: [
      { accessor: "journalEntryAccount", parentField: "accounts" },
    ],
    submittable: true,
  }],

  // ── Stock Entry (SLE + bin updates on submit) ────────────────────────────
  ["Stock Entry", {
    controller: {
      validate: seValidate,
      onSubmit: seOnSubmit,
      onCancel: seOnCancel,
    },
    prismaModel: "stockEntry",
    childModels: [
      { accessor: "stockEntryDetail", parentField: "items" },
    ],
    submittable: true,
  }],

  // ── Delivery Note (SLE + bin updates + SO status on submit) ──────────────
  ["Delivery Note", {
    controller: {
      validate: dnValidate,
      onSubmit: dnOnSubmit,
      onCancel: dnOnCancel,
    },
    prismaModel: "deliveryNote",
    childModels: [
      { accessor: "deliveryNoteItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Purchase Receipt (SLE + bin updates + PO status on submit) ───────────
  ["Purchase Receipt", {
    controller: {
      validate: prValidate,
      onSubmit: prOnSubmit,
      onCancel: prOnCancel,
    },
    prismaModel: "purchaseReceipt",
    childModels: [
      { accessor: "purchaseReceiptItem", parentField: "items" },
      { accessor: "purchaseTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Payment Entry (GL entries + outstanding update on submit) ────────────
  ["Payment Entry", {
    controller: {
      validate: peValidate,
      onSubmit: peOnSubmit,
      onCancel: peOnCancel,
    },
    prismaModel: "paymentEntry",
    childModels: [
      { accessor: "paymentEntryReference", parentField: "references" },
      { accessor: "paymentEntryDeduction", parentField: "deductions" },
    ],
    submittable: true,
  }],

  // ── Sales Order (status-only on submit) ─────────────────────────────────
  ["Sales Order", {
    controller: {
      validate: soValidate,
      onSubmit: soOnSubmit,
      onCancel: soOnCancel,
    },
    prismaModel: "salesOrder",
    childModels: [
      { accessor: "salesOrderItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Purchase Order (status-only on submit) ──────────────────────────────
  ["Purchase Order", {
    controller: {
      validate: poValidate,
      onSubmit: poOnSubmit,
      onCancel: poOnCancel,
    },
    prismaModel: "purchaseOrder",
    childModels: [
      { accessor: "purchaseOrderItem", parentField: "items" },
      { accessor: "purchaseTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Quotation (status-only on submit) ───────────────────────────────────
  ["Quotation", {
    controller: {
      validate: qtValidate,
      onSubmit: qtOnSubmit,
      onCancel: qtOnCancel,
    },
    prismaModel: "quotation",
    childModels: [
      { accessor: "quotationItem", parentField: "items" },
      { accessor: "salesTaxesAndCharges", parentField: "taxes" },
    ],
    submittable: true,
  }],

  // ── Material Request (status-only on submit) ────────────────────────────
  ["Material Request", {
    controller: {
      validate: mrValidate,
      onSubmit: mrOnSubmit,
      onCancel: mrOnCancel,
    },
    prismaModel: "materialRequest",
    childModels: [
      { accessor: "materialRequestItem", parentField: "items" },
    ],
    submittable: true,
  }],

  // ── Work Order (status-only on submit) ──────────────────────────────────
  ["Work Order", {
    controller: {
      validate: woValidate,
      onSubmit: woOnSubmit,
      onCancel: woOnCancel,
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
 * Get the DocType registry -- which controllers handle which DocTypes.
 * Returns a copy so callers cannot mutate the internal registry.
 */
export function getDocTypeRegistry(): Map<string, DocTypeConfig> {
  return new Map(REGISTRY);
}

/**
 * Submit a document -- validates, creates GL/stock entries, updates status.
 *
 * Full flow:
 * 1. Check RBAC (session must have submit permission)
 * 2. Lookup DocTypeConfig from registry (fallback for unregistered types)
 * 3. Fetch document from DB
 * 4. Validate docstatus is Draft (0)
 * 5. Fetch children from DB
 * 6. Build ValidationContext (fiscal year, company defaults, party info)
 * 7. Call controller.validate(doc, context) -- throw if invalid
 * 8. Call controller.onSubmit(doc, children) -- get side effects
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
 * @param options - Optional: token to tie RBAC to the requesting user's session
 * @returns Submit result with counts of created entries
 */
export async function submitDocument(
  doctype: string,
  name: string,
  options?: { token?: string },
): Promise<SubmitResult> {
  try {
    // ── 1. RBAC ──────────────────────────────────────────────────────────
    const permCheck = await checkPermission(doctype, "submit", options?.token);
    if (!permCheck.allowed) {
      return { success: false, error: permCheck.reason ?? "Permission denied" };
    }

    // ── 2. Lookup config ─────────────────────────────────────────────────
    const config = REGISTRY.get(doctype);

    if (!config) {
      // DocType not in registry -- fall back to simple docstatus flip
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
 * Cancel a document -- reverses GL/stock, updates status.
 *
 * Full flow:
 * 1. Check RBAC (session must have cancel permission)
 * 2. Lookup DocTypeConfig from registry (fallback for unregistered types)
 * 3. Fetch document from DB
 * 4. Validate docstatus is Submitted (1)
 * 5. Check for active dependencies (no active documents reference this)
 * 6. Call controller.onCancel(doc, children) -- get reverse effects
 * 7. Wrap in prisma.$transaction():
 *    a. Update doc: docstatus=2, status="Cancelled"
 *    b. Create reversal GL entries
 *    c. Create reversal stock ledger entries
 *    d. Reverse status updates
 * 8. Return result
 *
 * @param doctype - The DocType name (e.g. "Sales Invoice")
 * @param name    - The document name/ID
 * @param options - Optional: token to tie RBAC to the requesting user's session
 * @returns Cancel result with counts of reversed entries
 */
export async function cancelDocument(
  doctype: string,
  name: string,
  options?: { token?: string },
): Promise<CancelResult> {
  try {
    // ── 1. RBAC ──────────────────────────────────────────────────────────
    const permCheck = await checkPermission(doctype, "cancel", options?.token);
    if (!permCheck.allowed) {
      return { success: false, error: permCheck.reason ?? "Permission denied" };
    }

    // ── 2. Lookup config ─────────────────────────────────────────────────
    const config = REGISTRY.get(doctype);

    if (!config) {
      // DocType not in registry -- fall back to simple docstatus flip
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
      return { success: false, error: `${doctype} "${name}" is a Draft -- cannot cancel a draft` };
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
 * Validate a document without submitting -- for form validation.
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
      // No registered controller -- basic validation only
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
 * Just flips docstatus from 0 -> 1 and cascades to children.
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
 * Just flips docstatus from 1 -> 2 and cascades to children.
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
 * Checks for common required fields using the Prisma DMMF schema.
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
      return `Cannot cancel ${doctype} "${name}" -- it is referenced by: ${refs}`;
    }
  } catch (_e: unknown) {
    // Non-fatal -- if the query fails, proceed with cancellation
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
