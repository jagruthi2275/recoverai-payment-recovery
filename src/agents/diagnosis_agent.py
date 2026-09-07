"""RecoverAI — Diagnosis Agent.

Wraps deterministic rule lookup and LLM fallback into a formal agent interface.
Maintains strict separation between rule engine and LLM diagnosis while returning
structured DiagnosisResult objects.
"""

from dataclasses import dataclass, asdict
from typing import Optional

try:
    from ..diagnosis_rules import diagnose_by_rule
    from ..diagnosis_llm import diagnose_by_llm, get_llm_client
except ImportError:
    from diagnosis_rules import diagnose_by_rule
    from diagnosis_llm import diagnose_by_llm, get_llm_client


@dataclass
class DiagnosisResult:
    diagnosis_method: str
    predicted_root_cause: str
    confidence: float
    reasoning: str
    recommended_action: str

    def to_dict(self) -> dict:
        return asdict(self)


class DiagnosisAgent:
    """Agent responsible for diagnosing payment degradation root causes."""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    def diagnose(self, transaction: dict, outage_flagged_ids: set) -> DiagnosisResult:
        """Execute diagnosis flow: check outage context, apply rule engine, or fallback to LLM."""
        in_outage_window = transaction["transaction_id"] in outage_flagged_ids

        # If not in outage window, try rule engine first
        if not in_outage_window:
            rule_result = diagnose_by_rule(transaction)
            if rule_result is not None:
                return DiagnosisResult(
                    diagnosis_method=rule_result["diagnosis_method"],
                    predicted_root_cause=rule_result["predicted_root_cause"],
                    confidence=float(rule_result["confidence"]),
                    reasoning=rule_result["reasoning"],
                    recommended_action=rule_result["recommended_action"],
                )

        # Fallback to LLM reasoning (for ambiguous cases or outage window cases)
        client = self.llm_client or get_llm_client()
        llm_result = diagnose_by_llm(transaction, in_outage_window, client=client)

        return DiagnosisResult(
            diagnosis_method=llm_result["diagnosis_method"],
            predicted_root_cause=llm_result["predicted_root_cause"],
            confidence=float(llm_result["confidence"]),
            reasoning=llm_result["reasoning"],
            recommended_action=llm_result["recommended_action"],
        )
