"""Rules Engine (Node 11) — deterministic business logic.

Runs BEFORE the LLM (Node 12). Pricing, margins, tax, approval thresholds,
and policy are never decided by the LLM alone.
"""

from dataclasses import dataclass, field


@dataclass
class RulesOutput:
    """Output from the rules engine for a given enquiry."""
    min_margin_pct: float = 15.0
    max_discount_pct: float = 10.0
    approval_threshold_value: float = 100_000.0
    tax_rate: float = 0.0
    suggested_template: str = "standard_proposal"
    requires_two_person_approval: bool = False
    policy_violations: list[str] = field(default_factory=list)
    pricing_adjustments: dict = field(default_factory=dict)


# --- Configurable rules (load from DB/config in production) ---

MARGIN_RULES = {
    "default_min_margin": 15.0,
    "high_value_min_margin": 20.0,  # enquiries > 500k
    "high_value_threshold": 500_000.0,
}

APPROVAL_RULES = {
    "auto_approve_below": 50_000.0,
    "single_approval_below": 200_000.0,
    "two_person_above": 200_000.0,
}

TAX_RULES = {
    "default_rate": 0.0,  # VAT/GST varies by region; placeholder
}

TEMPLATE_RULES = {
    "default": "standard_proposal",
    "government": "government_proposal",
    "enterprise": "enterprise_proposal",
}


def apply_rules(
    estimated_value: float | None = None,
    estimated_cost: float | None = None,
    industry: str | None = None,
    subdivision: str | None = None,
) -> RulesOutput:
    """Apply deterministic rules to an enquiry. Returns structured output."""
    output = RulesOutput()

    # Margin rules
    if estimated_value and estimated_value and estimated_value > 0:
        value = estimated_value
        if value >= MARGIN_RULES["high_value_threshold"]:
            output.min_margin_pct = MARGIN_RULES["high_value_min_margin"]

        if estimated_cost:
            actual_margin_pct = ((value - estimated_cost) / value) * 100
            if actual_margin_pct < output.min_margin_pct:
                output.policy_violations.append(
                    f"Margin {actual_margin_pct:.1f}% below minimum {output.min_margin_pct}%"
                )

    # Approval rules
    if estimated_value:
        if estimated_value >= APPROVAL_RULES["two_person_above"]:
            output.requires_two_person_approval = True
            output.approval_threshold_value = APPROVAL_RULES["two_person_above"]

    # Template rules
    if industry and industry.lower() in ("government", "public sector"):
        output.suggested_template = TEMPLATE_RULES["government"]
    elif estimated_value and estimated_value >= 200_000:
        output.suggested_template = TEMPLATE_RULES["enterprise"]

    return output
