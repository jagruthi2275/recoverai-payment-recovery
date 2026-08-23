"""
RecoverAI — policy engine & guardrails.

Per SPEC §9 / §10: the LLM (and rules) only PROPOSE a diagnosis and
action. This module is the actual authority — every proposal passes
through confidence, retry, idempotency, and policy checks before
anything is allowed to execute. If any check fails, the action is
downgraded to escalate or stop. This is deliberate: the system never
blindly trusts a diagnosis, regardless of which layer produced it.
"""

import os
import yaml

# Resolve relative to this file's location, not the current working directory,
# so it works regardless of where the script is invoked from.
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
POLICY_PATH = os.path.join(_SRC_DIR, "..", "config", "policy.yaml")

with open(POLICY_PATH) as f:
    _config = yaml.safe_load(f)

POLICIES = _config["policies"]
GLOBAL = _config["global"]


def make_idempotency_key(transaction_id: str, action_type: str, attempt_number: int) -> str:
    return f"{transaction_id}:{action_type}:{attempt_number}"


def evaluate_guardrails(transaction: dict, diagnosis: dict, executed_keys: set) -> dict:
    """
    Runs every proposed diagnosis through the guardrail chain and returns
    the FINAL decision — which may override the diagnosis's recommendation.

    Returns:
        {
          "final_action": str,
          "checks": {confidence_check, retry_check, idempotency_check, policy_check},
          "escalation_reason": str | None,
        }
    """
    root_cause = diagnosis["predicted_root_cause"]
    confidence = diagnosis["confidence"]
    proposed_action = diagnosis["recommended_action"]
    attempt_number = transaction["attempt_count"]

    policy = POLICIES.get(root_cause)
    checks = {
        "confidence_check": None,
        "retry_check": None,
        "idempotency_check": None,
        "policy_check": None,
    }

    # 1. Policy check — is this root cause even known / does it have a defined policy?
    if policy is None:
        checks["policy_check"] = False
        return _escalate(checks, "Unrecognized root cause — no policy defined.")
    checks["policy_check"] = True

    # 2. Risk flag is a hard rule regardless of confidence: NEVER auto-act.
    if root_cause == "risk_flag":
        checks["confidence_check"] = True
        checks["retry_check"] = True
        checks["idempotency_check"] = True
        return _escalate(checks, "Risk/fraud flag — automatic recovery is never permitted.")

    # 3. Confidence check — global low-confidence threshold overrides everything else.
    min_conf = max(policy.get("min_confidence", 0.7), GLOBAL["low_confidence_threshold"])
    if confidence < min_conf:
        checks["confidence_check"] = False
        return _escalate(checks, f"Confidence {confidence:.2f} below threshold {min_conf:.2f}.")
    checks["confidence_check"] = True

    # 4. Retry limit check
    max_attempts = policy["max_attempts"]
    if attempt_number > max_attempts:
        checks["retry_check"] = False
        return {"final_action": "stop", "checks": checks,
                "escalation_reason": f"Attempt {attempt_number} exceeds policy max {max_attempts}."}
    checks["retry_check"] = True

    # 5. Idempotency check
    idem_key = make_idempotency_key(transaction["transaction_id"], proposed_action, attempt_number)
    if idem_key in executed_keys:
        checks["idempotency_check"] = False
        return _escalate(checks, "Duplicate action detected via idempotency key — blocked.")
    checks["idempotency_check"] = True

    # All checks passed — action is authorized.
    return {
        "final_action": policy["action"],  # policy is the source of truth for the action, not the LLM's suggestion
        "checks": checks,
        "escalation_reason": None,
        "idempotency_key": idem_key,
    }


def _escalate(checks: dict, reason: str) -> dict:
    return {"final_action": "escalate", "checks": checks, "escalation_reason": reason}
