"""Focused tests for API-facing core safeguards; no network calls required."""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.database import get_connection, initialize_database
from src.diagnosis_llm import diagnose_by_llm, validate_llm_result
from src.guardrails import evaluate_guardrails
from src.metrics import get_dashboard_metrics
from src.run_pipeline import process_batch
from src.transaction_views import public_transaction


def transaction(transaction_id="txn_foundation"):
    return {
        "transaction_id": transaction_id, "amount": 500.0, "currency": "INR",
        "payment_method": "card", "issuer": "HDFC Bank", "failure_code": "NSF",
        "gateway_response_ms": 200, "attempt_count": 1, "customer_id_hash": "hash",
        "created_at": "2026-08-01T10:00:00", "status": "failed",
        "true_root_cause": "insufficient_funds", "is_issuer_outage_case": 0, "is_ambiguous": 0,
    }


def insert_transaction(conn, value):
    cols = list(value)
    conn.execute(
        f"INSERT INTO transactions ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
        [value[column] for column in cols],
    )
    conn.commit()


def test_database_idempotency_uses_final_policy_action(tmp_path):
    db_path = str(tmp_path / "recoverai.db")
    initialize_database(db_path)
    conn = get_connection(db_path)
    value = transaction()
    insert_transaction(conn, value)
    diagnosis = {"predicted_root_cause": "insufficient_funds", "confidence": 0.9,
                 "recommended_action": "retry"}
    first = evaluate_guardrails(value, diagnosis, conn=conn)
    assert first["final_action"] == "delayed_retry"
    assert first["idempotency_key"] == "txn_foundation:delayed_retry:1"
    diagnosis_id = conn.execute("""
        INSERT INTO diagnoses (transaction_id, diagnosis_method, predicted_root_cause, confidence,
          reasoning, recommended_action, diagnosed_at) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (value["transaction_id"], "rule_engine", "insufficient_funds", .9,
          "test", "retry", value["created_at"])).lastrowid
    conn.execute("""
        INSERT INTO recovery_actions (transaction_id, diagnosis_id, action_type, attempt_number,
          idempotency_key, policy_checks_passed, executed_at, outcome, recovered_amount)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (value["transaction_id"], diagnosis_id, "delayed_retry", 1, first["idempotency_key"],
          "{}", value["created_at"], "recovered", 500.0))
    conn.commit()
    duplicate = evaluate_guardrails(value, diagnosis, conn=conn)
    assert duplicate["already_executed"] is True
    assert duplicate["existing_action"]["action_type"] == "delayed_retry"
    conn.close()


def test_process_batch_skips_existing_database_action(tmp_path):
    db_path = str(tmp_path / "recoverai.db")
    initialize_database(db_path)
    conn = get_connection(db_path)
    value = transaction("txn_batch")
    insert_transaction(conn, value)
    first = process_batch(conn, [value])
    second = process_batch(conn, [value])
    assert first["processed_transactions"] == 1
    assert second["processed_transactions"] == 0
    assert second["duplicate_actions"] == 1
    assert conn.execute("SELECT COUNT(*) FROM recovery_actions").fetchone()[0] == 1
    assert conn.execute("SELECT COUNT(*) FROM diagnoses").fetchone()[0] == 1
    conn.close()


def test_llm_validation_fails_closed_for_malformed_output():
    invalid = validate_llm_result({"root_cause": "unsafe", "confidence": 2,
                                   "reasoning": "", "recommended_action": "charge"})
    assert invalid["confidence"] == 0.0
    assert invalid["recommended_action"] == "escalate"

    class BadClient:
        def diagnose(self, *_):
            return {"root_cause": "gateway_timeout", "confidence": "high",
                    "reasoning": "bad confidence", "recommended_action": "retry"}

    result = diagnose_by_llm(transaction(), False, BadClient())
    assert result["confidence"] == 0.0
    assert result["recommended_action"] == "escalate"


def test_safe_initialization_preserves_existing_rows_and_metrics_hide_truth(tmp_path):
    db_path = str(tmp_path / "recoverai.db")
    initialize_database(db_path)
    conn = get_connection(db_path)
    value = transaction("txn_safe")
    insert_transaction(conn, value)
    initialize_database(db_path)
    assert conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0] == 1
    metrics = get_dashboard_metrics(conn)
    assert metrics["total_transactions"] == 1
    assert "true_root_cause" not in str(metrics)
    serialized = public_transaction(value)
    assert "true_root_cause" not in serialized
    assert "customer_id_hash" not in serialized
    conn.close()
