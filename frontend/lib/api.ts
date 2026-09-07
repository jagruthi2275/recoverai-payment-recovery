const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export type RecoveryOutcome = "recovered" | "failed" | "escalated" | "stopped";

export interface Metrics {
  total_transactions: number;
  at_risk_transactions: number;
  total_amount_at_risk: number;
  recovered_amount: number;
  recovery_rate: number;
  outcomes: Record<RecoveryOutcome, number>;
}

export interface AiOperationsMetrics {
  total_diagnoses: number;
  rule_engine_diagnoses: number;
  llm_diagnoses: number;
  rule_percentage: number;
  llm_percentage: number;
  llm_calls: number;
  ai_cost: number | null;
  ai_cost_available: boolean;
}

export interface IdempotencyMetrics {
  total_recovery_actions: number;
  unique_idempotency_keys: number;
  duplicate_count: number;
  duplicate_rate: number;
  batch_is_clean: boolean;
}

export interface RecoveryByCauseItem {
  root_cause: string;
  transaction_count: number;
  recovered_count: number;
  failed_count: number;
  escalated_or_stopped_count: number;
  recovered_amount: number;
  recovery_rate: number;
}

export interface TransactionSummary {
  transaction_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  issuer: string;
  failure_code: string | null;
  gateway_response_ms: number | null;
  attempt_count: number;
  created_at: string;
  status: string;
  diagnosis_method: string | null;
  root_cause: string | null;
  confidence: number | null;
  final_action: string | null;
  outcome: string | null;
  recovered_amount: number;
}

export interface ListResponse<T> {
  items: T[];
  limit: number;
  offset: number;
}

export interface TransactionDetail {
  transaction: Record<string, unknown>;
  diagnosis: Record<string, unknown> | null;
  recovery_action: Record<string, unknown> | null;
  audit_trail: Array<Record<string, unknown>>;
  escalations: Array<Record<string, unknown>>;
}

export interface Evaluation {
  run_at: string | null;
  results: Array<Record<string, unknown>>;
  safety: Record<string, number>;
  error_analysis: { misdiagnosed_count: number };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface TransactionParams extends PaginationParams {
  outcome?: string;
  root_cause?: string;
}

export interface EscalationParams extends PaginationParams {
  review_status?: string;
}

export interface AuditLogParams extends PaginationParams {
  transaction_id?: string;
  event_type?: string;
}

async function request<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`);
  } catch {
    throw new ApiError(`Unable to reach RecoverAI API at ${API_BASE_URL}.`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "detail" in body) {
        detail = `: ${String(body.detail)}`;
      }
    } catch {
      // Non-JSON responses still receive a useful HTTP status message.
    }
    throw new ApiError(`RecoverAI API request failed (${response.status})${detail}`, response.status);
  }
  return response.json() as Promise<T>;
}

function withQuery<T extends object>(
  path: string,
  params: T = {} as T,
): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      query.set(key, String(value));
    }
  }

  const search = query.toString();

  return search ? `${path}?${search}` : path;
}


export const getMetrics = () =>
  request<Metrics>("/api/metrics");

export const getAiOperationsMetrics = () =>
  request<AiOperationsMetrics>("/api/metrics/ai-operations");

export const getIdempotencyMetrics = () =>
  request<IdempotencyMetrics>("/api/metrics/idempotency");

export const getRecoveryByCause = () =>
  request<{ items: RecoveryByCauseItem[] }>(
    "/api/recovery-by-cause",
  );

export const getTransactions = (
  params: TransactionParams = {},
) =>
  request<ListResponse<TransactionSummary>>(
    withQuery("/api/transactions", params),
  );

export const getTransaction = (transactionId: string) =>
  request<TransactionDetail>(
    `/api/transactions/${encodeURIComponent(transactionId)}`,
  );

export const getEscalations = (
  params: EscalationParams = {},
) =>
  request<ListResponse<Record<string, unknown>>>(
    withQuery("/api/escalations", params),
  );

export const getEvaluation = () =>
  request<Evaluation>("/api/evaluation");

export const getAuditLog = (
  params: AuditLogParams = {},
) =>
  request<ListResponse<Record<string, unknown>>>(
    withQuery("/api/audit-log", params),
  );