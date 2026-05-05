"""Tests for Rules Engine."""
import pytest

from backend.app.services.rules import apply_rules, RulesOutput, MARGIN_RULES, APPROVAL_RULES


class TestMarginCalculations:
    """Test margin rule calculations."""

    def test_margin_default(self):
        """Default margin is 15%."""
        rules = apply_rules()
        assert rules.min_margin_pct == MARGIN_RULES["default_min_margin"]

    def test_margin_high_value(self):
        """High value enquiries (>= 500k) use 20% margin."""
        rules = apply_rules(estimated_value=600_000)
        assert rules.min_margin_pct == MARGIN_RULES["high_value_min_margin"]

    def test_margin_below_threshold(self):
        """Value below high-value threshold keeps default margin."""
        rules = apply_rules(estimated_value=400_000)
        assert rules.min_margin_pct == MARGIN_RULES["default_min_margin"]

    def test_margin_with_profit(self):
        """Margin above minimum — no violation."""
        rules = apply_rules(estimated_value=100_000, estimated_cost=50_000)
        # margin = (100k - 50k) / 100k = 50%, above 15%
        assert len(rules.policy_violations) == 0

    def test_margin_violation(self):
        """Margin below minimum — violation reported."""
        rules = apply_rules(estimated_value=100_000, estimated_cost=95_000)
        # margin = 5%, below 15%
        assert len(rules.policy_violations) == 1
        assert "below minimum" in rules.policy_violations[0]

    def test_margin_exactly_at_min(self):
        """Margin exactly at minimum — no violation."""
        rules = apply_rules(estimated_value=100_000, estimated_cost=85_000)
        # margin = 15%, exactly at minimum
        assert len(rules.policy_violations) == 0


class TestApprovalThresholds:
    """Test approval threshold rules."""

    def test_two_person_approval_high_value(self):
        """Values >= 200k require two-person approval."""
        rules = apply_rules(estimated_value=250_000)
        assert rules.requires_two_person_approval is True

    def test_no_two_person_approval_low_value(self):
        """Values below 200k don't require two-person approval."""
        rules = apply_rules(estimated_value=100_000)
        assert rules.requires_two_person_approval is False

    def test_none_values(self):
        """None values should not crash."""
        rules = apply_rules(estimated_value=None, estimated_cost=None)
        assert rules.min_margin_pct == MARGIN_RULES["default_min_margin"]
        assert rules.requires_two_person_approval is False

    def test_auto_approve_threshold(self):
        """Values below 50k don't require two-person approval."""
        rules = apply_rules(estimated_value=40_000)
        assert rules.requires_two_person_approval is False


class TestTemplateSelection:
    """Test proposal template selection."""

    def test_template_standard(self):
        """Default template for no industry."""
        rules = apply_rules()
        assert rules.suggested_template == "standard_proposal"

    def test_template_government(self):
        """Government industry uses government template."""
        rules = apply_rules(industry="government")
        assert rules.suggested_template == "government_proposal"

    def test_template_public_sector(self):
        """Public sector uses government template."""
        rules = apply_rules(industry="public sector")
        assert rules.suggested_template == "government_proposal"

    def test_template_enterprise(self):
        """High value uses enterprise template."""
        rules = apply_rules(estimated_value=250_000)
        assert rules.suggested_template == "enterprise_proposal"

    def test_template_case_insensitive(self):
        """Industry matching is case-insensitive."""
        rules = apply_rules(industry="GOVERNMENT")
        assert rules.suggested_template == "government_proposal"

    def test_government_overrides_enterprise(self):
        """Government industry takes precedence over high value."""
        rules = apply_rules(industry="government", estimated_value=250_000)
        assert rules.suggested_template == "government_proposal"


class TestRulesOutputStructure:
    """Test the RulesOutput dataclass structure."""

    def test_default_output(self):
        output = RulesOutput()
        assert output.min_margin_pct == 15.0
        assert output.max_discount_pct == 10.0
        assert output.approval_threshold_value == 100_000.0
        assert output.tax_rate == 0.0
        assert output.suggested_template == "standard_proposal"
        assert output.requires_two_person_approval is False
        assert output.policy_violations == []
        assert output.pricing_adjustments == {}

    def test_custom_output(self):
        output = RulesOutput(min_margin_pct=25.0, requires_two_person_approval=True)
        assert output.min_margin_pct == 25.0
        assert output.requires_two_person_approval is True
