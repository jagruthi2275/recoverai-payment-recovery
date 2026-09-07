"""Read-only dashboard metrics derived from operational tables."""

from .diagnosis_pattern import attach_outage_context, detect_issuer_outage_windows


def get_dashboard_metrics(conn) -> dict:
    """Return operational aggregates without selecting evaluation ground truth."""
    cur = conn.cursor()
    total_transactions = cur.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    at_risk_count, total_amount_at_risk = cur.execute("""
        SELECT COUNT(*), COALESCE(SUM(amount), 0)
        FROM transactions WHERE status IN ('failed', 'degraded')
    """).fetchone()
    outcome_counts = {name: 0 for name in ("recovered", "failed", "escalated", "stopped")}
    for outcome, count in cur.execute("SELECT outcome, COUNT(*) FROM recovery_actions GROUP BY outcome"):
        outcome_counts[outcome] = count
    recovered_amount = cur.execute(
        "SELECT COALESCE(SUM(recovered_amount), 0) FROM recovery_actions"
    ).fetchone()[0]
    diagnosis_counts = {"rule_engine": 0, "llm_reasoning": 0}
    for method, count in cur.execute("SELECT diagnosis_method, COUNT(*) FROM diagnoses GROUP BY diagnosis_method"):
        diagnosis_counts[method] = count
    pending_escalations = cur.execute(
        "SELECT COUNT(*) FROM escalation_queue WHERE review_status = 'pending'"
    ).fetchone()[0]

    by_root_cause = [
        {"root_cause": cause, "count": count, "recovered_amount": amount}
        for cause, count, amount in cur.execute("""
            SELECT d.predicted_root_cause, COUNT(*), COALESCE(SUM(ra.recovered_amount), 0)
            FROM recovery_actions ra JOIN diagnoses d ON d.diagnosis_id = ra.diagnosis_id
            GROUP BY d.predicted_root_cause ORDER BY d.predicted_root_cause
        """)
    ]
    by_action = [
        {"action_type": action, "count": count, "recovered_amount": amount}
        for action, count, amount in cur.execute("""
            SELECT action_type, COUNT(*), COALESCE(SUM(recovered_amount), 0)
            FROM recovery_actions GROUP BY action_type ORDER BY action_type
        """)
    ]
    at_risk_rows = [dict(row) for row in cur.execute("""
        SELECT transaction_id, issuer, created_at
        FROM transactions WHERE status IN ('failed', 'degraded')
    """)]
    outage_windows = detect_issuer_outage_windows(at_risk_rows)

    return {
        "total_transactions": total_transactions,
        "at_risk_transactions": at_risk_count,
        "total_amount_at_risk": float(total_amount_at_risk),
        "recovered_amount": float(recovered_amount),
        "recovery_rate": float(recovered_amount) / float(total_amount_at_risk) if total_amount_at_risk else 0.0,
        "outcomes": outcome_counts,
        "diagnosis_counts": diagnosis_counts,
        "pending_escalations": pending_escalations,
        "recovery_by_root_cause": by_root_cause,
        "recovery_by_action": by_action,
        "outage_windows": outage_windows,
    }
