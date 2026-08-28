"""
RecoverAI — evaluation harness. Per SPEC §15.

Compares diagnoses.predicted_root_cause against transactions.true_root_cause
(the hidden ground truth baked into the synthetic generator) to compute:
  - Precision / recall / F1 per root cause
  - Macro F1
  - Confusion matrix
  - Safety metrics: false confidence rate, false escalation rate

"False confidence" = agent diagnosed wrong AND acted (didn't escalate) —
the dangerous failure mode: real money risk from acting on a wrong call.

"False escalation" = agent diagnosed correctly with high confidence, but
still got escalated (e.g. because it was risk_flag by policy, or the
correct diagnosis carried a confidence below threshold) — the costly-but-
safe failure mode: unnecessary human load.

Usage:
    python3 src/evaluate.py
"""

import os
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone

_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_SRC_DIR, "..", "db", "recoverai.db")

ALL_CAUSES = [
    "insufficient_funds", "gateway_timeout", "authentication_failure",
    "card_invalid", "network_transient", "issuer_outage", "risk_flag",
]


def fetch_eval_rows(conn):
    """
    One row per transaction: ground truth, predicted cause, confidence,
    and what action was actually taken (needed for the safety metrics).
    Uses the MOST RECENT diagnosis/action per transaction (a transaction
    could in principle be re-diagnosed; we evaluate the final call).
    """
    cur = conn.cursor()
    cur.execute("""
        SELECT t.transaction_id, t.true_root_cause, d.predicted_root_cause,
               d.confidence, ra.action_type
        FROM transactions t
        JOIN diagnoses d ON d.transaction_id = t.transaction_id
        JOIN recovery_actions ra ON ra.diagnosis_id = d.diagnosis_id
        GROUP BY t.transaction_id
        HAVING d.diagnosis_id = MAX(d.diagnosis_id)
    """)
    return cur.fetchall()


def compute_confusion_matrix(rows):
    matrix = defaultdict(lambda: defaultdict(int))
    for _, true_cause, pred_cause, _, _ in rows:
        matrix[true_cause][pred_cause] += 1
    return matrix


def compute_precision_recall_f1(rows, causes):
    results = {}
    for cause in causes:
        tp = sum(1 for _, t, p, _, _ in rows if t == cause and p == cause)
        fp = sum(1 for _, t, p, _, _ in rows if t != cause and p == cause)
        fn = sum(1 for _, t, p, _, _ in rows if t == cause and p != cause)
        support = sum(1 for _, t, _, _, _ in rows if t == cause)

        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

        results[cause] = {"precision": precision, "recall": recall, "f1": f1, "support": support}
    return results


def compute_safety_metrics(rows):
    """
    False confidence: diagnosis WRONG and NOT escalated/stopped (i.e. some
    automated action was taken on a bad diagnosis) — the dangerous case.

    False escalation: diagnosis CORRECT but action was escalate/stop anyway
    — safe, but represents unnecessary human load / lost automation value.
    """
    total = len(rows)
    false_confidence = 0
    false_escalation = 0

    for _, true_cause, pred_cause, confidence, action in rows:
        correct = (true_cause == pred_cause)
        auto_acted = action not in ("escalate", "stop")

        if not correct and auto_acted:
            false_confidence += 1
        if correct and not auto_acted:
            false_escalation += 1

    return {
        "false_confidence_count": false_confidence,
        "false_confidence_rate": false_confidence / total if total else 0.0,
        "false_escalation_count": false_escalation,
        "false_escalation_rate": false_escalation / total if total else 0.0,
        "total_evaluated": total,
    }


def print_report(pr_f1, confusion, safety, macro_f1):
    print("=" * 70)
    print("RecoverAI — Evaluation Report")
    print("=" * 70)

    print(f"\n{'Root Cause':28s} {'Precision':>10s} {'Recall':>10s} {'F1':>10s} {'Support':>8s}")
    print("-" * 70)
    for cause, m in pr_f1.items():
        print(f"{cause:28s} {m['precision']:>10.3f} {m['recall']:>10.3f} {m['f1']:>10.3f} {m['support']:>8d}")
    print("-" * 70)
    print(f"{'MACRO AVERAGE':28s} {'':>10s} {'':>10s} {macro_f1:>10.3f}")

    print(f"\n--- Safety Metrics (SPEC §15) ---")
    print(f"False confidence rate: {safety['false_confidence_rate']:.2%} "
          f"({safety['false_confidence_count']}/{safety['total_evaluated']}) "
          f"— wrong diagnosis that was acted on automatically (dangerous)")
    print(f"False escalation rate: {safety['false_escalation_rate']:.2%} "
          f"({safety['false_escalation_count']}/{safety['total_evaluated']}) "
          f"— correct diagnosis that was escalated anyway (safe, costs human time)")

    print(f"\n--- Confusion Matrix (rows=true, cols=predicted) ---")
    causes_present = sorted(set(list(confusion.keys()) + [c for row in confusion.values() for c in row.keys()]))
    header = "true\\pred".ljust(24) + "".join(c[:10].rjust(12) for c in causes_present)
    print(header)
    for true_cause in causes_present:
        row_str = true_cause.ljust(24)
        for pred_cause in causes_present:
            row_str += str(confusion[true_cause][pred_cause]).rjust(12)
        print(row_str)


def save_to_db(conn, pr_f1, macro_f1):
    cur = conn.cursor()
    now = datetime.now(timezone.utc).isoformat()
    for cause, m in pr_f1.items():
        cur.execute("""
            INSERT INTO evaluation_results (root_cause, precision, recall, f1_score, support, run_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (cause, m["precision"], m["recall"], m["f1"], m["support"], now))
    cur.execute("""
        INSERT INTO evaluation_results (root_cause, precision, recall, f1_score, support, run_at)
        VALUES ('MACRO_AVERAGE', NULL, NULL, ?, NULL, ?)
    """, (macro_f1, now))
    conn.commit()


def run_evaluation():
    conn = sqlite3.connect(DB_PATH)
    rows = fetch_eval_rows(conn)

    if not rows:
        print("No diagnosed transactions found. Run src/run_pipeline.py first.")
        return

    causes_present = sorted(set(r[1] for r in rows))
    pr_f1 = compute_precision_recall_f1(rows, causes_present)
    confusion = compute_confusion_matrix(rows)
    safety = compute_safety_metrics(rows)
    macro_f1 = sum(m["f1"] for m in pr_f1.values()) / len(pr_f1) if pr_f1 else 0.0

    print_report(pr_f1, confusion, safety, macro_f1)
    save_to_db(conn, pr_f1, macro_f1)
    print(f"\nSaved results to evaluation_results table.")

    conn.close()


if __name__ == "__main__":
    run_evaluation()
