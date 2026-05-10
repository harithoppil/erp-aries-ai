/**
 * GL Entry Persister — Inserts and reverses GL entries inside a transaction.
 *
 * Takes GlEntry[] from controller output and persists them into the
 * `erpnext_port.GlEntry` table. Also handles reversal on cancellation
 * by creating mirror entries with swapped debit/credit.
 *
 * RULES:
 * - No `any` types except `catch (e)`.
 * - Every function has explicit params and return types.
 * - All functions receive a Prisma transaction client (`tx`) as the first
 *   parameter — they NEVER start their own transaction.
 * - Uses `getDelegateByAccessor` from prisma-delegate for dynamic model access.
 */

import { PrismaClient } from "@/prisma/client";
import { getDelegateByAccessor, type PrismaDelegate } from "./prisma-delegate";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Simplified GL entry from controller output (used in DocTypeConfig) */
export interface GlEntryInput {
  account: string;
  debit: number;
  credit: number;
  against: string;
  voucherType: string;
  voucherNo: string;
  fiscalYear: string;
  company: string;
  postingDate: Date;
  costCenter?: string;
  project?: string;
  partyType?: string;
  party?: string;
  againstVoucherType?: string;
  againstVoucher?: string;
  remarks?: string;
  isOpening?: string;
  isAdvance?: string;
  dueDate?: Date;
}

