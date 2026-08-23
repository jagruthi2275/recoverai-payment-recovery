"""
RecoverAI — Layer C: LLM reasoning for ambiguous cases.

Only invoked when Layer A (rules) cannot resolve a transaction — i.e. the
failure_code is missing or non-specific ("DECLINED", "UNKNOWN_ERROR").
Per SPEC §8 Layer C: the LLM receives minimal, hashed-PII context and
returns a structured diagnosis. It does NOT execute anything — its
output is just another candidate that the policy engine (guardrails.py)
must approve before anything happens.

Provider note: built against Groq's OpenAI-compatible chat completions
API (matches the rest of the RecoverAI stack / your RAG chatbot). Set
GROQ_API_KEY in your environment to run live. A MockLLMClient is
included so the pipeline is testable without network access or a key —
swap providers by changing get_llm_client().
"""

import json
import os
import re

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv not installed — fine if GROQ_API_KEY is set another way

SYSTEM_PROMPT = """You are a payment failure diagnosis assistant for RecoverAI.
Given transaction context, determine the most likely root cause of a payment
failure and recommend ONE recovery action.

Valid root causes: insufficient_funds, gateway_timeout, authentication_failure,
card_invalid, network_transient, issuer_outage, risk_flag

Valid actions: retry, delayed_retry, recovery_link, alt_payment_method, escalate, stop

Respond ONLY with valid JSON, no preamble:
{"root_cause": "...", "confidence": 0.0-1.0, "reasoning": "one sentence", "recommended_action": "..."}

Be conservative with confidence. If the context is genuinely ambiguous, use a
lower confidence (below 0.7) rather than guessing — a low-confidence diagnosis
is safely escalated to a human, which is the correct outcome when unsure."""


def build_user_prompt(transaction: dict, in_outage_window: bool) -> str:
    """
    Minimal context only — no raw customer PII (customer_id is already
    hashed upstream per SPEC §21).
    """
    return f"""Transaction context:
- amount: {transaction['amount']} {transaction['currency']}
- payment_method: {transaction['payment_method']}
- issuer: {transaction.get('issuer') or 'N/A (non-card/netbanking method)'}
- failure_code: {transaction.get('failure_code') or 'MISSING'}
- gateway_response_ms: {transaction['gateway_response_ms']}
- attempt_count: {transaction['attempt_count']}
- issuer currently in a detected failure-spike window: {in_outage_window}

Diagnose the root cause."""


class MockLLMClient:
    """
    Deterministic stand-in for Groq, used when no API key / network access
    is available. Applies simple heuristics so the pipeline is fully
    testable end-to-end without a live call. Swapped out for GroqLLMClient
    in production by setting GROQ_API_KEY.
    """

    def diagnose(self, transaction: dict, in_outage_window: bool) -> dict:
        latency = transaction["gateway_response_ms"]
        code = transaction.get("failure_code")

        if in_outage_window and latency > 3000:
            return {"root_cause": "issuer_outage", "confidence": 0.82,
                     "reasoning": "High latency during a detected issuer-wide failure spike window.",
                     "recommended_action": "delayed_retry"}
        if code == "DECLINED" and latency < 1000:
            return {"root_cause": "insufficient_funds", "confidence": 0.62,
                     "reasoning": "Fast decline with no specific code is commonly a funds issue, but code is missing so confidence is moderate.",
                     "recommended_action": "delayed_retry"}
        if code == "UNKNOWN_ERROR" and latency > 3000:
            return {"root_cause": "gateway_timeout", "confidence": 0.58,
                     "reasoning": "Elevated latency suggests a timeout, but the generic error code limits certainty.",
                     "recommended_action": "retry"}
        # genuinely ambiguous fallback — deliberately low confidence -> escalation
        return {"root_cause": "authentication_failure", "confidence": 0.45,
                 "reasoning": "Signal is too weak to confidently attribute a root cause.",
                 "recommended_action": "escalate"}


class GroqLLMClient:
    """Real client — requires `pip install groq` and GROQ_API_KEY set."""

    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        from groq import Groq
        self.client = Groq(api_key=os.environ["GROQ_API_KEY"])
        self.model = model

    def diagnose(self, transaction: dict, in_outage_window: bool) -> dict:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(transaction, in_outage_window)},
            ],
            temperature=0.1,
        )
        text = response.choices[0].message.content
        match = re.search(r"\{.*\}", text, re.DOTALL)
        return json.loads(match.group(0)) if match else {
            "root_cause": "authentication_failure", "confidence": 0.0,
            "reasoning": "LLM response could not be parsed — defaulting to escalation.",
            "recommended_action": "escalate",
        }


def get_llm_client():
    if os.environ.get("GROQ_API_KEY"):
        return GroqLLMClient()
    return MockLLMClient()


def diagnose_by_llm(transaction: dict, in_outage_window: bool, client=None) -> dict:
    client = client or get_llm_client()
    result = client.diagnose(transaction, in_outage_window)

    return {
        "diagnosis_method": "llm_reasoning",
        "predicted_root_cause": result["root_cause"],
        "confidence": float(result["confidence"]),
        "reasoning": result["reasoning"],
        "recommended_action": result["recommended_action"],
    }
