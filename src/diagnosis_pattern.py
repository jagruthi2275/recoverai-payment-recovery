"""
RecoverAI — Layer B: pattern detection.

Looks across the batch (not just a single transaction) for issuer-level
failure spikes that indicate a systemic outage rather than an individual
payment problem. Per SPEC §7 / §8 Layer B.

This runs BEFORE per-transaction diagnosis: if a transaction belongs to
a detected outage window, that context is attached so Layer A/C can use
it (e.g. a TIMEOUT during a detected outage window is far more likely
"issuer_outage" than a one-off "gateway_timeout").
"""

from collections import defaultdict
from datetime import datetime, timedelta

BASELINE_FAILURE_RATE = 0.02      # assumed "normal" issuer failure rate
SPIKE_MULTIPLIER = 5.0            # flag as outage if rate exceeds baseline * this
WINDOW_MINUTES = 15
MIN_CLUSTER_SIZE = 8              # minimum failures in-window to call it a pattern, not noise


def detect_issuer_outage_windows(transactions: list) -> list:
    """
    Scan all transactions for issuer + time-window clusters of failures.

    Returns a list of detected outage windows:
      [{"issuer": ..., "window_start": ..., "window_end": ..., "count": ..., "transaction_ids": [...]}]
    """
    by_issuer = defaultdict(list)
    for t in transactions:
        if t.get("issuer"):
            ts = datetime.fromisoformat(t["created_at"])
            by_issuer[t["issuer"]].append((ts, t["transaction_id"]))

    outage_windows = []

    for issuer, events in by_issuer.items():
        events.sort(key=lambda e: e[0])
        n = len(events)
        i = 0
        while i < n:
            window_start = events[i][0]
            window_end = window_start + timedelta(minutes=WINDOW_MINUTES)
            cluster = [events[i]]
            j = i + 1
            while j < n and events[j][0] <= window_end:
                cluster.append(events[j])
                j += 1

            if len(cluster) >= MIN_CLUSTER_SIZE:
                outage_windows.append({
                    "issuer": issuer,
                    "window_start": cluster[0][0].isoformat(),
                    "window_end": cluster[-1][0].isoformat(),
                    "count": len(cluster),
                    "transaction_ids": [c[1] for c in cluster],
                })
                i = j  # skip past this cluster
            else:
                i += 1

    return outage_windows


def attach_outage_context(transactions: list, outage_windows: list) -> dict:
    """
    Returns a set of transaction_ids that fall inside a detected outage window,
    for quick lookup during per-transaction diagnosis.
    """
    flagged = set()
    for window in outage_windows:
        flagged.update(window["transaction_ids"])
    return flagged
