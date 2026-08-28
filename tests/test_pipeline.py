"""
RecoverAI — tests for reproducibility and pattern detection (Layer B).

Run from project root:
    pytest tests/test_pipeline.py -v
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from diagnosis_pattern import detect_issuer_outage_windows, attach_outage_context


def make_txn(txn_id, issuer, timestamp):
    return {"transaction_id": txn_id, "issuer": issuer, "created_at": timestamp}


def test_detects_genuine_outage_cluster():
    """A tight cluster of failures from one issuer should be detected."""
    txns = [
        make_txn(f"txn_{i}", "HDFC Bank", f"2026-08-01T10:{i:02d}:00")
        for i in range(10)
    ]
    windows = detect_issuer_outage_windows(txns)
    assert len(windows) == 1
    assert windows[0]["issuer"] == "HDFC Bank"
    assert windows[0]["count"] == 10


def test_scattered_failures_not_detected_as_outage():
    """Failures spread across issuers/times below the cluster threshold should NOT trigger a false outage."""
    txns = [
        make_txn("txn_1", "HDFC Bank", "2026-08-01T10:00:00"),
        make_txn("txn_2", "ICICI Bank", "2026-08-01T11:00:00"),
        make_txn("txn_3", "SBI", "2026-08-01T12:00:00"),
    ]
    windows = detect_issuer_outage_windows(txns)
    assert len(windows) == 0


def test_below_minimum_cluster_size_not_flagged():
    """A few failures from one issuer close together, but below MIN_CLUSTER_SIZE, shouldn't trigger."""
    txns = [
        make_txn(f"txn_{i}", "Axis Bank", f"2026-08-01T10:{i:02d}:00")
        for i in range(3)  # below MIN_CLUSTER_SIZE (8)
    ]
    windows = detect_issuer_outage_windows(txns)
    assert len(windows) == 0


def test_attach_outage_context_flags_correct_transactions():
    txns = [make_txn(f"txn_{i}", "Kotak Mahindra", f"2026-08-01T10:{i:02d}:00") for i in range(10)]
    non_outage = make_txn("txn_other", "Kotak Mahindra", "2026-08-01T15:00:00")

    windows = detect_issuer_outage_windows(txns)
    flagged = attach_outage_context(txns, windows)

    assert all(t["transaction_id"] in flagged for t in txns)
    assert non_outage["transaction_id"] not in flagged


def test_generator_reproducibility():
    """Same seed must produce the same transaction count and distribution
    (SPEC §12 / §20) — regenerating the dataset twice should be identical."""
    import importlib
    import generate_data

    importlib.reload(generate_data)
    txns_1 = generate_data.generate_dataset()

    importlib.reload(generate_data)
    txns_2 = generate_data.generate_dataset()

    assert len(txns_1) == len(txns_2)
    ids_1 = [t["transaction_id"] for t in txns_1]
    ids_2 = [t["transaction_id"] for t in txns_2]
    assert ids_1 == ids_2, "Same seed should produce identical transaction IDs in identical order"

    causes_1 = [t["true_root_cause"] for t in txns_1]
    causes_2 = [t["true_root_cause"] for t in txns_2]
    assert causes_1 == causes_2, "Same seed should produce identical root-cause assignment"


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
