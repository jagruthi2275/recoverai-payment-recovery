"""Focused unit tests for RecoverAI Agent Architecture (Phase 1)."""

import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.database import get_connection, initialize_database
from src.agents import (
    DiagnosisAgent,
    PolicyAgent,
    RecoveryAgent,
    SafetyGate,
    RecoveryOrchestrator,
    ToolRegistry,
    default_tool_registry,
)


def sample_transaction(txn_id="txn_test_101", failure_code="NSF", amount=1000.0, attempt_count=1):
    return {
        "transaction_id": txn_id,
        "amount": amount,
        "currency": "INR",
        "payment_method": "card",
        "issuer": "HDFC Bank",
        "failure_code": failure_code,
        "gateway_response_ms": 250,
        "attempt_count": attempt_count,
        "customer_id_hash": "hash_xyz",
        "created_at": "2026-09-01T12:00:00",
        "status": "failed",
        "true_root_cause": "insufficient_funds",
        "is_issuer_outage_case": 0,
        "is_ambiguous": 0,
    }


def insert_transaction(conn, txn):
    cols = list(txn.keys())
    conn.execute(
        f"INSERT INTO transactions ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
        [txn[col] for col in cols],
    )
    conn.commit()


def test_tool_registry_execution():
    registry = default_tool_registry
    res = registry.execute("check_recovery_policy", root_cause="insufficient_funds", attempt_count=1, confidence=0.95)
    assert res.success is True
    assert res.data["permitted"] is True
    assert res.data["action"] == "delayed_retry"

    invalid_tool = registry.execute("non_existent_tool")
    assert invalid_tool.success is False
    assert "not found" in invalid_tool.error


def test_diagnosis_agent_rule_and_llm():
    agent = DiagnosisAgent()
    txn_rule = sample_transaction("txn_rule", failure_code="NSF")
    result_rule = agent.diagnose(txn_rule, set())
    assert result_rule.diagnosis_method == "rule_engine"
    assert result_rule.predicted_root_cause == "insufficient_funds"

    txn_llm = sample_transaction("txn_llm", failure_code="DECLINED")
    result_llm = agent.diagnose(txn_llm, set())
    assert result_llm.diagnosis_method == "llm_reasoning"


def test_policy_agent_evaluations():
    policy_agent = PolicyAgent()
    txn = sample_transaction("txn_pol", failure_code="NSF")

    # Allowed policy case
    diag_high = {"predicted_root_cause": "insufficient_funds", "confidence": 0.9, "recommended_action": "delayed_retry"}
    dec_high = policy_agent.evaluate_policy(txn, diag_high)
    assert dec_high.status == "PERMITTED"
    assert dec_high.policy_action == "delayed_retry"

    # Low confidence case -> human review required
    diag_low = {"predicted_root_cause": "insufficient_funds", "confidence": 0.4, "recommended_action": "delayed_retry"}
    dec_low = policy_agent.evaluate_policy(txn, diag_low)
    assert dec_low.status == "REQUIRES_HUMAN_REVIEW"
    assert dec_low.policy_action == "escalate"

    # Risk flag case -> always human review required
    diag_risk = {"predicted_root_cause": "risk_flag", "confidence": 0.99, "recommended_action": "escalate"}
    dec_risk = policy_agent.evaluate_policy(txn, diag_risk)
    assert dec_risk.status == "REQUIRES_HUMAN_REVIEW"
    assert dec_risk.policy_action == "escalate"

    # Max retries exceeded -> blocked / stop
    txn_exceeded = sample_transaction("txn_exc", failure_code="NSF", attempt_count=5)
    dec_exc = policy_agent.evaluate_policy(txn_exceeded, diag_high)
    assert dec_exc.status == "BLOCKED"
    assert dec_exc.policy_action == "stop"


def test_recovery_agent_proposal():
    rec_agent = RecoveryAgent()
    diag = {"predicted_root_cause": "insufficient_funds"}

    # Permitted policy
    pol_permitted = {"status": "PERMITTED", "policy_action": "delayed_retry"}
    prop1 = rec_agent.propose_action(diag, pol_permitted)
    assert prop1.proposed_action == "delayed_retry"

    # Human review policy
    pol_review = {"status": "REQUIRES_HUMAN_REVIEW", "policy_action": "escalate", "reason": "low confidence"}
    prop2 = rec_agent.propose_action(diag, pol_review)
    assert prop2.proposed_action == "escalate"


def test_safety_gate_validation():
    safety_gate = SafetyGate()
    txn = sample_transaction("txn_safe_1")
    diag = {"predicted_root_cause": "insufficient_funds", "confidence": 0.9}
    pol = {"status": "PERMITTED", "policy_action": "delayed_retry", "checks": {"policy_check": True, "confidence_check": True, "retry_check": True}}
    prop = {"proposed_action": "delayed_retry", "target_root_cause": "insufficient_funds"}

    dec = safety_gate.validate(txn, diag, pol, prop)
    assert dec.outcome == "EXECUTE"
    assert dec.final_action == "delayed_retry"
    assert dec.already_executed is False


def test_orchestrator_full_workflow(tmp_path):
    db_path = str(tmp_path / "test_recoverai.db")
    initialize_database(db_path)
    conn = get_connection(db_path)

    txn = sample_transaction("txn_orch_1", failure_code="NSF", amount=1500.0)
    insert_transaction(conn, txn)

    orchestrator = RecoveryOrchestrator()
    res = orchestrator.process_transaction(conn, txn, set())

    assert res["status"] == "success"
    assert res["transaction_id"] == "txn_orch_1"
    assert res["final_action"] == "delayed_retry"
    assert res["outcome"] in ("recovered", "failed")

    # Verify database persistence
    diag_count = conn.execute("SELECT COUNT(*) FROM diagnoses WHERE transaction_id = 'txn_orch_1'").fetchone()[0]
    action_count = conn.execute("SELECT COUNT(*) FROM recovery_actions WHERE transaction_id = 'txn_orch_1'").fetchone()[0]
    audit_count = conn.execute("SELECT COUNT(*) FROM audit_log WHERE transaction_id = 'txn_orch_1'").fetchone()[0]

    assert diag_count == 1
    assert action_count == 1
    assert audit_count >= 1

    # Verify idempotency on second run
    duplicate_res = orchestrator.process_transaction(conn, txn, set())
    assert duplicate_res["status"] == "duplicate"
    assert duplicate_res["already_executed"] is True

    conn.close()


def test_orchestrator_escalation_workflow(tmp_path):
    db_path = str(tmp_path / "test_recoverai_esc.db")
    initialize_database(db_path)
    conn = get_connection(db_path)

    txn = sample_transaction("txn_risk_1", failure_code="RISK_BLOCK", amount=5000.0)
    insert_transaction(conn, txn)

    orchestrator = RecoveryOrchestrator()
    res = orchestrator.process_transaction(conn, txn, set())

    assert res["status"] == "success"
    assert res["final_action"] == "escalate"
    assert res["outcome"] == "escalated"

    esc_count = conn.execute("SELECT COUNT(*) FROM escalation_queue WHERE transaction_id = 'txn_risk_1'").fetchone()[0]
    assert esc_count == 1

    conn.close()
