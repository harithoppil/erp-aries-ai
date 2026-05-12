/**
 * Test database helper — creates a Prisma client for integration tests
 * with cleanup after each test suite.
 *
 * Frappe uses frappe.db.rollback() per test. Prisma's interactive transactions
 * that never resolve don't work reliably with Bun, so instead we:
 * 1. Create records with a "TEST-" prefix
 * 2. Delete them in teardown
 *
 * For true transaction rollback, run tests against a disposable test database.
 */
import { PrismaClient } from '@/prisma/client';
import type { Prisma } from '@/prisma/client';

export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export class TestDb {
  /** Standard Prisma client — tests run against real DB, cleanup via teardown. */
  prisma: PrismaClient;
  private createdRecords: Array<{ accessor: string; name: string }> = [];

  constructor() {
    this.prisma = new PrismaClient();
  }

  async setup(): Promise<void> {
    await this.prisma.$connect();
  }

  async teardown(): Promise<void> {
    // Clean up all test-created records in reverse order
    for (let i = this.createdRecords.length - 1; i >= 0; i--) {
      const { accessor, name } = this.createdRecords[i];
      try {
        await (this.prisma as unknown as Record<string, { delete: (a: unknown) => Promise<unknown> }>)[accessor]?.delete({ where: { name } });
      } catch {
        // Already deleted or cascaded — ignore
      }
    }
    // Clean up test customers/items by prefix
    try {
      await (this.prisma as unknown as { salesInvoiceItem: { deleteMany: (a: unknown) => Promise<unknown> } })
        .salesInvoiceItem.deleteMany({ where: { parent: { startsWith: 'TEST-SINV' } } });
    } catch { /* ignore */ }
    try {
      await (this.prisma as unknown as { salesInvoice: { deleteMany: (a: unknown) => Promise<unknown> } })
        .salesInvoice.deleteMany({ where: { name: { startsWith: 'TEST-SINV' } } });
    } catch { /* ignore */ }
    try {
      await (this.prisma as unknown as { customer: { deleteMany: (a: unknown) => Promise<unknown> } })
        .customer.deleteMany({ where: { name: { startsWith: 'TEST-' } } });
    } catch { /* ignore */ }
    try {
      await (this.prisma as unknown as { item: { deleteMany: (a: unknown) => Promise<unknown> } })
        .item.deleteMany({ where: { name: { startsWith: 'TEST-' } } });
    } catch { /* ignore */ }

    await this.prisma.$disconnect();
  }

  /** Track a record for cleanup. */
  track(accessor: string, name: string): void {
    this.createdRecords.push({ accessor, name });
  }
}
