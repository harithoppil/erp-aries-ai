/**
 * Unit tests for depends_on expression evaluator.
 *
 * N3: The audit found that != operator is NOT supported.
 * These tests cover all Frappe depends_on expression patterns.
 */
import { describe, it, expect } from 'vitest';
import { evaluateDependsOn } from '@/lib/erpnext/depends-on';

describe('evaluateDependsOn', () => {
  const record = {
    status: 'Open',
    customer_type: 'Company',
    is_return: false,
    enabled: true,
    amount: 1000,
    empty_field: '',
    null_field: null,
  };

  // ── Plain fieldname (truthy check) ────────────────────────────────────────

  it('returns true for plain fieldname with truthy value', () => {
    expect(evaluateDependsOn('status', record)).toBe(true);
  });

  it('returns false for plain fieldname with falsy value', () => {
    expect(evaluateDependsOn('empty_field', record)).toBe(false);
  });

  it('returns false for plain fieldname with null value', () => {
    expect(evaluateDependsOn('null_field', record)).toBe(false);
  });

  it('returns false for fieldname that does not exist', () => {
    expect(evaluateDependsOn('nonexistent_field', record)).toBe(false);
  });

  // ── eval:doc.field == "value" ─────────────────────────────────────────────

  it('evaluates eval:doc.status=="Open" to true', () => {
    expect(evaluateDependsOn('eval:doc.status=="Open"', record)).toBe(true);
  });

  it('evaluates eval:doc.status=="Closed" to false', () => {
    expect(evaluateDependsOn('eval:doc.status=="Closed"', record)).toBe(false);
  });

  it('evaluates eval:doc.customer_type=="Company" to true', () => {
    expect(evaluateDependsOn('eval:doc.customer_type=="Company"', record)).toBe(true);
  });

  // ── eval:!doc.field (negated truthy) ──────────────────────────────────────

  it('evaluates eval:!doc.is_return to true (is_return is false)', () => {
    expect(evaluateDependsOn('eval:!doc.is_return', record)).toBe(true);
  });

  it('evaluates eval:!doc.enabled to false (enabled is true)', () => {
    expect(evaluateDependsOn('eval:!doc.enabled', record)).toBe(false);
  });

  // ── eval:doc.field (simple truthy in eval context) ────────────────────────

  it('evaluates eval:doc.enabled to true', () => {
    expect(evaluateDependsOn('eval:doc.enabled', record)).toBe(true);
  });

  it('evaluates eval:doc.is_return to false', () => {
    expect(evaluateDependsOn('eval:doc.is_return', record)).toBe(false);
  });

  // ── != operator (N3 fix) ──────────────────────────────────────────────────────

  it('evaluates eval:doc.status!="Closed" to true (status is Open)', () => {
    const result = evaluateDependsOn('eval:doc.status!="Closed"', record);
    expect(result).toBe(true);
  });

  it('evaluates eval:doc.status!="Open" to false (status IS Open)', () => {
    const result = evaluateDependsOn('eval:doc.status!="Open"', record);
    expect(result).toBe(false);
  });

  // ── null/empty expression ─────────────────────────────────────────────────

  it('returns true for null expression', () => {
    expect(evaluateDependsOn(null, record)).toBe(true);
  });

  it('returns true for empty string expression', () => {
    expect(evaluateDependsOn('', record)).toBe(true);
  });
});
