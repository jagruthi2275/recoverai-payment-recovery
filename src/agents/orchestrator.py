"""RecoverAI — Recovery Orchestrator.

Central state coordinator managing transaction recovery workflow:
transaction -> diagnosis -> policy decision -> recovery proposal -> safety validation
-> tool execution / human escalation -> audit trace -> final outcome.
"""

from datetime import datetime, timezone
import json
import sqlite3
import uuid
from typing import Dict, Optional, Set

from .diagnosis_agent import DiagnosisAgent, DiagnosisResult
from .policy_agent import PolicyAgent, PolicyDecision
from .recovery_agent import ActionProposal, RecoveryAgent
from .safety_gate import SafetyDecision, SafetyGate
from .tools import ToolRegistry, default_tool_registry


class RecoveryOrchestrator:
    """Orchestrates multi-agent payment recovery workflow while maintaining auditability."""

    def __init__(
        self,
        diagnosis_agent: Optional[DiagnosisAgent] = None,
        policy_agent: Optional[PolicyAgent] = None,
        recovery_agent: Optional[RecoveryAgent] = None,
        safety_gate: Optional[SafetyGate] = None,
        tool_registry: Optional[ToolRegistry] = None,
        llm_client=None,
    ):
        self.diagnosis_agent = diagnosis_agent or DiagnosisAgent(llm_client=llm_client)
        self.policy_agent = policy_agent or PolicyAgent()
        self.recovery_agent = recovery_agent or RecoveryAgent()
        self.safety_gate = safety_gate or SafetyGate()
        self.tools = tool_registry or default_tool_registry

    def process_transaction(
        self,
        conn,
        transaction: dict,
        outage_flagged_ids: Set[str],
        executed_keys: Optional[Set[str]] = None,
        workflow_id: Optional[str] = None,
    ) -> dict:
        """Run complete recovery workflow for a single transaction."""
        wf_id = workflow_id or f"wf_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc).isoformat()
        cur = conn.cursor()

        # Step 1: Diagnosis Agent
        diagnosis: DiagnosisResult = self.diagnosis_agent.diagnose(transaction, outage_flagged_ids)
        diag_dict = diagnosis.to_dict()

        # Step 2: Policy Agent
        policy_decision: PolicyDecision = self.policy_agent.evaluate_policy(transaction, diag_dict)
        pol_dict = policy_decision.to_dict()

        # Step 3: Recovery Agent
        action_proposal: ActionProposal = self.recovery_agent.propose_action(diag_dict, pol_dict)
        prop_dict = action_proposal.to_dict()

        # Step 4: Safety Gate
        safety_decision: SafetyDecision = self.safety_gate.validate(
            transaction=transaction,
            diagnosis_dict=diag_dict,
            policy_decision=pol_dict,
            action_proposal=prop_dict,
            executed_keys=executed_keys,
            conn=conn,
        )
        safe_dict = safety_decision.to_dict()

        if safety_decision.already_executed:
            return {
                "status": "duplicate",
                "transaction_id": transaction["transaction_id"],
                "idempotency_key": safety_decision.idempotency_key,
                "already_executed": True,
                "existing_action": safety_decision.existing_action,
                "diagnosis": diag_dict,
                "policy_decision": pol_dict,
                "action_proposal": prop_dict,
                "safety_decision": safe_dict,
            }

        if safe_dict["checks"]["idempotency_check"] is False:
            return {
                "status": "duplicate",
                "transaction_id": transaction["transaction_id"],
                "idempotency_key": safety_decision.idempotency_key,
                "already_executed": True,
                "existing_action": None,
                "diagnosis": diag_dict,
                "policy_decision": pol_dict,
                "action_proposal": prop_dict,
                "safety_decision": safe_dict,
            }

        # Step 5: Record Diagnosis in DB
        cur.execute("""
            INSERT INTO diagnoses (transaction_id, diagnosis_method, predicted_root_cause,
                                   confidence, reasoning, recommended_action, diagnosed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            transaction["transaction_id"],
            diag_dict["diagnosis_method"],
            diag_dict["predicted_root_cause"],
            diag_dict["confidence"],
            diag_dict["reasoning"],
            diag_dict["recommended_action"],
            now,
        ))
        diagnosis_id = cur.lastrowid

        # Step 6: Tool Execution or Human Escalation
        final_action = safety_decision.final_action
        if safety_decision.outcome == "EXECUTE":
            tool_res = self.tools.execute(
                "execute_recovery",
                root_cause=diag_dict["predicted_root_cause"],
                action=final_action,
            )
            tool_selected = "execute_recovery"
            outcome, recovered_fraction = tool_res.data
        elif safety_decision.outcome == "ESCALATE_TO_HUMAN":
            tool_selected = "escalate_to_human"
            outcome, recovered_fraction = "escalated", 0.0
        else:  # STOP
            tool_selected = "stop"
            outcome, recovered_fraction = "stopped", 0.0

        recovered_amount = round(transaction["amount"] * recovered_fraction, 2)

        # Step 7: Record Recovery Action in DB
        try:
            cur.execute("""
                INSERT INTO recovery_actions (transaction_id, diagnosis_id, action_type, attempt_number,
                    idempotency_key, policy_checks_passed, executed_at, outcome, recovered_amount)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                transaction["transaction_id"],
                diagnosis_id,
                final_action,
                transaction["attempt_count"],
                safety_decision.idempotency_key,
                json.dumps(safety_decision.checks),
                now,
                outcome,
                recovered_amount,
            ))
        except sqlite3.IntegrityError:
            existing = conn.execute("""
                SELECT action_id, action_type, outcome, recovered_amount
                FROM recovery_actions WHERE idempotency_key = ?
            """, (safety_decision.idempotency_key,)).fetchone()
            if existing is None:
                raise
            return {
                "status": "duplicate",
                "transaction_id": transaction["transaction_id"],
                "idempotency_key": safety_decision.idempotency_key,
                "already_executed": True,
                "existing_action": dict(existing),
                "diagnosis": diag_dict,
                "policy_decision": pol_dict,
                "action_proposal": prop_dict,
                "safety_decision": safe_dict,
            }

        if executed_keys is not None:
            executed_keys.add(safety_decision.idempotency_key)

        # Step 8: Handle Human Escalation Queue write if needed
        if safety_decision.outcome == "ESCALATE_TO_HUMAN":
            self.tools.execute(
                "escalate_to_human",
                conn=conn,
                transaction_id=transaction["transaction_id"],
                diagnosis_id=diagnosis_id,
                amount=transaction["amount"],
                reason=safety_decision.escalation_reason or "low_confidence",
                timestamp=now,
            )

        # Step 9: Audit Trace
        audit_detail = {
            "workflow_id": wf_id,
            "diagnosis": diag_dict,
            "policy_decision": pol_dict,
            "action_proposal": prop_dict,
            "safety_decision": safe_dict,
            "decision": {
                "final_action": final_action,
                "checks": safety_decision.checks,
                "escalation_reason": safety_decision.escalation_reason,
                "idempotency_key": safety_decision.idempotency_key,
                "already_executed": False,
            },
            "tool_selected": tool_selected,
            "outcome": outcome,
        }

        self.tools.execute(
            "record_audit_event",
            conn=conn,
            transaction_id=transaction["transaction_id"],
            timestamp=now,
            event_type="state_transition",
            from_state="DETECTED",
            to_state=outcome.upper(),
            detail=audit_detail,
        )

        return {
            "status": "success",
            "workflow_id": wf_id,
            "transaction_id": transaction["transaction_id"],
            "diagnosis_id": diagnosis_id,
            "diagnosis": diag_dict,
            "policy_decision": pol_dict,
            "action_proposal": prop_dict,
            "safety_decision": safe_dict,
            "final_action": final_action,
            "outcome": outcome,
            "recovered_amount": recovered_amount,
        }
