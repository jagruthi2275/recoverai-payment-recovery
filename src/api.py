"""Read-only FastAPI interface for RecoverAI operational data."""

import json
import os
import sqlite3
from contextlib import contextmanager
from typing import Iterator

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .database import DEFAULT_DB_PATH
from .metrics import get_dashboard_metrics
from .transaction_views import PUBLIC_TRANSACTION_FIELDS, public_transaction


class ItemList(BaseModel):
    items: list[dict]
    limit: int
    offset: int


class IdempotencyMetrics(BaseModel):
    total_recovery_actions: int
    unique_idempotency_keys: int
    duplicate_count: int
    duplicate_rate: float
    batch_is_clean: bool


def _parse_json(value):
    if value is None:
        return None
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return value


@contextmanager
def _read_connection(db_path: str) -> Iterator[sqlite3.Connection]:
    """Open a read-only connection; API requests can never run the pipeline."""
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
    finally:
        connection.close()


def _latest_case_query() -> str:
    fields = ", ".join(f"t.{field}" for field in PUBLIC_TRANSACTION_FIELDS)
    return f"""
        SELECT {fields}, d.diagnosis_id, d.diagnosis_method, d.predicted_root_cause,
               d.confidence, d.reasoning, d.recommended_action, d.diagnosed_at,
               ra.action_id, ra.action_type, ra.attempt_number, ra.idempotency_key,
               ra.policy_checks_passed, ra.executed_at, ra.outcome, ra.recovered_amount
        FROM transactions t
        LEFT JOIN diagnoses d ON d.diagnosis_id = (
            SELECT diagnosis_id FROM diagnoses
            WHERE transaction_id = t.transaction_id ORDER BY diagnosis_id DESC LIMIT 1
        )
        LEFT JOIN recovery_actions ra ON ra.action_id = (
            SELECT action_id FROM recovery_actions
            WHERE transaction_id = t.transaction_id ORDER BY action_id DESC LIMIT 1
        )
    """


def _case_summary(row: sqlite3.Row) -> dict:
    item = public_transaction(dict(row))
    item.update({
        "diagnosis_method": row["diagnosis_method"],
        "root_cause": row["predicted_root_cause"],
        "confidence": row["confidence"],
        "final_action": row["action_type"],
        "outcome": row["outcome"],
        "recovered_amount": row["recovered_amount"] or 0.0,
    })
    return item


