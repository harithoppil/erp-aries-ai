/**
 * C1 + H7 TEST: Naming Series — sequential naming, no duplicates, prefix parsing.
 *
 * Tests that generateDocName produces sequential names and that
 * the .YYYY. prefix is correctly substituted.
 */
import { describe, it, expect } from 'vitest';
import { generateDocName, parsePrefix, getDefaultSeriesMappings } from '@/lib/erpnext/naming-series';

describe('Naming Series — unit tests', () => {
  it('should parse prefix with .YYYY.', () => {
    const result = parsePrefix('SINV-.YYYY.-');
    expect(result.base).toBe('SINV--');
    expect(result.hasYear).toBe(true);
  });

  it('should parse prefix without year', () => {
    const result = parsePrefix('SO-');
    expect(result.base).toBe('SO-');
    expect(result.hasYear).toBe(false);
  });

  it('should have default series for core transaction doctypes', () => {
    const mappings = getDefaultSeriesMappings();
    expect(mappings['Sales Invoice']).toBeDefined();
    expect(mappings['Purchase Invoice']).toBeDefined();
    expect(mappings['Sales Order']).toBeDefined();
    expect(mappings['Journal Entry']).toBeDefined();
    expect(mappings['Payment Entry']).toBeDefined();
  });
});

describe('Naming Series — integration (generates names)', () => {
  it('should generate sequential names for Sales Invoice', async () => {
    const name1 = await generateDocName('Sales Invoice', '_Test Company');
    const name2 = await generateDocName('Sales Invoice', '_Test Company');

    // Both should contain SINV prefix
    expect(name1).toContain('SINV');
    expect(name2).toContain('SINV');

    // Names should be different (sequential)
    expect(name1).not.toBe(name2);
  });

  it('should generate different names for different doctypes', async () => {
    const si = await generateDocName('Sales Invoice', '_Test Company');
    const pi = await generateDocName('Purchase Invoice', '_Test Company');

    expect(si).toContain('SINV');
    expect(pi).toContain('PINV');
    expect(si).not.toBe(pi);
  });

  it('should include year in name when prefix has .YYYY.', async () => {
    const name = await generateDocName('Sales Invoice', '_Test Company');
    const currentYear = String(new Date().getFullYear());
    expect(name).toContain(currentYear);
  });

  it('should respect custom prefix when passed', async () => {
    const name = await generateDocName('Sales Invoice', '_Test Company', 'SINV-RET-.YYYY.-');
    expect(name).toContain('SINV-RET');
  });

  it('should generate 5-digit padded counter', async () => {
    const name = await generateDocName('Sales Invoice', '_Test Company');
    // Name should end with -NNNNN (5-digit padded counter)
    const match = name.match(/(\d{5})$/);
    expect(match).not.toBeNull();
  });
});
