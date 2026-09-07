"""RecoverAI — Tool Layer Abstraction.

Provides explicit, typed tool functions around core deterministic operations.
No fake integrations — payment execution is explicitly simulated using known
probability distributions.
"""

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple
import json
import random

# Re-use existing simulation probabilities from run_pipeline
RECOVERY_PROBABILITIES = {
    ("gateway_timeout", "retry"): 0.80,
    ("network_transient", "retry"): 0.75,
    ("insufficient_funds", "delayed_retry"): 0.55,
    ("authentication_failure", "recovery_link"): 0.65,
    ("card_invalid", "alt_payment_method"): 0.60,
    ("issuer_outage", "delayed_retry"): 0.50,
}


@dataclass
class ToolResult:
    tool_name: str
    success: bool
    data: Any
    error: Optional[str] = None


class ToolRegistry:
    """Explicit registry for agent tools with structured input/output handling."""

    def __init__(self):
        self._tools: Dict[str, Callable] = {}

    def register(self, name: str, fn: Callable):
        self._tools[name] = fn

    def execute(self, name: str, **kwargs) -> ToolResult:
        if name not in self._tools:
            return ToolResult(tool_name=name, success=False, data=None, error=f"Tool '{name}' not found.")
        try:
            result = self._tools[name](**kwargs)
            return ToolResult(tool_name=name, success=True, data=result)
        except Exception as exc:
            return ToolResult(tool_name=name, success=False, data=None, error=str(exc))


def tool_get_transaction(transaction: dict) -> dict:
    """Tool: Retrieve structured transaction data."""
    return dict(transaction)


def tool_retrieve_recovery_context(transaction_id: str, outage_flagged_ids: set) -> dict:
    """Tool: Check if transaction belongs to a detected issuer outage window."""
    in_outage = transaction_id in outage_flagged_ids
    return {
        "transaction_id": transaction_id,
        "in_outage_window": in_outage,
    }


def tool_check_recovery_policy(root_cause: str, attempt_count: int, confidence: float) -> dict:
    """Tool: Retrieve policy constraints for a root cause."""
    try:
        from ..guardrails import POLICIES, GLOBAL
    except ImportError:
        from guardrails import POLICIES, GLOBAL

    policy = POLICIES.get(root_cause)
    if not policy:
        return {"permitted": False, "reason": "No policy defined for root cause"}

    min_conf = max(policy.get("min_confidence", 0.7), GLOBAL["low_confidence_threshold"])
    within_attempts = attempt_count <= policy["max_attempts"]
    meets_confidence = confidence >= min_conf

    return {
        "permitted": within_attempts and meets_confidence and root_cause != "risk_flag",
        "action": policy["action"],
        "max_attempts": policy["max_attempts"],
        "min_confidence": min_conf,
        "within_attempts": within_attempts,
        "meets_confidence": meets_confidence,
    }


def tool_execute_recovery(root_cause: str, action: str) -> Tuple[str, float]:
    """Tool: Execute simulated recovery action and return (outcome, recovered_fraction)."""
    if action in ("escalate", "stop"):
        return ("escalated" if action == "escalate" else "stopped"), 0.0
    prob = RECOVERY_PROBABILITIES.get((root_cause, action), 0.5)
    success = random.random() < prob
    return ("recovered", 1.0) if success else ("failed", 0.0)


def tool_escalate_to_human(conn, transaction_id: str, diagnosis_id: int, amount: float, reason: str, timestamp: str) -> int:
    """Tool: Enqueue transaction into escalation_queue table."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO escalation_queue (transaction_id, diagnosis_id, amount, reason, escalated_at)
        VALUES (?, ?, ?, ?, ?)
    """, (transaction_id, diagnosis_id, amount, reason, timestamp))
    return cur.lastrowid


def tool_record_audit_event(conn, transaction_id: str, timestamp: str, event_type: str, from_state: str, to_state: str, detail: dict) -> int:
    """Tool: Persist structured operational event into audit_log table."""
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO audit_log (transaction_id, timestamp, event_type, from_state, to_state, detail)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (transaction_id, timestamp, event_type, from_state, to_state, json.dumps(detail)))
    return cur.lastrowid


def create_default_registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register("get_transaction", tool_get_transaction)
    registry.register("retrieve_recovery_context", tool_retrieve_recovery_context)
    registry.register("check_recovery_policy", tool_check_recovery_policy)
    registry.register("execute_recovery", tool_execute_recovery)
    registry.register("escalate_to_human", tool_escalate_to_human)
    registry.register("record_audit_event", tool_record_audit_event)
    return registry


default_tool_registry = create_default_registry()
