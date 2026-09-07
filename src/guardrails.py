"""Policy engine and guardrails; policy remains the final authority."""

import os
import yaml

_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
POLICY_PATH = os.path.join(_SRC_DIR, "..", "config", "policy.yaml")
with open(POLICY_PATH, encoding="utf-8") as f:
    _config = yaml.safe_load(f)
POLICIES = _config["policies"]
GLOBAL = _config["global"]


def make_idempotency_key(transaction_id: str, action_type: str, attempt_number: int) -> str:
    return f"{transaction_id}:{action_type}:{attempt_number}"


def _existing_action(conn, idempotency_key: str):
    if conn is None:
        return None
    row = conn.execute("""
        SELECT action_id, action_type, outcome, recovered_amount
        FROM recovery_actions WHERE idempotency_key = ?
    """, (idempotency_key,)).fetchone()
    return dict(row) if row is not None else None


def _duplicate_or_authorize(final_action: str, transaction: dict, checks: dict,
                            executed_keys: set | None, conn) -> dict:
    """Check the durable identity: transaction ID + final action + attempt."""
    key = make_idempotency_key(transaction["transaction_id"], final_action, transaction["attempt_count"])
    existing = _existing_action(conn, key)
    if existing is not None:
        checks["idempotency_check"] = False
        return {"final_action": final_action, "checks": checks, "escalation_reason": None,
                "idempotency_key": key, "already_executed": True, "existing_action": existing}
    if executed_keys is not None and key in executed_keys:
        # Backward-compatible behavior for direct legacy callers without a DB connection.
        checks["idempotency_check"] = False
        return _escalate(checks, "Duplicate action detected via idempotency key - blocked.")
    checks["idempotency_check"] = True
    return {"final_action": final_action, "checks": checks, "escalation_reason": None,
            "idempotency_key": key, "already_executed": False}


def _with_reason(result: dict, reason: str) -> dict:
    result["escalation_reason"] = reason
    return result


def evaluate_guardrails(transaction: dict, diagnosis: dict, executed_keys: set | None = None, conn=None) -> dict:
    """Authorize a final policy action, or fail closed to escalation/stop.

    With ``conn``, previous actions are checked in SQLite so a retrying process
    returns the existing action instead of inserting another. ``executed_keys``
    remains supported for existing direct callers and tests.
    """
    root_cause = diagnosis["predicted_root_cause"]
    confidence = diagnosis["confidence"]
    attempt_number = transaction["attempt_count"]
    policy = POLICIES.get(root_cause)
    checks = {"confidence_check": None, "retry_check": None,
              "idempotency_check": None, "policy_check": None}

    if policy is None:
        checks["policy_check"] = False
        return _with_reason(_duplicate_or_authorize("escalate", transaction, checks, executed_keys, conn),
                            "Unrecognized root cause - no policy defined.")
    checks["policy_check"] = True

    if root_cause == "risk_flag":
        checks["confidence_check"] = True
        checks["retry_check"] = True
        return _with_reason(_duplicate_or_authorize("escalate", transaction, checks, executed_keys, conn),
                            "Risk/fraud flag - automatic recovery is never permitted.")

    min_conf = max(policy.get("min_confidence", 0.7), GLOBAL["low_confidence_threshold"])
    if confidence < min_conf:
        checks["confidence_check"] = False
        return _with_reason(_duplicate_or_authorize("escalate", transaction, checks, executed_keys, conn),
                            f"Confidence {confidence:.2f} below threshold {min_conf:.2f}.")
    checks["confidence_check"] = True

    if attempt_number > policy["max_attempts"]:
        checks["retry_check"] = False
        return _with_reason(_duplicate_or_authorize("stop", transaction, checks, executed_keys, conn),
                            f"Attempt {attempt_number} exceeds policy max {policy['max_attempts']}.")
    checks["retry_check"] = True

    # The policy action, not the model's proposal, defines the persisted key.
    return _duplicate_or_authorize(policy["action"], transaction, checks, executed_keys, conn)


def _escalate(checks: dict, reason: str) -> dict:
    return {"final_action": "escalate", "checks": checks, "escalation_reason": reason}
