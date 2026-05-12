/**
 * Shared assertion helpers for integration tests.
 *
 * Mirrors Frappe's StockTestMixin.assertSLEs() and assertGLEs() pattern.
 */
import { expect } from 'vitest';
import type { TransactionClient } from './test-db';

// ── GL Entry assertions ──────────────────────────────────────────────────────

interface ExpectedGLEntry {
  account: string;
  debit?: number;
  credit?: number;
}

/**
 * Assert that GL entries exist for a voucher with the expected account/debit/credit totals.
 */
export async function assertGLEntries(
  prisma: TransactionClient,
  voucherType: string,
  voucherNo: string,
  expected: ExpectedGLEntry[],
): Promise<void> {
  const rows =
    await (prisma as unknown as { gLEntry: { findMany: (args: unknown) => Promise<Array<{ account: string; debit: number; credit: number }>> } })
      .gLEntry.findMany({
        where: { voucher_type: voucherType, voucher_no: voucherNo },
        select: { account: true, debit: true, credit: true },
      });

  // Group by account and sum
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const key = String(row.account);
    const existing = byAccount.get(key) ?? { debit: 0, credit: 0 };
    existing.debit += Number(row.debit) || 0;
    existing.credit += Number(row.credit) || 0;
    byAccount.set(key, existing);
  }

  for (const exp of expected) {
    const actual = byAccount.get(exp.account);
    expect(actual, `GL Entry for account "${exp.account}" should exist`).toBeDefined();
    if (exp.debit !== undefined) {
      expect(actual!.debit, `Debit for ${exp.account}`).toBeCloseTo(exp.debit, 2);
    }
    if (exp.credit !== undefined) {
      expect(actual!.credit, `Credit for ${exp.account}`).toBeCloseTo(exp.credit, 2);
    }
  }
}

/**
 * Assert that NO GL entries exist for a voucher (e.g. after cancel, entries should be reversed).
 */
export async function assertNoGLEntries(
  prisma: TransactionClient,
  voucherType: string,
  voucherNo: string,
): Promise<void> {
  const rows: unknown[] =
    await (prisma as unknown as { gLEntry: { findMany: (args: unknown) => Promise<unknown[]> } })
      .gLEntry.findMany({
        where: { voucher_type: voucherType, voucher_no: voucherNo },
      });
  expect(rows, `No GL entries should exist for ${voucherType} ${voucherNo}`).toHaveLength(0);
}

// ── Child row assertions ─────────────────────────────────────────────────────

/**
 * Assert that child rows exist for a parent with the expected fieldname and count.
 */
export async function assertChildRows(
  prisma: TransactionClient,
  childAccessor: string,
  parentName: string,
  parentfield: string,
  expectedCount: number,
): Promise<void> {
  const model = (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<unknown[]> }>)[childAccessor];
  expect(model, `Child model "${childAccessor}" should exist on Prisma client`).toBeDefined();

  const rows = await model!.findMany({
    where: { parent: parentName, parentfield },
  });
  expect(rows, `Child rows for ${parentfield} on ${parentName}`).toHaveLength(expectedCount);
}

/**
 * Assert that child row names are stable (not regenerated UUIDs).
 */
export async function assertChildRowNamesStable(
  prisma: TransactionClient,
  childAccessor: string,
  parentName: string,
  parentfield: string,
  expectedNames: string[],
): Promise<void> {
  const model = (prisma as unknown as Record<string, { findMany: (args: unknown) => Promise<Array<Record<string, unknown>>> }>)[childAccessor];
  const rows = await model!.findMany({
    where: { parent: parentName, parentfield },
    select: { name: true },
    orderBy: { idx: 'asc' },
  });
  const actualNames = rows.map((r) => String(r.name));
  expect(actualNames).toEqual(expectedNames);
}

// ── Docstatus assertions ─────────────────────────────────────────────────────

/**
 * Assert the docstatus of a record.
 */
export async function assertDocstatus(
  prisma: TransactionClient,
  accessor: string,
  name: string,
  expected: number,
): Promise<void> {
  const model = (prisma as unknown as Record<string, { findUnique: (args: unknown) => Promise<Record<string, unknown> | null> }>)[accessor];
  const record = await model!.findUnique({ where: { name }, select: { docstatus: true } });
  expect(record, `Record ${name} should exist`).not.toBeNull();
  expect(Number(record!.docstatus)).toBe(expected);
}
