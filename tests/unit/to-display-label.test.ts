/**
 * Unit tests for toDisplayLabel — kebab-case slug to Title Case DocType name.
 *
 * C6 was a false positive but these tests ensure it stays correct.
 */
import { describe, it, expect } from 'vitest';
import { toDisplayLabel, toAccessor } from '@/lib/erpnext/prisma-delegate';

describe('toDisplayLabel', () => {
  it('converts kebab-case to Title Case', () => {
    expect(toDisplayLabel('sales-invoice')).toBe('Sales Invoice');
    expect(toDisplayLabel('purchase-order')).toBe('Purchase Order');
  });

  it('handles single words', () => {
    expect(toDisplayLabel('customer')).toBe('Customer');
    expect(toDisplayLabel('item')).toBe('Item');
  });

  it('handles acronyms (POS → uppercase)', () => {
    expect(toDisplayLabel('pos-profile')).toBe('POS Profile');
  });

  it('handles multi-word doctypes', () => {
    expect(toDisplayLabel('material-request')).toBe('Material Request');
    expect(toDisplayLabel('request-for-quotation')).toBe('Request For Quotation');
    expect(toDisplayLabel('journal-entry')).toBe('Journal Entry');
  });

  it('handles snake_case', () => {
    expect(toDisplayLabel('sales_invoice')).toBe('Sales Invoice');
  });

  it('handles already-Title Case input', () => {
    expect(toDisplayLabel('Customer')).toBe('Customer');
  });
});

describe('toAccessor', () => {
  it('converts kebab-case to camelCase accessor', () => {
    expect(toAccessor('sales-invoice')).toBe('salesInvoice');
    expect(toAccessor('purchase-order')).toBe('purchaseOrder');
  });

  it('handles single words', () => {
    expect(toAccessor('customer')).toBe('customer');
    expect(toAccessor('item')).toBe('item');
  });

  it('handles PascalCase input', () => {
    expect(toAccessor('SalesInvoice')).toBe('salesInvoice');
  });
});
