"""
RecoverAI — tests for guardrails.py. Per SPEC §20: idempotency, retry
limit, confidence gate, risk flag, policy enforcement.

Run from project root:
    pytest tests/test_guardrails.py -v
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from guardrails import evaluate_guardrails, make_idempotency_key


def make_transaction(transaction_id="txn_test", amount=1000.0, attempt_count=1):
    return {"transaction_id": transaction_id, "amount": amount, "attempt_count": attempt_count}


def make_diagnosis(root_cause, confidence, action):
    return {"predicted_root_cause": root_cause, "confidence": confidence, "recommended_action": action}


# --- Idempotency ---

def test_idempotency_blocks_duplicate_action():
    """Same (transaction_id, action_type, attempt_number) cannot execute twice."""
    txn = make_transaction()
    diagnosis = make_diagnosis("gateway_timeout", 0.9, "retry")

    executed_keys = set()
    first = evaluate_guardrails(txn, diagnosis, executed_keys)
    assert first["final_action"] == "retry"
    executed_keys.add(first["idempotency_key"])

    second = evaluate_guardrails(txn, diagnosis, executed_keys)
    assert second["final_action"] == "escalate"
    assert "idempotency" in second["escalation_reason"].lower() or "duplicate" in second["escalation_reason"].lower()
    assert second["checks"]["idempotency_check"] is False


def test_idempotency_key_format():
    key = make_idempotency_key("txn_abc", "retry", 2)
    assert key == "txn_abc:retry:2"


def test_different_attempt_numbers_are_not_duplicates():
    """A legitimate second attempt (different attempt_number) is NOT blocked."""
    diagnosis = make_diagnosis("gateway_timeout", 0.9, "retry")
    executed_keys = set()

    txn1 = make_transaction(attempt_count=1)
    r1 = evaluate_guardrails(txn1, diagnosis, executed_keys)
    executed_keys.add(r1["idempotency_key"])

    txn2 = make_transaction(attempt_count=2)
    r2 = evaluate_guardrails(txn2, diagnosis, executed_keys)
    assert r2["final_action"] == "retry"  # not blocked — different attempt number


# --- Retry limit ---

def test_retry_limit_exceeded_stops():
    """gateway_timeout policy allows max_attempts=2 — attempt 3 must stop, not retry."""
    txn = make_transaction(attempt_count=3)
    diagnosis = make_diagnosis("gateway_timeout", 0.9, "retry")

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "stop"
    assert result["checks"]["retry_check"] is False


def test_retry_within_limit_proceeds():
    txn = make_transaction(attempt_count=2)
    diagnosis = make_diagnosis("gateway_timeout", 0.9, "retry")

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "retry"
    assert result["checks"]["retry_check"] is True


# --- Confidence gate ---

def test_low_confidence_escalates_regardless_of_action():
    """A diagnosis below the confidence threshold must escalate, even if the
    LLM/rule recommended a normal action."""
    txn = make_transaction()
    diagnosis = make_diagnosis("insufficient_funds", 0.4, "delayed_retry")

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "escalate"
    assert result["checks"]["confidence_check"] is False


def test_confidence_at_threshold_proceeds():
    """Confidence exactly at or above the policy's min_confidence should pass."""
    txn = make_transaction()
    diagnosis = make_diagnosis("gateway_timeout", 0.7, "retry")  # policy min_confidence=0.7

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "retry"
    assert result["checks"]["confidence_check"] is True


# --- Risk flag hard rule ---

def test_risk_flag_never_auto_acts_even_with_high_confidence():
    """risk_flag must ALWAYS escalate, regardless of how confident the diagnosis is."""
    txn = make_transaction()
    diagnosis = make_diagnosis("risk_flag", 0.99, "escalate")  # even if it "recommends" escalate

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "escalate"
    assert "risk" in result["escalation_reason"].lower() or "fraud" in result["escalation_reason"].lower()


def test_risk_flag_escalates_regardless_of_recommended_action():
    """Even if a diagnosis layer bug recommended something other than escalate
    for risk_flag, the guardrail must override it."""
    txn = make_transaction()
    diagnosis = make_diagnosis("risk_flag", 0.95, "retry")  # simulating a hypothetical bad recommendation

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "escalate"


# --- Policy enforcement ---

def test_unrecognized_root_cause_is_rejected():
    """A root cause with no defined policy must not silently proceed."""
    txn = make_transaction()
    diagnosis = make_diagnosis("totally_unknown_cause", 0.95, "retry")

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "escalate"
    assert result["checks"]["policy_check"] is False


def test_policy_action_overrides_diagnosis_recommendation():
    """The policy config, not the LLM/rule's suggestion, is the source of
    truth for which action actually executes."""
    txn = make_transaction()
    # insufficient_funds policy action is delayed_retry — diagnosis suggests something else
    diagnosis = make_diagnosis("insufficient_funds", 0.9, "retry")

    result = evaluate_guardrails(txn, diagnosis, set())
    assert result["final_action"] == "delayed_retry"  # policy wins, not the diagnosis's suggestion


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
