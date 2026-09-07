"""Focused read-only API tests; they seed a temporary SQLite database only."""

import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.api import create_app
from src.database import get_connection, initialize_database


def build_client(tmp_path, processed=False):
    db_path = str(tmp_path / "recoverai.db")
    initialize_database(db_path)
    conn = get_connection(db_path)
    transaction = {
        "transaction_id": "txn_api", "amount": 1000.0, "currency": "INR",
        "payment_method": "card", "issuer": "HDFC Bank", "failure_code": "NSF",
        "gateway_response_ms": 150, "attempt_count": 1, "customer_id_hash": "private-hash",
        "created_at": "2026-08-01T10:00:00", "status": "failed",
        "true_root_cause": "insufficient_funds", "is_issuer_outage_case": 0, "is_ambiguous": 0,
    }
    columns = list(transaction)
    conn.execute(f"INSERT INTO transactions ({', '.join(columns)}) VALUES ({', '.join('?' for _ in columns)})",
                 [transaction[column] for column in columns])
    if processed:
        diagnosis_id = conn.execute("""
            INSERT INTO diagnoses (transaction_id, diagnosis_method, predicted_root_cause, confidence,
                reasoning, recommended_action, diagnosed_at) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, ("txn_api", "rule_engine", "insufficient_funds", .97, "NSF rule", "delayed_retry",
              "2026-08-01T10:01:00")).lastrowid
        conn.execute("""
            INSERT INTO recovery_actions (transaction_id, diagnosis_id, action_type, attempt_number,
                idempotency_key, policy_checks_passed, executed_at, outcome, recovered_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, ("txn_api", diagnosis_id, "delayed_retry", 1, "txn_api:delayed_retry:1",
              '{"confidence_check": true}', "2026-08-01T10:02:00", "recovered", 1000.0))
        conn.execute("""
            INSERT INTO audit_log (transaction_id, timestamp, event_type, from_state, to_state, detail)
            VALUES (?, ?, ?, ?, ?, ?)
        """, ("txn_api", "2026-08-01T10:02:00", "state_transition", "DETECTED", "RECOVERED", "{}"))
    conn.commit()
    conn.close()
    return TestClient(create_app(db_path))


def test_api_empty_operational_tables_return_valid_json(tmp_path):
    client = build_client(tmp_path)
    assert client.get("/api/metrics").json()["total_transactions"] == 1
    assert client.get("/api/metrics/ai-operations").json()["total_diagnoses"] == 0
    assert client.get("/api/metrics/idempotency").json()["batch_is_clean"] is True
    assert client.get("/api/recovery-by-cause").json() == {"items": []}
    assert client.get("/api/escalations").json()["items"] == []
    assert client.get("/api/evaluation").json()["results"] == []
    assert client.get("/api/audit-log").json()["items"] == []


def test_api_case_endpoints_are_read_only_and_hide_ground_truth(tmp_path):
    client = build_client(tmp_path, processed=True)
    transactions = client.get("/api/transactions?outcome=recovered").json()
    assert transactions["items"][0]["transaction_id"] == "txn_api"
    assert "true_root_cause" not in str(transactions)
    assert "customer_id_hash" not in str(transactions)
    detail = client.get("/api/transactions/txn_api")
    assert detail.status_code == 200
    assert detail.json()["recovery_action"]["idempotency_key"] == "txn_api:delayed_retry:1"
    assert client.get("/api/transactions/not-found").status_code == 404
    assert client.get("/api/audit-log?transaction_id=txn_api").json()["items"][0]["detail"] == {}
    assert client.get("/api/recovery-by-cause").json()["items"][0]["recovered_amount"] == 1000.0