def create_app(db_path: str | None = None) -> FastAPI:
    """Create an API app bound to a SQLite database without mutating it."""
    active_db_path = db_path or DEFAULT_DB_PATH
    app = FastAPI(title="RecoverAI API", version="1.0.0", description="Read-only RecoverAI V1 API")

    raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
    if raw_origins.strip():
        origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    else:
        origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["*"],
    )

    @app.get("/api/metrics")
    def metrics() -> dict:
        with _read_connection(active_db_path) as conn:
            data = get_dashboard_metrics(conn)
        return {
            "total_transactions": data["total_transactions"],
            "at_risk_transactions": data["at_risk_transactions"],
            "total_amount_at_risk": data["total_amount_at_risk"],
            "recovered_amount": data["recovered_amount"],
            "recovery_rate": data["recovery_rate"],
            "outcomes": data["outcomes"],
        }

    @app.get("/api/metrics/ai-operations")
    def ai_operations() -> dict:
        with _read_connection(active_db_path) as conn:
            total, rules, llm = conn.execute("""
                SELECT COUNT(*),
                       SUM(CASE WHEN diagnosis_method = 'rule_engine' THEN 1 ELSE 0 END),
                       SUM(CASE WHEN diagnosis_method = 'llm_reasoning' THEN 1 ELSE 0 END)
                FROM diagnoses
            """).fetchone()
        rules, llm = int(rules or 0), int(llm or 0)
        return {
            "total_diagnoses": total,
            "rule_engine_diagnoses": rules,
            "llm_diagnoses": llm,
            "rule_percentage": rules / total if total else 0.0,
            "llm_percentage": llm / total if total else 0.0,
            "llm_calls": llm,
            "ai_cost": None,
            "ai_cost_available": False,
        }

    @app.get("/api/metrics/idempotency", response_model=IdempotencyMetrics)
    def idempotency() -> IdempotencyMetrics:
        with _read_connection(active_db_path) as conn:
            total, unique_keys = conn.execute(
                "SELECT COUNT(*), COUNT(DISTINCT idempotency_key) FROM recovery_actions"
            ).fetchone()
        duplicates = total - unique_keys
        return IdempotencyMetrics(
            total_recovery_actions=total, unique_idempotency_keys=unique_keys,
            duplicate_count=duplicates, duplicate_rate=duplicates / total if total else 0.0,
            batch_is_clean=duplicates == 0,
        )

    @app.get("/api/recovery-by-cause")
    def recovery_by_cause() -> dict:
        with _read_connection(active_db_path) as conn:
            rows = conn.execute("""
                SELECT d.predicted_root_cause AS root_cause, COUNT(*) AS transaction_count,
                       SUM(CASE WHEN ra.outcome = 'recovered' THEN 1 ELSE 0 END) AS recovered_count,
                       SUM(CASE WHEN ra.outcome = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                       SUM(CASE WHEN ra.outcome IN ('escalated', 'stopped') THEN 1 ELSE 0 END) AS escalated_or_stopped_count,
                       COALESCE(SUM(ra.recovered_amount), 0) AS recovered_amount
                FROM recovery_actions ra JOIN diagnoses d ON d.diagnosis_id = ra.diagnosis_id
                GROUP BY d.predicted_root_cause ORDER BY d.predicted_root_cause
            """).fetchall()
        return {"items": [{
            **dict(row), "recovery_rate": row["recovered_count"] / row["transaction_count"]
            if row["transaction_count"] else 0.0,
        } for row in rows]}

    @app.get("/api/transactions", response_model=ItemList)
    def transactions(
        outcome: str | None = None,
        root_cause: str | None = None,
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> ItemList:
        filters, params = [], []
        if outcome:
            filters.append("ra.outcome = ?")
            params.append(outcome)
        if root_cause:
            filters.append("d.predicted_root_cause = ?")
            params.append(root_cause)
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with _read_connection(active_db_path) as conn:
            rows = conn.execute(
                f"{_latest_case_query()} {where} ORDER BY t.created_at DESC LIMIT ? OFFSET ?",
                [*params, limit, offset],
            ).fetchall()
        return ItemList(items=[_case_summary(row) for row in rows], limit=limit, offset=offset)

    @app.get("/api/transactions/{transaction_id}")
    def transaction_detail(transaction_id: str) -> dict:
        with _read_connection(active_db_path) as conn:
            row = conn.execute(f"{_latest_case_query()} WHERE t.transaction_id = ?", (transaction_id,)).fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Transaction not found")
            transaction_data = public_transaction(dict(row))
            diagnosis = None if row["diagnosis_id"] is None else {
                "diagnosis_id": row["diagnosis_id"], "method": row["diagnosis_method"],
                "root_cause": row["predicted_root_cause"], "confidence": row["confidence"],
                "reasoning": row["reasoning"], "recommended_action": row["recommended_action"],
                "diagnosed_at": row["diagnosed_at"],
            }
            action = None if row["action_id"] is None else {
                "action_id": row["action_id"], "action_type": row["action_type"],
                "attempt_number": row["attempt_number"], "idempotency_key": row["idempotency_key"],
                "guardrail_checks": _parse_json(row["policy_checks_passed"]), "executed_at": row["executed_at"],
                "outcome": row["outcome"], "recovered_amount": row["recovered_amount"],
            }
            audit = [{**dict(event), "detail": _parse_json(event["detail"])} for event in conn.execute("""
                SELECT log_id, timestamp, event_type, from_state, to_state, detail
                FROM audit_log WHERE transaction_id = ? ORDER BY log_id
            """, (transaction_id,))]
            escalations = [dict(escalation) for escalation in conn.execute("""
                SELECT escalation_id, diagnosis_id, amount, reason, escalated_at, review_status, reviewer_note
                FROM escalation_queue WHERE transaction_id = ? ORDER BY escalation_id
            """, (transaction_id,))]
        return {"transaction": transaction_data, "diagnosis": diagnosis, "recovery_action": action,
                "audit_trail": audit, "escalations": escalations}

    @app.get("/api/escalations", response_model=ItemList)
    def escalations(
        review_status: str | None = None,
        limit: int = Query(default=50, ge=1, le=200),
        offset: int = Query(default=0, ge=0),
    ) -> ItemList:
        where, params = ("WHERE e.review_status = ?", [review_status]) if review_status else ("", [])
        with _read_connection(active_db_path) as conn:
            rows = conn.execute(f"""
                SELECT e.escalation_id, e.transaction_id, e.diagnosis_id, e.amount, e.reason,
                       e.escalated_at, e.review_status, e.reviewer_note, d.predicted_root_cause,
                       d.confidence, d.reasoning
                FROM escalation_queue e LEFT JOIN diagnoses d ON d.diagnosis_id = e.diagnosis_id
                {where} ORDER BY e.escalated_at DESC LIMIT ? OFFSET ?
            """, [*params, limit, offset]).fetchall()
        return ItemList(items=[dict(row) for row in rows], limit=limit, offset=offset)

    @app.get("/api/evaluation")
    def evaluation() -> dict:
        with _read_connection(active_db_path) as conn:
            latest_run = conn.execute("SELECT MAX(run_at) FROM evaluation_results").fetchone()[0]
            results = [] if latest_run is None else [dict(row) for row in conn.execute("""
                SELECT root_cause, precision, recall, f1_score, support, run_at
                FROM evaluation_results WHERE run_at = ? ORDER BY root_cause
            """, (latest_run,))]
            total, false_confidence, false_escalation, misdiagnosed = conn.execute("""
                SELECT COUNT(*),
                  SUM(CASE WHEN t.true_root_cause != d.predicted_root_cause
                            AND ra.outcome NOT IN ('escalated', 'stopped') THEN 1 ELSE 0 END),
                  SUM(CASE WHEN t.true_root_cause = d.predicted_root_cause
                            AND ra.outcome IN ('escalated', 'stopped') THEN 1 ELSE 0 END),
                  SUM(CASE WHEN t.true_root_cause != d.predicted_root_cause THEN 1 ELSE 0 END)
                FROM recovery_actions ra
                JOIN diagnoses d ON d.diagnosis_id = ra.diagnosis_id
                JOIN transactions t ON t.transaction_id = ra.transaction_id
            """).fetchone()
        false_confidence, false_escalation, misdiagnosed = (
            int(false_confidence or 0), int(false_escalation or 0), int(misdiagnosed or 0)
        )
        return {
            "run_at": latest_run, "results": results,
            "safety": {"total_evaluated": total, "false_confidence_count": false_confidence,
                       "false_confidence_rate": false_confidence / total if total else 0.0,
                       "false_escalation_count": false_escalation,
                       "false_escalation_rate": false_escalation / total if total else 0.0},
            "error_analysis": {"misdiagnosed_count": misdiagnosed},
        }

    @app.get("/api/audit-log", response_model=ItemList)
    def audit_log(
        transaction_id: str | None = None,
        event_type: str | None = None,
        limit: int = Query(default=100, ge=1, le=500),
        offset: int = Query(default=0, ge=0),
    ) -> ItemList:
        filters, params = [], []
        if transaction_id:
            filters.append("transaction_id = ?")
            params.append(transaction_id)
        if event_type:
            filters.append("event_type = ?")
            params.append(event_type)
        where = f"WHERE {' AND '.join(filters)}" if filters else ""
        with _read_connection(active_db_path) as conn:
            rows = conn.execute(f"""
                SELECT log_id, transaction_id, timestamp, event_type, from_state, to_state, detail
                FROM audit_log {where} ORDER BY log_id DESC LIMIT ? OFFSET ?
            """, [*params, limit, offset]).fetchall()
        return ItemList(items=[{**dict(row), "detail": _parse_json(row["detail"])} for row in rows],
                        limit=limit, offset=offset)

    return app


app = create_app()
