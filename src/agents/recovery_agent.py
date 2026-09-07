"""RecoverAI — Recovery Agent.

Proposes a bounded recovery action from an explicitly allowed set based on
diagnosis and policy decisions. Does NOT execute side effects directly or bypass safety.
"""

from dataclasses import dataclass, asdict
from typing import Optional

ALLOWED_RECOVERY_ACTIONS = frozenset({
    "retry",
    "delayed_retry",
    "recovery_link",
    "alt_payment_method",
    "escalate",
    "stop",
})


@dataclass
class ActionProposal:
    proposed_action: str
    rationale: str
    target_root_cause: str

    def to_dict(self) -> dict:
        return asdict(self)


class RecoveryAgent:
    """Agent responsible for selecting appropriate recovery action proposals."""

    def propose_action(self, diagnosis_dict: dict, policy_decision: dict) -> ActionProposal:
        root_cause = diagnosis_dict["predicted_root_cause"]
        policy_action = policy_decision["policy_action"]

        # Policy decision is the binding constraint on proposed actions
        if policy_decision["status"] == "REQUIRES_HUMAN_REVIEW":
            chosen_action = "escalate"
            rationale = f"Policy required human review for root cause '{root_cause}': {policy_decision.get('reason')}"
        elif policy_decision["status"] == "BLOCKED":
            chosen_action = "stop"
            rationale = f"Policy blocked recovery attempts for root cause '{root_cause}': {policy_decision.get('reason')}"
        else:
            chosen_action = policy_action if policy_action in ALLOWED_RECOVERY_ACTIONS else "escalate"
            rationale = f"Recommended action '{chosen_action}' aligned with policy for root cause '{root_cause}'."

        return ActionProposal(
            proposed_action=chosen_action,
            rationale=rationale,
            target_root_cause=root_cause,
        )
