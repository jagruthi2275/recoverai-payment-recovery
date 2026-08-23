"""
RecoverAI — Layer A: deterministic rule engine.

Resolves transactions with a clean, unambiguous failure_code directly —
no LLM call, no ambiguity. Per SPEC §8 Layer A.

This layer is intentionally dumb and fast: a lookup table. If it can't
resolve a case with high confidence, it returns None and the pipeline
falls through to Layer B / Layer C.
"""

# failure_code -> (root_cause, base_confidence, recommended_action)
RULE_TABLE = {
    "NSF":            ("insufficient_funds",     0.97, "delayed_retry"),
    "AUTH_FAILED":    ("authentication_failure",  0.96, "recovery_link"),
    "CARD_EXPIRED":   ("card_invalid",            0.98, "alt_payment_method"),
    "TIMEOUT":        ("gateway_timeout",         0.90, "retry"),
    "RISK_BLOCK":     ("risk_flag",               0.99, "escalate"),
    "NETWORK_ERROR":  ("network_transient",       0.88, "retry"),
}


def diagnose_by_rule(transaction: dict) -> dict | None:
    """
    Attempt a rule-based diagnosis.

    Returns a diagnosis dict if the failure_code is in the rule table,
    else None (signals the pipeline to escalate to pattern/LLM layers).
    """
    code = transaction.get("failure_code")
    if code is None or code not in RULE_TABLE:
        return None

    root_cause, confidence, action = RULE_TABLE[code]

    return {
        "diagnosis_method": "rule_engine",
        "predicted_root_cause": root_cause,
        "confidence": confidence,
        "reasoning": f"Failure code '{code}' maps deterministically to '{root_cause}' per rule table.",
        "recommended_action": action,
    }
