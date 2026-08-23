# RecoverAI — Product & Technical Spec

**Track:** Razorpay AI Buildathon — Track 3: AI Revenue Recovery
**Scenario:** Payment degradation → root cause → recovery action
**Author:** Jagruthi Reddy Pennapu
**Status:** Draft v1

---

## 1. Problem Statement

Merchants lose recoverable revenue every time a payment fails or degrades. Most
systems stop at *detecting* the failure — they log it, maybe alert someone, and
stop. They don't diagnose *why* it failed, don't decide what to do about it, and
don't act. That gap between "we saw the failure" and "we got the money back" is
where revenue quietly leaks.

RecoverAI closes that gap for one well-defined scenario: **payment degradation**
— failed or delayed transactions where the payment attempt itself broke down
somewhere (timeout, decline, auth failure, issuer outage) rather than the
customer abandoning the purchase.

## 2. Goals

- Detect at-risk transactions from a batch of payment events.
- Diagnose the root cause of each failure with an explainable, auditable method.
- Decide on one bounded recovery action per transaction, gated by policy.
- Execute the action (simulated) and record the outcome.
- Report measured recovery (₹), with a full audit trail and honest error analysis.

## 3. Non-Goals (explicitly out of scope for this build)

- Checkout drop-off recovery, failed-subscription recovery, B2B receivables,
  Hinglish voice recovery — related scenarios from the same track, not built here.
  (Noted as a natural extension in the README, not implemented.)
- Real payment gateway integration — all execution is simulated against
  realistic outcome probabilities, not live money movement.
- Real-time/streaming processing — this is a batch pipeline, not a live service,
  though it's designed so that swap is straightforward (see §8).
- Model training / fine-tuning — diagnosis uses a hybrid of deterministic rules
  and an off-the-shelf LLM (Groq/Llama 3.3 70B), not a custom-trained classifier.

## 4. Users & Use Case

Primary user: a merchant's **payments ops / risk team**, reviewing a batch of
failed transactions (e.g. end-of-day or end-of-hour) and wanting to know: what
failed, why, what was done about it, how much was recovered, and what needs a
human's eyes.

## 5. System Overview

```
Transaction batch (CSV/DB)
        │
        ▼
 ① Detection ── filter to at-risk transactions
        │
        ▼
 ② Diagnosis ── rule engine (clear decline codes)
        │         └── LLM reasoning (ambiguous cases) ──► confidence score
        ▼
 ③ Decision ── policy engine: root cause → action, gated by:
        │        retry limits · confidence threshold · idempotency check
        ▼
 ④ Execution ── simulate action outcome (success/fail probabilities)
        │
        ▼
 ⑤ Audit Log ── structured record per transaction, per decision
        │
        ▼
 ⑥ Reporting ── recovery metrics, eval scores, error analysis, escalation queue
```

## 6. Root Cause → Action Policy

| Root cause | Signal | Action | Guardrail |
|---|---|---|---|
| Bank/gateway timeout | High latency, no decline code | Retry (immediate) | Max 2 immediate retries |
| Insufficient funds | Decline code = NSF | Delayed retry | Cooldown 12–24h, max 3 attempts |
| Auth failure (wrong OTP) | Decline code = auth error | Recovery link | One link, 24h expiry |
| Card expired/invalid | Decline code = card error | Alternate payment method | One prompt only |
| Issuer-side outage | Decline spike, same issuer/bin, short window | Delayed retry + escalate if persists | Escalate after 2 failed delayed retries |
| Risk/fraud flag | Decline code = risk block | Escalate to human | No automated action |
| Retry count exceeded | attempts ≥ policy max | Stop per policy | Hard stop, logged as unresolved |
| LLM confidence < threshold | confidence < 0.7 (configurable) | Escalate to human | Overrides LLM's suggested action |

Thresholds and retry limits live in `config/policy.yaml`, not hardcoded — an ops
team could retune behavior without a code change.

## 7. Safety & Compliance Requirements

- **Idempotency**: every action keyed on `(transaction_id, action_type,
  attempt_number)` — checked before execution to guarantee no duplicate charges.
- **Retry limits**: hard cap per root cause, enforced by the policy engine, not
  by convention.
- **Confidence thresholds**: LLM-suggested actions below threshold are
  auto-downgraded to human escalation — the system never blindly trusts the model.
- **Human escalation queue**: a queryable table of pending-review cases with the
  reasoning attached, not a dead-end log line.
- **Audit trail**: every decision (rule-based or LLM-based) is logged as a
  structured record — cause, confidence, reasoning, action, guardrails checked,
  outcome — 100% coverage, queryable via SQL.
- **PII handling**: no raw customer PII sent to the LLM; identifiers are hashed
  before being included in the diagnosis prompt.

## 8. Architecture Notes (for scale, not just the demo)

- **Data layer**: SQLite for the hackathon build (`transactions`,
  `audit_log`, `policy_config`, `escalation_queue` as separate, foreign-keyed
  tables) — swappable for Postgres at production scale.
- **API layer**: FastAPI endpoints (`POST /process-batch`, `GET
  /transaction/{id}`, `GET /audit-log`, `GET /escalations`) — the pipeline is a
  service, not a notebook.
- **Cost control**: the rule engine resolves the majority of clear-cut cases
  without touching the LLM; only ambiguous cases incur an LLM call, so cost
  scales with genuine ambiguity, not batch size.
- **Path to real-time**: batch processing today; a production version would
  consume from a queue (Redis, as in the Qubora ETL architecture) per
  transaction-failure event, with the same detect→diagnose→decide→act pipeline
  applied per message instead of per batch.

## 9. Evaluation Plan

- Synthetic data is generated with **known ground-truth root causes**, so
  diagnosis accuracy can be measured directly, not estimated.
- Metrics reported per root-cause category: precision, recall.
- Two failure modes tracked explicitly (more important than overall accuracy):
  - **False confidence** — agent acted when it should have escalated (dangerous:
    real money risk).
  - **False escalation** — agent punted when a confident automated action was
    correct (costly: unnecessary human load).
- 2–3 misdiagnosed cases pulled out and explained in the final report — root
  cause of *the agent's error*, not just the transaction's failure.

## 10. Success Metrics (what "done" looks like)

- Batch of 500–1,000 simulated transactions processed end-to-end.
- Measured ₹ recovered reported, with recovery rate broken down by root cause
  and action type.
- Diagnosis precision/recall reported per category, not just an aggregate number.
- 0 duplicate charges across the full batch (verified via idempotency check logs).
- 100% audit trail coverage — every transaction traceable from detection to outcome.
- At least one gracefully-handled failure case demonstrated explicitly (e.g. an
  ambiguous transaction correctly escalated rather than mis-actioned).

## 11. Deliverables

- `SPEC.md` (this document)
- Dataset generator (synthetic transactions + injected issuer-outage event)
- Diagnosis + decision + execution pipeline
- SQLite schema + audit log
- Eval harness + error analysis
- FastAPI service layer
- Streamlit dashboard (metrics, transaction table, escalation queue)
- README with architecture, scalability/cost/security notes, and demo instructions
- 5-minute pitch video
