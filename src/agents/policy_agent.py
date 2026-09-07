"""RecoverAI — Policy Agent.

Evaluates diagnosis against policy rules and thresholds from policy.yaml.
Determines whether a proposed action is PERMITTED, REQUIRES_HUMAN_REVIEW, or BLOCKED.

CRITICAL: Does NOT use an LLM to override deterministic safety policy.
"""

from dataclasses import dataclass, asdict
from typing import Dict, Optional

try:
    from ..guardrails import POLICIES, GLOBAL
except ImportError:
    from guardrails import POLICIES, GLOBAL


@dataclass
class PolicyDecision:
    status: str  # PERMITTED, REQUIRES_HUMAN_REVIEW, BLOCKED
    policy_action: str
    checks: Dict[str, Optional[bool]]
    reason: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class PolicyAgent:
    """Bounded policy decision agent that enforces deterministic guardrail constraints."""

    def evaluate_policy(self, transaction: dict, diagnosis_dict: dict) -> PolicyDecision:
        root_cause = diagnosis_dict["predicted_root_cause"]
        confidence = float(diagnosis_dict["confidence"])
        attempt_number = transaction["attempt_count"]

        policy = POLICIES.get(root_cause)
        checks: Dict[str, Optional[bool]] = {
            "policy_check": None,
            "confidence_check": None,
            "retry_check": None,
        }

        if policy is None:
            checks["policy_check"] = False
            return PolicyDecision(
                status="REQUIRES_HUMAN_REVIEW",
                policy_action="escalate",
                checks=checks,
                reason="Unrecognized root cause - no policy defined.",
            )

        checks["policy_check"] = True

        if root_cause == "risk_flag":
            checks["confidence_check"] = True
            checks["retry_check"] = True
            return PolicyDecision(
                status="REQUIRES_HUMAN_REVIEW",
                policy_action="escalate",
                checks=checks,
                reason="Risk/fraud flag - automatic recovery is never permitted.",
            )

        min_conf = max(policy.get("min_confidence", 0.7), GLOBAL["low_confidence_threshold"])
        if confidence < min_conf:
            checks["confidence_check"] = False
            return PolicyDecision(
                status="REQUIRES_HUMAN_REVIEW",
                policy_action="escalate",
                checks=checks,
                reason=f"Confidence {confidence:.2f} below threshold {min_conf:.2f}.",
            )
        checks["confidence_check"] = True

        if attempt_number > policy["max_attempts"]:
            checks["retry_check"] = False
            return PolicyDecision(
                status="BLOCKED",
                policy_action="stop",
                checks=checks,
                reason=f"Attempt {attempt_number} exceeds policy max {policy['max_attempts']}.",
            )
        checks["retry_check"] = True

        return PolicyDecision(
            status="PERMITTED",
            policy_action=policy["action"],
            checks=checks,
            reason=None,
        )
