/**
 * Safe expression evaluator for form scripts and depends_on logic.
 *
 * Supports:
 * - Simple field references: doc.status === "Open"
 * - Comparison operators: ===, !==, >, <, >=, <=
 * - Logical operators: &&, ||
 * - String/number literals
 * - eval_depends_on_value() for backward compat with simple expressions like "status=Open"
 * - eval_safe_expression() for arbitrary safe expressions
 */

// ── Simple depends_on evaluator (ERPNext-compatible) ─────────────────────────

/**
 * Evaluate a simple depends_on expression.
 * Supports: "field=value", "field!=value", "field>value", "field<value",
 * "field", "!field", "field1=value1&&field2=value2", "field1=value1||field2=value2"
 */
export function eval_depends_on_value(
  expression: string,
  doc: Record<string, unknown>,
): boolean {
  if (!expression || !expression.trim()) return true;

  // Handle && (AND) — all must be true
  if (expression.includes('&&')) {
    return expression.split('&&').every((part) => eval_depends_on_value(part.trim(), doc));
  }

  // Handle || (OR) — at least one must be true
  if (expression.includes('||')) {
    return expression.split('||').some((part) => eval_depends_on_value(part.trim(), doc));
  }

  const trimmed = expression.trim();

  // Negation: "!field" or "not field"
  if (trimmed.startsWith('!') || trimmed.startsWith('not ')) {
    const field = trimmed.replace(/^(not |!)/, '').trim();
    const val = doc[field];
    return !val || val === 0 || val === '' || val === false;
  }

  // Comparison operators
  const compMatch = trimmed.match(/^(\w+)\s*(!=|>=|<=|>|<|=)\s*(.+)$/);
  if (compMatch) {
    const [, field, op, rawValue] = compMatch;
    const docVal = doc[field];
    const compareVal = rawValue.trim().replace(/^["']|["']$/g, '');

    // Type coercion for numeric comparisons
    const numDocVal = Number(docVal);
    const numCompareVal = Number(compareVal);
    const bothNumeric = !isNaN(numDocVal) && !isNaN(numCompareVal);

    const left = bothNumeric ? numDocVal : String(docVal ?? '');
    const right = bothNumeric ? numCompareVal : compareVal;

    switch (op) {
      case '=': return left === right;
      case '!=': return left !== right;
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
    }
  }

  // Simple field reference: truthy check
  const val = doc[trimmed];
  return !!val && val !== 0 && val !== '' && val !== false;
}

// ── Safe expression evaluator ────────────────────────────────────────────────

/** Allowed tokens in safe expressions */
type Token =
  | { type: 'literal'; value: string | number | boolean | null }
  | { type: 'identifier'; value: string }
  | { type: 'operator'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'eof'; value?: undefined };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    // Skip whitespace
    if (/\s/.test(expr[i])) { i++; continue; }

    // String literals
    if (expr[i] === '"' || expr[i] === "'") {
      const quote = expr[i];
      let str = '';
      i++;
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === '\\' && i + 1 < expr.length) { str += expr[i + 1]; i += 2; }
        else { str += expr[i]; i++; }
      }
      i++; // skip closing quote
      tokens.push({ type: 'literal', value: str });
      continue;
    }

    // Numbers
    if (/[0-9]/.test(expr[i]) || (expr[i] === '-' && i + 1 < expr.length && /[0-9]/.test(expr[i + 1]))) {
      let num = '';
      if (expr[i] === '-') { num += '-'; i++; }
      while (i < expr.length && /[0-9.]/.test(expr[i])) { num += expr[i]; i++; }
      tokens.push({ type: 'literal', value: parseFloat(num) });
      continue;
    }

    // Boolean/null
    if (expr.slice(i, i + 4) === 'true') { tokens.push({ type: 'literal', value: true }); i += 4; continue; }
    if (expr.slice(i, i + 5) === 'false') { tokens.push({ type: 'literal', value: false }); i += 5; continue; }
    if (expr.slice(i, i + 4) === 'null') { tokens.push({ type: 'literal', value: null }); i += 4; continue; }

    // Multi-char operators
    if (expr.slice(i, i + 3) === '===' || expr.slice(i, i + 3) === '!==' ) { tokens.push({ type: 'operator', value: expr.slice(i, i + 3) }); i += 3; continue; }
    if (expr.slice(i, i + 2) === '&&' || expr.slice(i, i + 2) === '||' || expr.slice(i, i + 2) === '>=' || expr.slice(i, i + 2) === '<=') { tokens.push({ type: 'operator', value: expr.slice(i, i + 2) }); i += 2; continue; }

    // Single-char operators
    if ('=!><'.includes(expr[i])) { tokens.push({ type: 'operator', value: expr[i] }); i++; continue; }

    // Parentheses
    if (expr[i] === '(' || expr[i] === ')') { tokens.push({ type: 'paren', value: expr[i] as '(' | ')' }); i++; continue; }

    // Identifiers (field names)
    if (/[a-zA-Z_]/.test(expr[i])) {
      let ident = '';
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) { ident += expr[i]; i++; }
      tokens.push({ type: 'identifier', value: ident });
      continue;
    }

    // Unknown character — skip
    i++;
  }

  tokens.push({ type: 'eof' });
  return tokens;
}

