"""Whitelisted operational representations for future API responses."""

PUBLIC_TRANSACTION_FIELDS = (
    "transaction_id", "amount", "currency", "payment_method", "issuer",
    "failure_code", "gateway_response_ms", "attempt_count", "created_at", "status",
)


def public_transaction(transaction: dict) -> dict:
    """Exclude evaluation-only truth and customer identifiers from normal responses."""
    return {field: transaction.get(field) for field in PUBLIC_TRANSACTION_FIELDS}
