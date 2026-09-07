"""RecoverAI — Safety Gate.

Final authority validating proposed actions against guardrails, retry limits,
confidence thresholds, and idempotency checks before any action is executed.

Outcomes:
- EXECUTE
- ESCALATE_TO_HUMAN
- STOP
"""

from dataclasses import dataclass, asdict
from typing import Dict, Optional, Set

try:
    from ..guardrails import make_idempotency_key, _existing_action
except ImportError:
    from guardrails import make_idempotency_key, _existing_action


@dataclass
class SafetyDecision:
    outcome: str  # EXECUTE, ESCALATE_TO_HUMAN, STOP
    final_action: str  # retry, delayed_retry, recovery_link, alt_payment_method, escalate, stop
    idempotency_key: str
    already_executed: bool
    existing_action: Optional[dict]
    checks: Dict[str, Optional[bool]]
    escalation_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class SafetyGate:
    """Multi-stage safety validator extending existing guardrail logic."""

    def validate(
        self,
        transaction: dict,
        diagnosis_dict: dict,
        policy_decision: dict,
        action_proposal: dict,
        executed_keys: Optional[Set[str]] = None,
        conn=None,
    ) -> SafetyDecision:
        checks = dict(policy_decision["checks"])
        checks["idempotency_check"] = None

        final_action = action_proposal["proposed_action"]
        key = make_idempotency_key(transaction["transaction_id"], final_action, transaction["attempt_count"])

        # Check durable database idempotency
        existing = _existing_action(conn, key)
        if existing is not None:
            checks["idempotency_check"] = False
            return SafetyDecision(
                outcome="STOP" if final_action == "stop" else ("ESCALATE_TO_HUMAN" if final_action == "escalate" else "EXECUTE"),
                final_action=final_action,
                idempotency_key=key,
                already_executed=True,
                existing_action=existing,
                checks=checks,
                escalation_reason=policy_decision.get("reason"),
            )

        # Check legacy in-memory set
        if executed_keys is not None and key in executed_keys:
            checks["idempotency_check"] = False
            return SafetyDecision(
                outcome="ESCALATE_TO_HUMAN",
                final_action="escalate",
                idempotency_key=key,
                already_executed=True,
                existing_action=None,
                checks=checks,
                escalation_reason="Duplicate action detected via idempotency key - blocked.",
            )

        checks["idempotency_check"] = True

        # Determine outcome state
        if final_action == "escalate":
            outcome = "ESCALATE_TO_HUMAN"
        elif final_action == "stop":
            outcome = "STOP"
        else:
            outcome = "EXECUTE"

        return SafetyDecision(
            outcome=outcome,
            final_action=final_action,
            idempotency_key=key,
            already_executed=False,
            existing_action=None,
            checks=checks,
            escalation_reason=policy_decision.get("reason"),
        )