/** Internal representation mapped to the GlEntry Prisma model */
interface GlEntryRow {
  name: string;
  creation: Date;
  modified: Date;
  modified_by: string;
  owner: string;
  docstatus: number;
  idx: number;
  posting_date: Date;
  account: string;
  party_type?: string;
  party?: string;
  cost_center?: string;
  debit: number;
  credit: number;
  account_currency?: string;
  against: string;
  against_voucher_type?: string;
  against_voucher?: string;
  voucher_type: string;
  voucher_no: string;
  voucher_detail_no?: string;
  project?: string;
  remarks?: string;
  is_opening: string;
  is_advance: string;
  fiscal_year: string;
  company: string;
  is_cancelled: boolean;
  to_rename: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let entryCounter = 0;

/**
 * Generate a unique name for a GL entry row.
 * Uses a hash-like pattern matching ERPNext's autoname convention.
 */
function generateGLEntryName(voucherNo: string): string {
  entryCounter += 1;
  const hash = Math.random().toString(36).substring(2, 12);
  return `${voucherNo}-GLE-${hash}-${entryCounter}`;
}

/**
 * Resolve the glEntry delegate from the transaction client.
 */
function getGlEntryDelegate(tx: Record<string, unknown>): PrismaDelegate | null {
  return getDelegateByAccessor(tx, "glEntry");
}

/* ------------------------------------------------------------------ */
/*  Persist GL Entries                                                 */
/* ------------------------------------------------------------------ */

/**
 * Persist GL entries into the database inside an existing transaction.
 *
 * Maps the simplified GlEntryInput from controller output to the full
 * GlEntry Prisma model and inserts them in bulk.
 *
 * @param tx      - Prisma transaction client
 * @param entries - Array of GL entry inputs from the controller
 * @returns Number of entries inserted
 */
export async function persistGlEntries(
  tx: Record<string, unknown>,
  entries: GlEntryInput[],
): Promise<number> {
  if (entries.length === 0) return 0;

  const delegate = getGlEntryDelegate(tx);
  if (!delegate) {
    throw new Error("GlEntry model not found in Prisma schema");
  }

  const now = new Date();
  const rows: GlEntryRow[] = entries.map((entry, idx) => ({
    name: generateGLEntryName(entry.voucherNo),
    creation: now,
    modified: now,
    modified_by: "Administrator",
    owner: "Administrator",
    docstatus: 1,
    idx: idx + 1,
    posting_date: entry.postingDate,
    account: entry.account,
    party_type: entry.partyType,
    party: entry.party,
    cost_center: entry.costCenter,
    debit: entry.debit,
    credit: entry.credit,
    account_currency: undefined,
    against: entry.against,
    against_voucher_type: entry.againstVoucherType,
    against_voucher: entry.againstVoucher,
    voucher_type: entry.voucherType,
    voucher_no: entry.voucherNo,
    voucher_detail_no: undefined,
    project: entry.project,
    remarks: entry.remarks,
    is_opening: entry.isOpening ?? "No",
    is_advance: entry.isAdvance ?? "No",
    fiscal_year: entry.fiscalYear,
    company: entry.company,
    is_cancelled: false,
    to_rename: true,
  }));

  await delegate.createMany({
    data: rows as unknown[],
    skipDuplicates: true,
  });

  return rows.length;
}

/* ------------------------------------------------------------------ */
/*  Reverse GL Entries                                                 */
/* ------------------------------------------------------------------ */

/**
 * Reverse GL entries for a voucher by:
 * 1. Marking the original entries as cancelled
 * 2. Creating mirror entries with debit/credit swapped
 *
 * @param tx           - Prisma transaction client
 * @param voucherType  - The voucher type (e.g. "Sales Invoice")
 * @param voucherNo    - The voucher name/number
 * @returns Number of reversal entries created
 */
export async function reverseGlEntries(
  tx: Record<string, unknown>,
  voucherType: string,
  voucherNo: string,
): Promise<number> {
  const delegate = getGlEntryDelegate(tx);
  if (!delegate) {
    throw new Error("GlEntry model not found in Prisma schema");
  }

  // Find all original (non-cancelled) GL entries for this voucher
  const existing = await delegate.findMany({
    where: {
      voucher_type: voucherType,
      voucher_no: voucherNo,
      is_cancelled: false,
    } as unknown,
  }) as unknown[];

  if (!Array.isArray(existing) || existing.length === 0) return 0;

  // Mark original entries as cancelled
  await delegate.updateMany({
    where: {
      voucher_type: voucherType,
      voucher_no: voucherNo,
      is_cancelled: false,
    } as unknown,
    data: {
      is_cancelled: true,
      docstatus: 2,
    } as unknown,
  });

  // Create reversal (mirror) entries — swap debit/credit
  const now = new Date();
  const reversalRows: GlEntryRow[] = (existing as Record<string, unknown>[]).map(
    (entry, idx) => {
      const originalDebit = Number(entry.debit ?? 0);
      const originalCredit = Number(entry.credit ?? 0);

      return {
        name: generateGLEntryName(`${voucherNo}-reverse`),
        creation: now,
        modified: now,
        modified_by: "Administrator",
        owner: "Administrator",
        docstatus: 1,
        idx: idx + 1,
        posting_date: entry.posting_date as Date ?? now,
        account: entry.account as string ?? "",
        party_type: entry.party_type as string | undefined,
        party: entry.party as string | undefined,
        cost_center: entry.cost_center as string | undefined,
        debit: originalCredit,  // Swap: original credit becomes debit
        credit: originalDebit,  // Swap: original debit becomes credit
        account_currency: entry.account_currency as string | undefined,
        against: entry.against as string ?? "",
        against_voucher_type: entry.against_voucher_type as string | undefined,
        against_voucher: entry.against_voucher as string | undefined,
        voucher_type: voucherType,
        voucher_no: voucherNo,
        voucher_detail_no: entry.voucher_detail_no as string | undefined,
        project: entry.project as string | undefined,
        remarks: `Reversal: ${entry.remarks ?? ""}`,
        is_opening: entry.is_opening as string ?? "No",
        is_advance: entry.is_advance as string ?? "No",
        fiscal_year: entry.fiscal_year as string ?? "",
        company: entry.company as string ?? "",
        is_cancelled: false,
        to_rename: true,
      };
    },
  );

  await delegate.createMany({
    data: reversalRows as unknown[],
    skipDuplicates: true,
  });

  return reversalRows.length;
}

/* ------------------------------------------------------------------ */
/*  Get GL entries for a voucher                                       */
/* ------------------------------------------------------------------ */

/**
 * Fetch existing GL entries for a voucher.
 * Useful for validation and diagnostics.
 *
 * @param tx           - Prisma transaction client (or the main prisma instance)
 * @param voucherType  - The voucher type
 * @param voucherNo    - The voucher name
 * @returns Array of GL entry records
 */
export async function getGlEntriesForVoucher(
  tx: Record<string, unknown>,
  voucherType: string,
  voucherNo: string,
): Promise<unknown[]> {
  const delegate = getGlEntryDelegate(tx);
  if (!delegate) return [];

  const entries = await delegate.findMany({
    where: {
      voucher_type: voucherType,
      voucher_no: voucherNo,
      is_cancelled: false,
    } as unknown,
  });

  return Array.isArray(entries) ? entries : [];
}

/* ------------------------------------------------------------------ */
/*  Validate GL balance                                                */
/* ------------------------------------------------------------------ */

/**
 * Validate that a set of GL entries balance (total debit === total credit).
 * Returns an error string if they don't balance within tolerance.
 *
 * @param entries    - Array of GL entries to validate
 * @param precision  - Decimal precision for comparison (default 2)
 * @returns Error string or undefined if balanced
 */
export function validateGlBalance(
  entries: GlEntryInput[],
  precision = 2,
): string | undefined {
  const factor = 10 ** precision;
  const round = (n: number) => Math.round(n * factor) / factor;

  const totalDebit = round(entries.reduce((sum, e) => sum + Number(e.debit ?? 0), 0));
  const totalCredit = round(entries.reduce((sum, e) => sum + Number(e.credit ?? 0), 0));

  if (Math.abs(totalDebit - totalCredit) > 0.1) {
    return `GL Entries are not balanced. Debit: ${totalDebit}, Credit: ${totalCredit}`;
  }

  return undefined;
}
