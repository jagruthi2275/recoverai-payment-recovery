"""RecoverAI pipeline orchestrator and reusable controlled-batch service."""

import json
import os
import random
import sqlite3
import time
from datetime import datetime, timezone

try:  # Package imports for FastAPI; fallback keeps direct CLI execution working.
    from .database import DEFAULT_DB_PATH, get_connection
    from .diagnosis_llm import diagnose_by_llm, get_llm_client
    from .diagnosis_pattern import attach_outage_context, detect_issuer_outage_windows
    from .diagnosis_rules import diagnose_by_rule
    from .guardrails import evaluate_guardrails
    from .agents import RecoveryOrchestrator
except ImportError:  # pragma: no cover - exercised by direct script execution
    from database import DEFAULT_DB_PATH, get_connection
    from diagnosis_llm import diagnose_by_llm, get_llm_client
    from diagnosis_pattern import attach_outage_context, detect_issuer_outage_windows
    from diagnosis_rules import diagnose_by_rule
    from guardrails import evaluate_guardrails
    from agents import RecoveryOrchestrator

DB_PATH = DEFAULT_DB_PATH
SEED = 42
random.seed(SEED)

RECOVERY_PROBABILITIES = {
    ("gateway_timeout", "retry"): 0.80,
    ("network_transient", "retry"): 0.75,
    ("insufficient_funds", "delayed_retry"): 0.55,
    ("authentication_failure", "recovery_link"): 0.65,
    ("card_invalid", "alt_payment_method"): 0.60,
    ("issuer_outage", "delayed_retry"): 0.50,
}


def detect_at_risk(transactions: list) -> list:
    return [t for t in transactions if t["status"] in ("failed", "degraded")]


def diagnose(transaction: dict, outage_flagged_ids: set, llm_client) -> dict:
    in_outage_window = transaction["transaction_id"] in outage_flagged_ids
    if not in_outage_window:
        rule_result = diagnose_by_rule(transaction)
        if rule_result is not None:
            return rule_result
    return diagnose_by_llm(transaction, in_outage_window, client=llm_client)


def simulate_execution(root_cause: str, action: str) -> tuple:
    if action in ("escalate", "stop"):
        return ("escalated" if action == "escalate" else "stopped"), 0.0
    return ("recovered", 1.0) if random.random() < RECOVERY_PROBABILITIES.get((root_cause, action), 0.5) else ("failed", 0.0)


def process_batch(conn, transactions: list | None = None, llm_client=None,
                  pace_llm_calls: bool = False) -> dict:
    """Process a supplied controlled batch using the agentic RecoveryOrchestrator.

    The caller owns ``conn``. Reprocessing a previously executed final action
    is idempotent: the existing action is returned in ``duplicates`` and no
    action/audit/escalation row is added.
    """
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if transactions is None:
        transactions = [dict(row) for row in cur.execute("SELECT * FROM transactions")]
    else:
        transactions = [dict(transaction) for transaction in transactions]

    at_risk = detect_at_risk(transactions)
    outage_windows = detect_issuer_outage_windows(at_risk)
    outage_flagged_ids = attach_outage_context(at_risk, outage_windows)
    llm_client = llm_client or get_llm_client()
    orchestrator = RecoveryOrchestrator(llm_client=llm_client)

    executed_keys = set()
    stats = {"recovered": 0, "failed": 0, "escalated": 0, "stopped": 0}
    result = {
        "input_transactions": len(transactions),
        "at_risk_transactions": len(at_risk),
        "processed_transactions": 0,
        "duplicate_actions": 0,
        "outcomes": stats,
        "recovered_amount": 0.0,
        "rule_diagnoses": 0,
        "llm_diagnoses": 0,
        "outage_windows": outage_windows,
        "duplicates": [],
    }

    for transaction in at_risk:
        res = orchestrator.process_transaction(
            conn=conn,
            transaction=transaction,
            outage_flagged_ids=outage_flagged_ids,
            executed_keys=executed_keys,
        )

        diag_method = res["diagnosis"]["diagnosis_method"]
        if diag_method == "rule_engine":
            result["rule_diagnoses"] += 1
        else:
            result["llm_diagnoses"] += 1
            if pace_llm_calls:
                time.sleep(0.3)

        if res["status"] == "duplicate":
            result["duplicate_actions"] += 1
            if res.get("idempotency_key"):
                result["duplicates"].append({
                    "transaction_id": transaction["transaction_id"],
                    "idempotency_key": res["idempotency_key"],
                    "existing_action": res.get("existing_action"),
                })
            continue

        result["processed_transactions"] += 1
        outcome = res["outcome"]
        stats[outcome] += 1
        result["recovered_amount"] += res["recovered_amount"]

    conn.commit()
    result["recovered_amount"] = round(result["recovered_amount"], 2)
    return result


def run_pipeline():
    """Preserve the existing command-line entry point."""
    conn = get_connection(DB_PATH)
    try:
        result = process_batch(conn, pace_llm_calls=True)
    finally:
        conn.close()
    print(f"Processed {result['processed_transactions']} of {result['at_risk_transactions']} at-risk transactions")
    print(f"Skipped existing actions: {result['duplicate_actions']}")
    print(f"Diagnosis calls -> rules: {result['rule_diagnoses']}, LLM: {result['llm_diagnoses']}")
    print(f"Detected issuer outage windows: {len(result['outage_windows'])}")
    print(f"Outcomes: {result['outcomes']}")
    print(f"Total revenue recovered: INR {result['recovered_amount']:,.2f}")
    return result


if __name__ == "__main__":
    run_pipeline()
