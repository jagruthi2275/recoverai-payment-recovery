"""
RecoverAI — tests for diagnosis_rules.py (Layer A).

Run from project root:
    pytest tests/test_diagnosis_rules.py -v
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from diagnosis_rules import diagnose_by_rule


def make_transaction(failure_code):
    return {"failure_code": failure_code}


def test_known_codes_resolve_correctly():
    expected = {
        "NSF": "insufficient_funds",
        "AUTH_FAILED": "authentication_failure",
        "CARD_EXPIRED": "card_invalid",
        "TIMEOUT": "gateway_timeout",
        "RISK_BLOCK": "risk_flag",
        "NETWORK_ERROR": "network_transient",
    }
    for code, expected_cause in expected.items():
        result = diagnose_by_rule(make_transaction(code))
        assert result is not None, f"Expected a rule result for code {code}"
        assert result["predicted_root_cause"] == expected_cause


def test_unknown_code_returns_none():
    """An ambiguous/unrecognized code must fall through to the LLM layer, not guess."""
    result = diagnose_by_rule(make_transaction("DECLINED"))
    assert result is None


def test_missing_code_returns_none():
    result = diagnose_by_rule(make_transaction(None))
    assert result is None


def test_rule_diagnosis_has_high_confidence():
    """Rule-based diagnoses should be high-confidence — they're deterministic lookups."""
    result = diagnose_by_rule(make_transaction("NSF"))
    assert result["confidence"] >= 0.85


def test_risk_block_always_recommends_escalate():
    """The rule layer itself should never recommend auto-acting on a risk flag."""
    result = diagnose_by_rule(make_transaction("RISK_BLOCK"))
    assert result["recommended_action"] == "escalate"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
