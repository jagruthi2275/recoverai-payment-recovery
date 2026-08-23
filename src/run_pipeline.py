"""
RecoverAI — pipeline orchestrator.

Runs the full loop per SPEC §6: Detection -> Diagnosis -> Decision ->
Guardrails -> Idempotency -> Simulated Execution -> Audit Log -> Metrics.

Usage:
    python3 src/run_pipeline.py
"""

import json
import random
import sqlite3
from datetime import datetime, timedelta, timezone

from diagnosis_rules import diagnose_by_rule
from diagnosis_pattern import detect_issuer_outage_windows, attach_outage_context
from diagnosis_llm import diagnose_by_llm, get_llm_client
from guardrails import evaluate_guardrails, make_idempotency_key

import os
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_SRC_DIR, "..", "db", "recoverai.db")
SEED = 42
random.seed(SEED)

# outcome probabilities per (root_cause, action) — used by the execution
# simulator (SPEC §12). Deterministic given the fixed seed.
RECOVERY_PROBABILITIES = {
    ("gateway_timeout", "retry"):                  0.80,
    ("network_transient", "retry"):                0.75,
    ("insufficient_funds", "delayed_retry"):        0.55,
    ("authentication_failure", "recovery_link"):     0.65,
    ("card_invalid", "alt_payment_method"):           0.60,
    ("issuer_outage", "delayed_retry"):                0.50,
}
DEFAULT_ESCALATE_STOP_RECOVERY = 0.0  # escalate/stop never auto-recover


def detect_at_risk(transactions: list) -> list:
    """Detection layer (SPEC §7) — all rows in this batch are already
    failed/degraded transactions by construction; a real system would
    filter a mixed stream here. Kept explicit as its own step for clarity
    and so it's the natural place to add future filtering logic."""
    return [t for t in transactions if t["status"] in ("failed", "degraded")]


def diagnose(transaction: dict, outage_flagged_ids: set, llm_client) -> dict:
    """Runs the transaction through Layer A, falling back to Layer C
    (informed by Layer B's outage context) if rules can't resolve it."""
    rule_result = diagnose_by_rule(transaction)
    if rule_result is not None:
        return rule_result

    in_outage_window = transaction["transaction_id"] in outage_flagged_ids
    return diagnose_by_llm(transaction, in_outage_window, client=llm_client)


def simulate_execution(root_cause: str, action: str) -> tuple:
    """Returns (outcome, recovered_amount_fraction) — deterministic given seed."""
    if action in ("escalate", "stop"):
        return "escalated" if action == "escalate" else "stopped", 0.0

    prob = RECOVERY_PROBABILITIES.get((root_cause, action), 0.5)
    if random.random() < prob:
        return "recovered", 1.0
    return "failed", 0.0


def run_pipeline():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT * FROM transactions")
    transactions = [dict(row) for row in cur.fetchall()]

    at_risk = detect_at_risk(transactions)

    # Layer B: pattern detection runs once across the whole batch
    outage_windows = detect_issuer_outage_windows(at_risk)
    outage_flagged_ids = attach_outage_context(at_risk, outage_windows)

    llm_client = get_llm_client()
    executed_keys = set()

    now = datetime.now(timezone.utc)
    stats = {"recovered": 0, "failed": 0, "escalated": 0, "stopped": 0}
    total_recovered_amount = 0.0
    llm_calls = 0
    rule_calls = 0

    for t in at_risk:
        diagnosis = diagnose(t, outage_flagged_ids, llm_client)
        if diagnosis["diagnosis_method"] == "rule_engine":
            rule_calls += 1
        else:
            llm_calls += 1

        cur.execute("""
            INSERT INTO diagnoses (transaction_id, diagnosis_method, predicted_root_cause,
                                    confidence, reasoning, recommended_action, diagnosed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (t["transaction_id"], diagnosis["diagnosis_method"], diagnosis["predicted_root_cause"],
              diagnosis["confidence"], diagnosis["reasoning"], diagnosis["recommended_action"],
              now.isoformat()))
        diagnosis_id = cur.lastrowid

        decision = evaluate_guardrails(t, diagnosis, executed_keys)
        final_action = decision["final_action"]

        if final_action in ("escalate", "stop") and decision.get("idempotency_key") is None:
            idem_key = make_idempotency_key(t["transaction_id"], final_action, t["attempt_count"])
        else:
            idem_key = decision.get("idempotency_key") or make_idempotency_key(
                t["transaction_id"], final_action, t["attempt_count"])
        executed_keys.add(idem_key)

        outcome, recovered_fraction = simulate_execution(diagnosis["predicted_root_cause"], final_action)
        recovered_amount = round(t["amount"] * recovered_fraction, 2)
        total_recovered_amount += recovered_amount
        stats[outcome] = stats.get(outcome, 0) + 1

        cur.execute("""
            INSERT INTO recovery_actions (transaction_id, diagnosis_id, action_type, attempt_number,
                                           idempotency_key, policy_checks_passed, executed_at,
                                           outcome, recovered_amount)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (t["transaction_id"], diagnosis_id, final_action, t["attempt_count"], idem_key,
              json.dumps(decision["checks"]), now.isoformat(), outcome, recovered_amount))

        cur.execute("""
            INSERT INTO audit_log (transaction_id, timestamp, event_type, from_state, to_state, detail)
            VALUES (?, ?, 'state_transition', 'DETECTED', ?, ?)
        """, (t["transaction_id"], now.isoformat(), outcome.upper(),
              json.dumps({"diagnosis": diagnosis, "decision": decision, "outcome": outcome})))

        if final_action == "escalate":
            cur.execute("""
                INSERT INTO escalation_queue (transaction_id, diagnosis_id, amount, reason, escalated_at)
                VALUES (?, ?, ?, ?, ?)
            """, (t["transaction_id"], diagnosis_id, t["amount"],
                  decision["escalation_reason"] or "low_confidence", now.isoformat()))

    conn.commit()

    print(f"Processed {len(at_risk)} at-risk transactions")
    print(f"Diagnosis calls -> rules: {rule_calls} ({rule_calls/len(at_risk):.1%}), "
          f"LLM: {llm_calls} ({llm_calls/len(at_risk):.1%})")
    print(f"Detected issuer outage windows: {len(outage_windows)}")
    for w in outage_windows:
        print(f"  {w['issuer']}: {w['count']} failures between {w['window_start']} and {w['window_end']}")
    print(f"\nOutcomes: {stats}")
    print(f"Total revenue recovered: ₹{total_recovered_amount:,.2f}")

    conn.close()


if __name__ == "__main__":
    run_pipeline()
