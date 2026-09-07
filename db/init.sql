-- Safe runtime initialization. This file is intentionally non-destructive.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS transactions (
    transaction_id TEXT PRIMARY KEY, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'INR',
    payment_method TEXT NOT NULL, issuer TEXT, failure_code TEXT, gateway_response_ms INTEGER,
    attempt_count INTEGER NOT NULL DEFAULT 1, customer_id_hash TEXT NOT NULL, created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'failed', true_root_cause TEXT NOT NULL,
    is_issuer_outage_case INTEGER NOT NULL DEFAULT 0, is_ambiguous INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS diagnoses (
    diagnosis_id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT NOT NULL REFERENCES transactions(transaction_id),
    diagnosis_method TEXT NOT NULL, predicted_root_cause TEXT NOT NULL, confidence REAL NOT NULL,
    reasoning TEXT, recommended_action TEXT NOT NULL, diagnosed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recovery_actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT NOT NULL REFERENCES transactions(transaction_id),
    diagnosis_id INTEGER NOT NULL REFERENCES diagnoses(diagnosis_id), action_type TEXT NOT NULL,
    attempt_number INTEGER NOT NULL DEFAULT 1, idempotency_key TEXT NOT NULL UNIQUE,
    policy_checks_passed TEXT NOT NULL, executed_at TEXT NOT NULL, outcome TEXT NOT NULL,
    recovered_amount REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT NOT NULL REFERENCES transactions(transaction_id),
    timestamp TEXT NOT NULL, event_type TEXT NOT NULL, from_state TEXT, to_state TEXT NOT NULL, detail TEXT
);
CREATE TABLE IF NOT EXISTS escalation_queue (
    escalation_id INTEGER PRIMARY KEY AUTOINCREMENT, transaction_id TEXT NOT NULL REFERENCES transactions(transaction_id),
    diagnosis_id INTEGER REFERENCES diagnoses(diagnosis_id), amount REAL NOT NULL, reason TEXT NOT NULL,
    escalated_at TEXT NOT NULL, review_status TEXT NOT NULL DEFAULT 'pending', reviewer_note TEXT
);
CREATE TABLE IF NOT EXISTS policy_config (
    root_cause TEXT PRIMARY KEY, action TEXT NOT NULL, max_attempts INTEGER NOT NULL,
    cooldown_hours REAL NOT NULL DEFAULT 0, min_confidence REAL NOT NULL DEFAULT 0.7
);
CREATE TABLE IF NOT EXISTS evaluation_results (
    eval_id INTEGER PRIMARY KEY AUTOINCREMENT, root_cause TEXT NOT NULL, precision REAL,
    recall REAL, f1_score REAL, support INTEGER, run_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_diagnoses_txn ON diagnoses(transaction_id);
CREATE INDEX IF NOT EXISTS idx_actions_txn ON recovery_actions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_txn ON audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_escalation_status ON escalation_queue(review_status);
