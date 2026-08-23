"""
RecoverAI — synthetic transaction generator.

Produces failed/degraded payment transactions with a HIDDEN ground-truth
root cause (true_root_cause) plus the OBSERVED signal (failure_code,
gateway_response_ms, etc.) that the diagnosis layer actually sees.

Design choices (per spec discussion):
- 800 transactions total.
- Root causes distributed realistically (NSF and timeouts most common,
  issuer outages and risk flags rarer).
- ~70% of transactions get clean/unambiguous failure codes -> resolvable by
  Layer A rules. ~30% get noisy/missing signals -> must go to Layer C (LLM).
- One deliberately injected issuer-outage cluster: a burst of failures from
  a single issuer within a short time window (SPEC §7 / §12).
- Fixed random seed (42, matches config/policy.yaml) for reproducibility
  (SPEC §12 / §20).
"""

import csv
import hashlib
import random
import sqlite3
import uuid
from datetime import datetime, timedelta

SEED = 42
random.seed(SEED)

N_TRANSACTIONS = 800
import os
_SRC_DIR = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.join(_SRC_DIR, "..")

DB_PATH = os.path.join(_ROOT, "db", "recoverai.db")
SCHEMA_PATH = os.path.join(_ROOT, "db", "schema.sql")
CSV_PATH = os.path.join(_ROOT, "data", "transactions.csv")

ISSUERS = ["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank", "Kotak Mahindra", "Yes Bank", "IDFC First"]
PAYMENT_METHODS = ["card", "upi", "netbanking", "wallet"]

# root_cause -> (weight, failure_code, typical_latency_ms_range)
ROOT_CAUSE_PROFILES = {
    "insufficient_funds":      {"weight": 0.28, "code": "NSF",            "latency": (100, 400)},
    "gateway_timeout":         {"weight": 0.22, "code": "TIMEOUT",        "latency": (4000, 9000)},
    "authentication_failure":  {"weight": 0.16, "code": "AUTH_FAILED",    "latency": (200, 600)},
    "card_invalid":            {"weight": 0.12, "code": "CARD_EXPIRED",   "latency": (100, 300)},
    "network_transient":       {"weight": 0.10, "code": "NETWORK_ERROR",  "latency": (2000, 5000)},
    "risk_flag":               {"weight": 0.06, "code": "RISK_BLOCK",     "latency": (150, 350)},
    "issuer_outage":           {"weight": 0.06, "code": "TIMEOUT",        "latency": (5000, 12000)},
}

CAUSES = list(ROOT_CAUSE_PROFILES.keys())
WEIGHTS = [ROOT_CAUSE_PROFILES[c]["weight"] for c in CAUSES]


def hash_customer_id(raw_id: str) -> str:
    """PII hashing per SPEC §21 — raw customer identifiers never stored in the clear."""
    return hashlib.sha256(raw_id.encode()).hexdigest()[:16]


def random_timestamp(base: datetime, spread_hours: int = 72) -> datetime:
    return base + timedelta(minutes=random.randint(0, spread_hours * 60))


def make_transaction(base_time: datetime, forced_cause: str = None, forced_issuer: str = None,
                      forced_timestamp: datetime = None) -> dict:
    true_cause = forced_cause or random.choices(CAUSES, weights=WEIGHTS, k=1)[0]
    profile = ROOT_CAUSE_PROFILES[true_cause]

    txn_id = f"txn_{uuid.uuid4().hex[:12]}"
    amount = round(random.uniform(150, 45000), 2)
    method = random.choice(PAYMENT_METHODS)
    issuer = forced_issuer or (random.choice(ISSUERS) if method in ("card", "netbanking") else None)
    latency = random.randint(*profile["latency"])
    attempt_count = random.choices([1, 2, 3], weights=[0.7, 0.22, 0.08], k=1)[0]
    ts = forced_timestamp or random_timestamp(base_time)
    is_outage_case = forced_cause == "issuer_outage"

    # ~30% of transactions get noisy/ambiguous observed signal, regardless of true cause:
    # failure_code withheld or replaced with a generic code, forcing Layer C (LLM) reasoning
    # over context (latency, attempt history, issuer pattern) instead of a clean lookup.
    is_ambiguous = random.random() < 0.30
    if is_ambiguous:
        failure_code = random.choice([None, "DECLINED", "UNKNOWN_ERROR"])
    else:
        failure_code = profile["code"]

    return {
        "transaction_id": txn_id,
        "amount": amount,
        "currency": "INR",
        "payment_method": method,
        "issuer": issuer,
        "failure_code": failure_code,
        "gateway_response_ms": latency,
        "attempt_count": attempt_count,
        "customer_id_hash": hash_customer_id(f"cust_{uuid.uuid4().hex[:8]}"),
        "created_at": ts.isoformat(),
        "status": "degraded" if latency > 3000 else "failed",
        "true_root_cause": true_cause,
        "is_issuer_outage_case": int(is_outage_case),
        "is_ambiguous": int(is_ambiguous),
    }


