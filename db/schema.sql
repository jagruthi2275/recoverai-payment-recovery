-- RecoverAI schema — per SPEC.md §13
PRAGMA foreign_keys = ON;

-- ============================================================
-- transactions: raw payment events as they arrive (observed signal only)
-- ============================================================
DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    transaction_id      TEXT PRIMARY KEY,
    amount               REAL NOT NULL,
    currency              TEXT NOT NULL DEFAULT 'INR',
    payment_method        TEXT NOT NULL,          -- card, upi, netbanking, wallet
    issuer                TEXT,                    -- bank/issuer name, nullable (e.g. UPI)
    failure_code           TEXT,                    -- observed decline code; NULL if ambiguous
    gateway_response_ms    INTEGER,                 -- latency signal
    attempt_count           INTEGER NOT NULL DEFAULT 1,
    customer_id_hash        TEXT NOT NULL,           -- PII hashed per SPEC §21
    created_at               TEXT NOT NULL,           -- ISO timestamp
    status                    TEXT NOT NULL DEFAULT 'failed',  -- failed / degraded

    -- ground truth (hidden from diagnosis layer, used only for eval — SPEC §15)
    true_root_cause           TEXT NOT NULL,
    is_issuer_outage_case     INTEGER NOT NULL DEFAULT 0,  -- flag for injected cluster
    is_ambiguous              INTEGER NOT NULL DEFAULT 0   -- signal-noise flag, drives Layer A vs Layer C routing
);

-- ============================================================
-- diagnoses: output of the hybrid diagnosis layer (rules / pattern / LLM)
-- ============================================================
DROP TABLE IF EXISTS diagnoses;
CREATE TABLE diagnoses (
    diagnosis_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id        TEXT NOT NULL REFERENCES transactions(transaction_id),
    diagnosis_method       TEXT NOT NULL,     -- rule_engine / pattern_detection / llm_reasoning
    predicted_root_cause    TEXT NOT NULL,
    confidence               REAL NOT NULL,     -- 0.0–1.0
    reasoning                 TEXT,              -- explanation (rule name or LLM reasoning text)
    recommended_action         TEXT NOT NULL,
    diagnosed_at                 TEXT NOT NULL
);

-- ============================================================
-- recovery_actions: what the policy engine decided to actually do
-- ============================================================
DROP TABLE IF EXISTS recovery_actions;
CREATE TABLE recovery_actions (
    action_id             INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id          TEXT NOT NULL REFERENCES transactions(transaction_id),
    diagnosis_id             INTEGER NOT NULL REFERENCES diagnoses(diagnosis_id),
    action_type               TEXT NOT NULL,    -- retry / delayed_retry / recovery_link / alt_payment_method / escalate / stop
    attempt_number             INTEGER NOT NULL DEFAULT 1,
    idempotency_key             TEXT NOT NULL UNIQUE,   -- (transaction_id, action_type, attempt_number)
    policy_checks_passed         TEXT NOT NULL,   -- JSON: {confidence_check, retry_check, idempotency_check, policy_check}
    executed_at                    TEXT NOT NULL,
    outcome                          TEXT NOT NULL,   -- recovered / failed / escalated / stopped
    recovered_amount                  REAL NOT NULL DEFAULT 0
);

-- ============================================================
-- audit_log: complete structured trace per SPEC §14 — one row per event
-- ============================================================
DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
    log_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id          TEXT NOT NULL REFERENCES transactions(transaction_id),
    timestamp                 TEXT NOT NULL,
    event_type                 TEXT NOT NULL,   -- state_transition / guardrail_check / action_executed / escalation
    from_state                   TEXT,
    to_state                       TEXT NOT NULL,
    detail                           TEXT             -- JSON blob with event-specific detail
);

-- ============================================================
-- escalation_queue: human-in-the-loop review queue, per SPEC §17
-- ============================================================
DROP TABLE IF EXISTS escalation_queue;
CREATE TABLE escalation_queue (
    escalation_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id           TEXT NOT NULL REFERENCES transactions(transaction_id),
    diagnosis_id               INTEGER REFERENCES diagnoses(diagnosis_id),
    amount                       REAL NOT NULL,
    reason                         TEXT NOT NULL,  -- e.g. low_confidence / risk_flag / issuer_outage_persisted
    escalated_at                     TEXT NOT NULL,
    review_status                      TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / rejected / overridden
    reviewer_note                        TEXT
);

-- ============================================================
-- policy_config: externalized thresholds, per SPEC §9 — config-driven, not hardcoded
-- ============================================================
DROP TABLE IF EXISTS policy_config;
CREATE TABLE policy_config (
    root_cause             TEXT PRIMARY KEY,
    action                   TEXT NOT NULL,
    max_attempts               INTEGER NOT NULL,
    cooldown_hours               REAL NOT NULL DEFAULT 0,
    min_confidence                  REAL NOT NULL DEFAULT 0.7
);

-- ============================================================
-- evaluation_results: precision/recall/F1 per root cause, per SPEC §15
-- ============================================================
DROP TABLE IF EXISTS evaluation_results;
CREATE TABLE evaluation_results (
    eval_id                INTEGER PRIMARY KEY AUTOINCREMENT,
    root_cause               TEXT NOT NULL,
    precision                  REAL,
    recall                       REAL,
    f1_score                       REAL,
    support                          INTEGER,      -- number of ground-truth cases
    run_at                             TEXT NOT NULL
);

CREATE INDEX idx_diagnoses_txn ON diagnoses(transaction_id);
CREATE INDEX idx_actions_txn ON recovery_actions(transaction_id);
CREATE INDEX idx_audit_txn ON audit_log(transaction_id);
CREATE INDEX idx_escalation_status ON escalation_queue(review_status);
