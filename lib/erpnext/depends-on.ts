// depends-on expression evaluator for Frappe-style conditional field visibility.
//
// Frappe supports several expression types for `depends_on`, `mandatory_depends_on`,
// and `read_only_depends_on`:
//
//   1. Plain fieldname:   "customer"           → visible when record.customer is truthy
//   2. eval:doc.field:    "eval:doc.is_active" → visible when record.is_active is truthy
//   3. eval:!doc.field:   "eval:!doc.is_frozen"→ visible when record.is_frozen is falsy
//   4. eval:doc.f=="val": "eval:doc.status==\"Open\"" → visible when record.status === "Open"

/**
 * Evaluate a Frappe `depends_on` / `mandatory_depends_on` / `read_only_depends_on`
 * expression against a record and return whether the condition is met.
 *
 * @param expression - The raw expression string from DocField metadata
 * @param record     - The current record data (field values)
 * @returns true if the field should be visible / mandatory / read-only
 */
export function evaluateDependsOn(
  expression: string | null | undefined,
  record: Record<string, unknown>,
): boolean {
  if (!expression || typeof expression !== 'string') return true;
  const trimmed = expression.trim();
  if (!trimmed) return true;

  // Case 1: eval: prefix — parse the expression
  if (trimmed.startsWith('eval:')) {
    const expr = trimmed.slice(5).trim();

    // Case 1a: eval:!doc.fieldname — negation (falsy check)
    const negationMatch = expr.match(/^!doc\.(\w+)$/);
    if (negationMatch) {
      const field = negationMatch[1];
      return !isTruthy(record[field]);
    }

    // Case 1b: eval:doc.fieldname=="value" — equality check
    const eqMatch = expr.match(/^doc\.(\w+)\s*==\s*["'](.+)["']$/);
    if (eqMatch) {
      const field = eqMatch[1];
      const expected = eqMatch[2];
      return String(record[field] ?? '') === expected;
    }

    // Case 1c: eval:doc.fieldname — truthy check
    const fieldMatch = expr.match(/^doc\.(\w+)$/);
    if (fieldMatch) {
      const field = fieldMatch[1];
      return isTruthy(record[field]);
    }

    // Unsupported eval expression — default to visible
    console.warn(`[depends-on] Unsupported eval expression: ${trimmed}`);
    return true;
  }

  // Case 2: Plain fieldname — truthy check
  // Must be a simple identifier (letters, digits, underscores)
  if (/^\w+$/.test(trimmed)) {
    return isTruthy(record[trimmed]);
  }

  // Fallback: unrecognised expression — keep field visible
  console.warn(`[depends-on] Unrecognised expression: ${trimmed}`);
  return true;
}

/**
 * Check if a value is truthy in the Frappe sense:
 * non-empty string, non-zero number, true boolean.
 */
function isTruthy(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

/**
 * Convert Frappe link_filters JSON to a Prisma-compatible where clause fragment.
 *
 * Input format (Frappe filter array):
 *   `[["Item","item_group","=","Services"]]`
 *
 * Returns an object like:
 *   `{ item_group: "Services" }`
 *
 * Only supports simple equality filters. Complex operators are ignored with a warning.
 */
export function linkFiltersToWhere(
  linkFilters: string | null | undefined,
): Record<string, unknown> | null {
  if (!linkFilters) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(linkFilters);
  } catch {
    console.warn(`[link-filters] Invalid JSON: ${linkFilters}`);
    return null;
  }

  if (!Array.isArray(parsed)) return null;

  const where: Record<string, unknown> = {};
  for (const filter of parsed as unknown[][]) {
    if (!Array.isArray(filter) || filter.length < 4) continue;
    const [, field, operator, value] = filter;
    if (typeof field !== 'string') continue;

    if (operator === '=' || operator === '==') {
      where[field] = value;
    } else {
      console.warn(`[link-filters] Unsupported operator "${operator}" for field "${field}"`);
    }
  }

  return Object.keys(where).length > 0 ? where : null;
}