def generate_issuer_outage_cluster(base_time: datetime, issuer: str, n: int = 22) -> list:
    """
    Inject a burst of issuer_outage failures from a single issuer within a tight
    15-minute window — the pattern-detection moment described in SPEC §7/§12.
    """
    window_start = base_time + timedelta(hours=30)  # mid-batch, so it's discoverable, not edge case
    cluster = []
    for _ in range(n):
        ts = window_start + timedelta(minutes=random.randint(0, 15))
        cluster.append(make_transaction(base_time, forced_cause="issuer_outage",
                                         forced_issuer=issuer, forced_timestamp=ts))
    return cluster


def generate_dataset() -> list:
    base_time = datetime(2026, 8, 1, 0, 0, 0)
    outage_issuer = "ICICI Bank"
    cluster = generate_issuer_outage_cluster(base_time, outage_issuer, n=22)

    n_regular = N_TRANSACTIONS - len(cluster)
    regular = [make_transaction(base_time) for _ in range(n_regular)]

    all_txns = regular + cluster
    random.shuffle(all_txns)
    return all_txns


def write_csv(transactions: list, path: str):
    fieldnames = list(transactions[0].keys())
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(transactions)


def write_db(transactions: list, db_path: str, schema_path: str):
    conn = sqlite3.connect(db_path)
    with open(schema_path) as f:
        conn.executescript(f.read())

    cols = list(transactions[0].keys())
    placeholders = ", ".join(["?"] * len(cols))
    col_str = ", ".join(cols)
    rows = [tuple(t[c] for c in cols) for t in transactions]
    conn.executemany(f"INSERT INTO transactions ({col_str}) VALUES ({placeholders})", rows)

    # seed policy_config from policy.yaml equivalent (hardcoded here to avoid a yaml dep at gen time;
    # the pipeline reads config/policy.yaml directly at runtime — this mirrors it for DB-side queries)
    policies = [
        ("gateway_timeout", "retry", 2, 0, 0.7),
        ("network_transient", "retry", 2, 0, 0.7),
        ("insufficient_funds", "delayed_retry", 3, 18, 0.7),
        ("authentication_failure", "recovery_link", 1, 0, 0.7),
        ("card_invalid", "alt_payment_method", 1, 0, 0.7),
        ("issuer_outage", "delayed_retry", 2, 1, 0.75),
        ("risk_flag", "escalate", 0, 0, 0.0),
    ]
    conn.executemany(
        "INSERT INTO policy_config (root_cause, action, max_attempts, cooldown_hours, min_confidence) "
        "VALUES (?, ?, ?, ?, ?)", policies
    )

    conn.commit()
    conn.close()


def print_summary(transactions: list):
    from collections import Counter
    causes = Counter(t["true_root_cause"] for t in transactions)
    ambiguous = sum(t["is_ambiguous"] for t in transactions)
    outage = sum(t["is_issuer_outage_case"] for t in transactions)
    total_amount = sum(t["amount"] for t in transactions)

    print(f"Generated {len(transactions)} transactions (seed={SEED})")
    print(f"Total revenue at risk: ₹{total_amount:,.2f}")
    print(f"Ambiguous signal (routes to LLM): {ambiguous} ({ambiguous/len(transactions):.1%})")
    print(f"Clean signal (resolved by rules): {len(transactions)-ambiguous} ({(len(transactions)-ambiguous)/len(transactions):.1%})")
    print(f"Issuer outage cluster transactions: {outage}")
    print("\nRoot cause distribution (ground truth):")
    for cause, count in causes.most_common():
        print(f"  {cause:28s} {count:4d}  ({count/len(transactions):.1%})")


if __name__ == "__main__":
    txns = generate_dataset()
    print_summary(txns)
    write_csv(txns, CSV_PATH)
    write_db(txns, DB_PATH, SCHEMA_PATH)
    print(f"\nWrote CSV -> {CSV_PATH}")
    print(f"Wrote DB  -> {DB_PATH}")
