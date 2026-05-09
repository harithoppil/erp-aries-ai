/**
 * Shared type definitions for ERPNext document models.
 *
 * These types replace `any` usage across server actions and client components,
 * providing compile-time safety while remaining flexible enough for the
 * dynamic ERPNext data model.
 */

// ── DocType Status Values ────────────────────────────────────────────────────

/** Common ERPNext document statuses */
export type ErpDocStatus = 'Draft' | 'Submitted' | 'Cancelled';

/** Sales/Purchase invoice statuses */
export type InvoiceStatus = 'Draft' | 'Unpaid' | 'Paid' | 'Partly Paid' | 'Cancelled' | 'Return';

/** Opportunity statuses */
export type OpportunityStatus = 'Open' | 'Qualified' | 'Proposal/Price Quote' | 'Negotiation' | 'Converted' | 'Lost';

/** Work order statuses */
export type WorkOrderStatus = 'Not Started' | 'In Process' | 'Completed' | 'Stopped' | 'Cancelled';

// ── Prisma Relation Item Types ────────────────────────────────────────────────
// These mirror the child-table models that Prisma generates but which
// are not yet included in the generated client due to schema gaps.

export interface OpportunityItemRow {
  name: string;
  item_code: string | null;
  item_name: string | null;
  qty: number;
  rate: number;
  amount: number;
  uom: string | null;
}

export interface SalesInvoiceItemRow {
  name: string;
  item_code: string | null;
  item_name: string;
  qty: number | null;
  uom: string;
  rate: number;
  amount: number;
  income_account: string;
  cost_center: string | null;
  warehouse: string | null;
}

export interface PurchaseInvoiceItemRow {
  name: string;
  item_code: string | null;
  item_name: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  expense_account: string | null;
  cost_center: string | null;
  warehouse: string | null;
}

export interface StockEntryDetailRow {
  name: string;
  item_code: string;
  item_name: string | null;
  qty: number;
  uom: string;
  basic_rate: number;
  basic_amount: number;
  s_warehouse: string | null;
  t_warehouse: string | null;
  serial_no: string | null;
  batch_no: string | null;
}

export interface PurchaseReceiptItemRow {
  name: string;
  item_code: string;
  item_name: string;
  received_qty: number;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  warehouse: string | null;
}

// ── Report Return Types ──────────────────────────────────────────────────────

export interface StockBalanceRow {
  item_code: string;
  warehouse: string;
  actual_qty: number;
  projected_qty: number;
}

export interface SalesAnalyticsRow {
  month: string;
  total: number;
}

// ── Chart of Accounts ────────────────────────────────────────────────────────

export interface AccountTreeNode {
  id: string;
  account_number: string | null;
  name: string;
  root_type: string;
  level: number;
  is_group: boolean | null;
  balance: number;
}

// ── Journal Entry Type ────────────────────────────────────────────────────────

export type JournalEntryType = 'debit' | 'credit' | 'DEBIT' | 'CREDIT' | string;