/** Evaluate a safe expression against a doc object. No access to globals, no function calls. */
export function eval_safe_expression(
  expression: string,
  doc: Record<string, unknown>,
): unknown {
  const tokens = tokenize(expression);
  let pos = 0;

  function peek(): Token { return tokens[pos] ?? { type: 'eof' }; }
  function advance(): Token { return tokens[pos++]; }

  function parsePrimary(): unknown {
    const token = peek();

    if (token.type === 'literal') { advance(); return token.value; }

    if (token.type === 'identifier') {
      advance();
      // Map doc.field_name to doc[field_name]
      return doc[token.value] ?? null;
    }

    if (token.type === 'paren' && token.value === '(') {
      advance(); // skip (
      const val = parseOr();
      if (peek().type === 'paren') advance(); // skip )
      return val;
    }

    // Negation
    if (token.type === 'operator' && token.value === '!') {
      advance();
      return !parsePrimary();
    }

    return null;
  }

  function parseComparison(): unknown {
    let left = parsePrimary();

    while (peek().type === 'operator' && ['===', '!==', '==', '!=', '>', '<', '>=', '<='].includes(peek().value)) {
      const op = advance().value;
      const right = parsePrimary();

      switch (op) {
        case '===': case '==': left = left === right; break;
        case '!==': case '!=': left = left !== right; break;
        case '>': left = (left as number) > (right as number); break;
        case '<': left = (left as number) < (right as number); break;
        case '>=': left = (left as number) >= (right as number); break;
        case '<=': left = (left as number) <= (right as number); break;
      }
    }

    return left;
  }

  function parseAnd(): unknown {
    let left = parseComparison();
    while (peek().type === 'operator' && peek().value === '&&') {
      advance();
      const right = parseComparison();
      left = left && right;
    }
    return left;
  }

  function parseOr(): unknown {
    let left = parseAnd();
    while (peek().type === 'operator' && peek().value === '||') {
      advance();
      const right = parseAnd();
      left = left || right;
    }
    return left;
  }

  try {
    return parseOr();
  } catch {
    return null;
  }
}

// ── Re-export backward-compatible API ────────────────────────────────────────

/** Backward-compatible depends_on evaluator (used by ERPTabLayout, etc.) */
export function evaluateDependsOn(
  expression: string | null | undefined,
  record: Record<string, unknown>,
): boolean {
  if (!expression || typeof expression !== 'string') return true;
  const trimmed = expression.trim();
  if (!trimmed) return true;

  // Handle eval: prefix
  if (trimmed.startsWith('eval:')) {
    const expr = trimmed.slice(5).trim();
    // Use the safe expression evaluator for eval: expressions
    // Replace doc.field references with just field references
    const normalized = expr.replace(/doc\./g, '');
    const result = eval_safe_expression(normalized, record);
    return Boolean(result);
  }

  // Handle simple expressions
  return eval_depends_on_value(trimmed, record);
}

// ── Link filters converter ──────────────────────────────────────────────────

/**
 * Convert Frappe link_filters JSON to a Prisma-compatible where clause fragment.
 */
export function linkFiltersToWhere(
  linkFilters: string | null | undefined,
): Record<string, unknown> | null {
  if (!linkFilters) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(linkFilters);
  } catch {
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
    }
  }

  return Object.keys(where).length > 0 ? where : null;
}

// ── fetch_from evaluator ─────────────────────────────────────────────────────

/**
 * Evaluate a fetch_from expression like "source_doctype.field_name".
 * Returns the value of the linked field from the source document.
 */
export function eval_fetch_from(
  fetchFrom: string,
  doc: Record<string, unknown>,
): unknown {
  if (!fetchFrom || !fetchFrom.includes('.')) return null;

  const [sourceField, targetField] = fetchFrom.split('.');
  const sourceValue = doc[sourceField];

  // If the source field is an object (populated link), access the target field
  if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
    return (sourceValue as Record<string, unknown>)[targetField] ?? null;
  }

  return null;
}