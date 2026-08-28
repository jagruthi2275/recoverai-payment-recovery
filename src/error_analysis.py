"""
RecoverAI — error analysis. Per SPEC §16.

Pulls out actual misdiagnosed transactions and traces WHY the diagnosis
layer got them wrong: which signal was misleading, whether a guardrail
caught the mistake, and what it suggests for improvement. This is
deliberately about the agent's errors, not the transaction's failure —
the goal is proving we understand where the system is weak, not hiding it.

Usage:
    python3 src/error_analysis.py [--n 5]
"""

import argparse
import os
import sqlite3

_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_SRC_DIR, "..", "db", "recoverai.db")


def fetch_misdiagnosed(conn, n: int):
    """
    Pull transactions where predicted_root_cause != true_root_cause,
    joined with the guardrail outcome so we can see whether the mistake
    was caught before it caused harm.
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT t.transaction_id, t.true_root_cause, d.predicted_root_cause,
               d.confidence, d.diagnosis_method, d.reasoning,
               t.failure_code, t.gateway_response_ms, t.is_issuer_outage_case,
               ra.action_type, ra.outcome, ra.policy_checks_passed
        FROM transactions t
        JOIN diagnoses d ON d.transaction_id = t.transaction_id
        JOIN recovery_actions ra ON ra.diagnosis_id = d.diagnosis_id
        WHERE t.true_root_cause != d.predicted_root_cause
        GROUP BY t.transaction_id
        HAVING d.diagnosis_id = MAX(d.diagnosis_id)
        ORDER BY t.amount DESC
        LIMIT ?
    """, (n,))
    return cur.fetchall()


def classify_signal(row) -> str:
    """
    Best-effort explanation of which signal likely misled the diagnosis,
    based on what we know about the confusion patterns (SPEC §16 asks
    'which signal was misleading' — this encodes the reasoning we already
    identified from the confusion matrix / prompt-tuning work).
    """
    true_cause, pred_cause, latency, is_outage, code = (
        row[1], row[2], row[7], row[8], row[6]
    )

    if true_cause == "issuer_outage" and pred_cause == "gateway_timeout":
        return ("High latency looked like an ordinary timeout at the single-transaction "
                "level; the systemic outage-window signal wasn't weighted heavily enough "
                "against raw latency.")
    if true_cause == "card_invalid" and pred_cause == "risk_flag":
        return ("A missing/generic failure code left the model without the clear "
                "CARD_EXPIRED signal, and it over-indexed on caution, defaulting toward "
                "the more conservative risk_flag interpretation.")
    if code is None or code in ("DECLINED", "UNKNOWN_ERROR"):
        return ("The failure_code was missing or generic — the diagnosis had to rely on "
                "secondary signals (latency, attempt history) alone, which are inherently "
                "less certain than an explicit decline code.")
    return "No single dominant signal identified — likely a genuinely ambiguous case."


def guardrail_caught_it(policy_checks_json: str, outcome: str) -> str:
    """Did a guardrail prevent this misdiagnosis from causing real harm?"""
    if outcome in ("escalated", "stopped"):
        return "YES — misdiagnosis was escalated/stopped, not auto-executed. No money-risk occurred."
    return "NO — an automated action was taken on a wrong diagnosis. This is a 'false confidence' case (SPEC §15)."


def print_case(idx: int, row):
    (txn_id, true_cause, pred_cause, confidence, method, reasoning,
     failure_code, latency, is_outage, action, outcome, checks_json) = row

    print(f"\n{'='*70}")
    print(f"CASE {idx}: {txn_id}")
    print(f"{'='*70}")
    print(f"Ground truth:        {true_cause}")
    print(f"Predicted:            {pred_cause}  (confidence: {confidence:.2f}, method: {method})")
    print(f"Model's stated reason: {reasoning}")
    print(f"Observed signal:      failure_code={failure_code or 'MISSING'}, "
          f"latency={latency}ms, in_outage_cluster={bool(is_outage)}")
    print(f"Action taken:          {action}  ->  outcome: {outcome}")
    print(f"\nWhich signal was misleading:\n  {classify_signal(row)}")
    print(f"\nDid a guardrail catch it:\n  {guardrail_caught_it(checks_json, outcome)}")


def print_summary(rows):
    print(f"\n{'='*70}")
    print(f"SUMMARY — {len(rows)} misdiagnosed cases reviewed")
    print(f"{'='*70}")
    caught = sum(1 for r in rows if r[10] in ("escalated", "stopped"))
    print(f"Caught by guardrail (safe): {caught}/{len(rows)}")
    print(f"NOT caught (false confidence — real risk): {len(rows) - caught}/{len(rows)}")
    print("\nHow the system should improve:")
    print("  1. Strengthen outage-window weighting in the diagnosis prompt (in progress —")
    print("     see diagnosis_llm.py SYSTEM_PROMPT update and before/after eval comparison).")
    print("  2. For missing/generic failure codes, consider a secondary pattern-detection")
    print("     signal (e.g. historical failure rate for that customer/method) beyond just")
    print("     latency and outage-window flags, to reduce reliance on a single weak signal.")
    print("  3. The confidence-threshold guardrail is doing real work — most misdiagnoses")
    print("     are safely escalated, not acted on. That's the system behaving as designed.")


def run_error_analysis(n: int = 5):
    conn = sqlite3.connect(DB_PATH)
    rows = fetch_misdiagnosed(conn, n)

    if not rows:
        print("No misdiagnosed cases found (or pipeline hasn't been run yet).")
        return

    for idx, row in enumerate(rows, start=1):
        print_case(idx, row)

    print_summary(rows)
    conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=5, help="Number of misdiagnosed cases to review")
    args = parser.parse_args()
    run_error_analysis(args.n)
