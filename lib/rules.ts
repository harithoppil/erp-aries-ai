/**
 * Rules Engine — deterministic business logic ported from Python.
 *
 * Runs BEFORE any LLM call. Pricing, margins, tax, approval thresholds,
 * and policy are never decided by the LLM alone.
 *
 * Ported from: backend/app/services/rules.py
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RulesOutput {
  min_margin_pct: number;
  max_discount_pct: number;
  approval_threshold_value: number;
  tax_rate: number;
  suggested_template: string;
  requires_two_person_approval: boolean;
  policy_violations: string[];
  pricing_adjustments: Record<string, number>;
}

// ── Configurable rules (load from DB/config in production) ────────────────

export const MARGIN_RULES = {
  default_min_margin: 15.0,
  high_value_min_margin: 20.0,       // enquiries > 500k
  high_value_threshold: 500_000.0,
} as const;

export const APPROVAL_RULES = {
  auto_approve_below: 50_000.0,
  single_approval_below: 200_000.0,
  two_person_above: 200_000.0,
} as const;

export const TAX_RULES = {
  default_rate: 0.0,                  // VAT/GST varies by region; placeholder
} as const;

export const TEMPLATE_RULES = {
  default: "standard_proposal",
  government: "government_proposal",
  enterprise: "enterprise_proposal",
} as const;

// ── Core functions ─────────────────────────────────────────────────────────

/**
 * Apply deterministic rules to an enquiry. Returns structured output.
 * Pure math — no API calls, no side effects.
 */
export function applyRules(params: {
  estimated_value?: number;
  estimated_cost?: number;
  industry?: string;
  subdivision?: string;
}): RulesOutput {
  const {
    estimated_value,
    estimated_cost,
    industry,
  } = params;

  const output: RulesOutput = {
    min_margin_pct: MARGIN_RULES.default_min_margin,
    max_discount_pct: 10.0,
    approval_threshold_value: APPROVAL_RULES.single_approval_below,
    tax_rate: TAX_RULES.default_rate,
    suggested_template: TEMPLATE_RULES.default,
    requires_two_person_approval: false,
    policy_violations: [],
    pricing_adjustments: {},
  };

  // Margin rules
  if (estimated_value && estimated_value > 0) {
    const value = estimated_value;
    if (value >= MARGIN_RULES.high_value_threshold) {
      output.min_margin_pct = MARGIN_RULES.high_value_min_margin;
    }

    if (estimated_cost) {
      const actualMarginPct = ((value - estimated_cost) / value) * 100;
      if (actualMarginPct < output.min_margin_pct) {
        output.policy_violations.push(
          `Margin ${actualMarginPct.toFixed(1)}% below minimum ${output.min_margin_pct}%`
        );
      }
    }
  }

  // Approval rules
  if (estimated_value) {
    if (estimated_value >= APPROVAL_RULES.two_person_above) {
      output.requires_two_person_approval = true;
      output.approval_threshold_value = APPROVAL_RULES.two_person_above;
    }
  }

  // Template rules
  if (industry && industry.toLowerCase() === "government" || industry?.toLowerCase() === "public sector") {
    output.suggested_template = TEMPLATE_RULES.government;
  } else if (estimated_value && estimated_value >= 200_000) {
    output.suggested_template = TEMPLATE_RULES.enterprise;
  }

  return output;
}

// ── Convenience helpers ───────────────────────────────────────────────────

/** Check if a quotation's margin passes the minimum threshold. */
export function checkMargin(
  items: { rate: number; cost?: number }[],
  minMarginPct: number = MARGIN_RULES.default_min_margin,
): { pass: boolean; margin: number } {
  const totalRate = items.reduce((s, i) => s + i.rate, 0);
  const totalCost = items.reduce((s, i) => s + (i.cost || 0), 0);
  if (totalRate === 0) return { pass: false, margin: 0 };
  const margin = ((totalRate - totalCost) / totalRate) * 100;
  return { pass: margin >= minMarginPct, margin };
}

/** Route approval based on amount thresholds. */
export function routeApproval(
  amount: number,
  threshold: number = APPROVAL_RULES.single_approval_below,
): 'auto' | 'manual' | 'two_person' {
  if (amount < APPROVAL_RULES.auto_approve_below) return 'auto';
  if (amount < threshold) return 'manual';
  return 'two_person';
}

/** Calculate tax on a subtotal. */
export function calculateTax(
  subtotal: number,
  taxRate: number = TAX_RULES.default_rate,
): { tax: number; total: number } {
  const tax = subtotal * taxRate / 100;
  return { tax: Math.round(tax * 100) / 100, total: Math.round((subtotal + tax) * 100) / 100 };
}

/** Check customer credit limit. */
export function checkCreditLimit(
  outstanding: number,
  limit: number,
): { withinLimit: boolean; available: number } {
  const available = limit - outstanding;
  return { withinLimit: outstanding <= limit, available: Math.max(0, available) };
}
