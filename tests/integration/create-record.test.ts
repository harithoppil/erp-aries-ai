/**
 * H6 TEST: Child tables — are they saved when creating a new record?
 *
 * This is THE most critical test. The audit found that createDoctypeRecord
 * strips child arrays from the payload and never saves them separately.
 * A Sales Invoice created with 3 items ends up with 0 items in the DB.
 *
 * This test proves the bug exists (or proves it's fixed).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestDb } from '../helpers/test-db';
import { createCustomer, createItem, createSalesInvoice, ensureCompany } from '../helpers/factories';
import { assertChildRows } from '../helpers/assertions';

describe('H6: Child tables on create', () => {
  const tdb = new TestDb();

  beforeAll(async () => {
    await tdb.setup();
    await ensureCompany(tdb.prisma);
  }, 30_000);

  afterAll(async () => {
    await tdb.teardown();
  }, 30_000);

  it('should save child table rows when creating a Sales Invoice via factory', async () => {
    const customer = await createCustomer(tdb.prisma);
    const item1 = await createItem(tdb.prisma, { item_code: 'TEST-ITEM-1' });
    const item2 = await createItem(tdb.prisma, { item_code: 'TEST-ITEM-2' });
    const item3 = await createItem(tdb.prisma, { item_code: 'TEST-ITEM-3' });

    const si = await createSalesInvoice(tdb.prisma, {
      customer,
      items: [
        { item_code: item1, qty: 2, rate: 100 },
        { item_code: item2, qty: 1, rate: 250 },
        { item_code: item3, qty: 5, rate: 50 },
      ],
    });

    // Verify parent record exists
    const parent = await (tdb.prisma as unknown as { salesInvoice: { findUnique: (a: unknown) => Promise<unknown> } })
      .salesInvoice.findUnique({ where: { name: si.name } });
    expect(parent).not.toBeNull();

    // THE critical assertion: child rows should exist
    await assertChildRows(tdb.prisma, 'salesInvoiceItem', si.name, 'items', 3);
  });

  it('should save child rows with correct field values', async () => {
    const customer = await createCustomer(tdb.prisma);
    const item = await createItem(tdb.prisma, { item_code: 'TEST-VAL-ITEM' });

    const si = await createSalesInvoice(tdb.prisma, {
      customer,
      items: [{ item_code: item, qty: 3, rate: 200 }],
    });

    const rows = await (tdb.prisma as unknown as { salesInvoiceItem: { findMany: (a: unknown) => Promise<Array<Record<string, unknown>>> } })
      .salesInvoiceItem.findMany({
        where: { parent: si.name, parentfield: 'items' },
        orderBy: { idx: 'asc' },
      });

    expect(rows).toHaveLength(1);
    expect(rows[0].item_code).toBe(item);
    expect(Number(rows[0].qty)).toBe(3);
    expect(Number(rows[0].rate)).toBe(200);
    expect(Number(rows[0].amount)).toBe(600);
  });

  it('should set correct parent metadata on child rows', async () => {
    const customer = await createCustomer(tdb.prisma);
    const item = await createItem(tdb.prisma);

    const si = await createSalesInvoice(tdb.prisma, {
      customer,
      items: [{ item_code: item, qty: 1, rate: 100 }],
    });

    const rows = await (tdb.prisma as unknown as { salesInvoiceItem: { findMany: (a: unknown) => Promise<Array<Record<string, unknown>>> } })
      .salesInvoiceItem.findMany({
        where: { parent: si.name },
      });

    for (const row of rows) {
      expect(row.parent).toBe(si.name);
      expect(row.parenttype).toBe('Sales Invoice');
      expect(row.parentfield).toBe('items');
    }
  });
});
