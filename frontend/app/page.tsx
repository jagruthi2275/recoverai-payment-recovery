"use client";

import { useEffect, useState } from "react";

import {
  ApiError,
  getAiOperationsMetrics,
  getIdempotencyMetrics,
  getMetrics,
  getRecoveryByCause,
  type AiOperationsMetrics,
  type IdempotencyMetrics,
  type Metrics,
  type RecoveryByCauseItem,
} from "@/lib/api";

import { MetricCard, Panel } from "@/components/dashboard/metric-card";
import { Sidebar } from "@/components/dashboard/sidebar";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat("en-IN", {
  style: "percent",
  maximumFractionDigits: 1,
});

export default function Home() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [aiMetrics, setAiMetrics] =
    useState<AiOperationsMetrics | null>(null);
  const [idempotency, setIdempotency] =
    useState<IdempotencyMetrics | null>(null);

  const [recoveryByCause, setRecoveryByCause] = useState<
    RecoveryByCauseItem[]
  >([]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          metricsData,
          aiData,
          idempotencyData,
          causeData,
        ] = await Promise.all([
          getMetrics(),
          getAiOperationsMetrics(),
          getIdempotencyMetrics(),
          getRecoveryByCause(),
        ]);

        setMetrics(metricsData);
        setAiMetrics(aiData);
        setIdempotency(idempotencyData);
        setRecoveryByCause(causeData.items);
      } catch (caughtError: unknown) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load RecoverAI dashboard data.",
        );
      }
    }

    loadDashboard();
  }, []);

  /* =========================
     ERROR
  ========================== */

  if (error) {
    return (
      <main className="min-h-screen bg-[#0b0c0f] p-6 text-[#f5f7fb]">
        <div className="mx-auto max-w-xl rounded-xl border border-[#292c35] bg-[#111318] p-8">
          <p className="text-sm font-semibold text-rose-400">
            Backend unavailable
          </p>

          <h1 className="mt-2 text-2xl font-semibold">
            RecoverAI
          </h1>

          <p className="mt-3 text-sm text-[#9ca3b4]">
            {error}
          </p>

          <p className="mt-6 text-xs text-[#6f7788]">
            Make sure the FastAPI server is running on port 8000.
          </p>
        </div>
      </main>
    );
  }

  /* =========================
     LOADING
  ========================== */

  if (!metrics || !aiMetrics || !idempotency) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0b0c0f] text-[#f5f7fb]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#303541] border-t-[#818cf8]" />

          <p className="mt-4 text-sm text-[#8b93a7]">
            Loading RecoverAI...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0c0f] text-[#f5f7fb]">
      <div className="flex min-h-screen">

        {/* =========================
            SIDEBAR
        ========================== */}

        <Sidebar />

        {/* =========================
            MAIN CONTENT
        ========================== */}

        <section className="min-w-0 flex-1">

          {/* =========================
              TOP BAR
          ========================== */}

          <header className="h-14 border-b border-[#282b33] bg-[#0b0c0f]">
            <div className="flex h-full items-center justify-between px-6 lg:px-8">

              {/* Search */}

              <div className="flex h-8 w-64 items-center rounded-md border border-[#292d37] bg-[#101217] px-3">
                <span className="mr-2 text-xs text-[#697184]">
                  ⌕
                </span>

                <span className="text-[11px] text-[#626a7c]">
                  Search transactions, policies...
                </span>
              </div>

              {/* Right side */}

              <div className="flex items-center gap-5">

                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />

                  <span className="text-[10px] font-medium text-emerald-400">
                    System Operational
                  </span>
                </div>

                <span className="text-sm text-[#737b8d]">
                  ♧
                </span>

                <span className="text-sm text-[#737b8d]">
                  ◉
                </span>

              </div>
            </div>
          </header>

          {/* =========================
              DASHBOARD CONTENT
          ========================== */}

          <div className="px-6 py-7 lg:px-8">

            {/* Heading */}

            <div className="mb-6">
              <p className="text-[11px] font-medium text-[#858da0]">
                Revenue Recovery Intelligence
              </p>

              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#f5f7fb]">
                RecoverAI
              </h1>
            </div>

            {/* =========================
                KPI CARDS
            ========================== */}

            <section>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">

                <DarkMetricCard
                  label="TOTAL TRANSACTIONS"
                  value={metrics.total_transactions.toLocaleString(
                    "en-IN",
                  )}
                  accent="default"
                  change="+12%"
                />

                <DarkMetricCard
                  label="TRANSACTIONS AT RISK"
                  value={metrics.at_risk_transactions.toLocaleString(
                    "en-IN",
                  )}
                  accent="risk"
                  badge="Monitoring"
                />

                <DarkMetricCard
                  label="AMOUNT AT RISK"
                  value={formatCompactCurrency(
                    metrics.total_amount_at_risk,
                  )}
                  accent="default"
                />

                <DarkMetricCard
                  label="RECOVERED AMOUNT"
                  value={formatCompactCurrency(
                    metrics.recovered_amount,
                  )}
                  accent="success"
                />

                <DarkMetricCard
                  label="RECOVERY RATE"
                  value={percentageFormatter.format(
                    metrics.recovery_rate,
                  )}
                  accent="default"
                />

              </div>
            </section>

            {/* Small divider / visual breathing space */}

            <div className="flex justify-center py-7">
              <span className="text-xs text-[#4b5261]">
               ⌄
              </span>
            </div>

            {/* =========================
                RECOVERY OVERVIEW
            ========================== */}

            <section className="mb-6">

              <div className="mb-4">
                <h2 className="text-sm font-semibold text-[#e8eaf0]">
                  Recovery overview
                </h2>

                <p className="mt-1 text-xs text-[#737b8d]">
                  Current payment risk and recovery performance.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">

                <DarkMetricCard
                  label="RECOVERED"
                  value={metrics.outcomes.recovered.toLocaleString(
                    "en-IN",
                  )}
                  accent="success"
                />

                <DarkMetricCard
                  label="FAILED"
                  value={metrics.outcomes.failed.toLocaleString(
                    "en-IN",
                  )}
                  accent="risk"
                />

                <DarkMetricCard
                  label="ESCALATED"
                  value={metrics.outcomes.escalated.toLocaleString(
                    "en-IN",
                  )}
                  accent="warning"
                />

                <DarkMetricCard
                  label="STOPPED"
                  value={metrics.outcomes.stopped.toLocaleString(
                    "en-IN",
                  )}
                  accent="default"
                />

              </div>
            </section>

            {/* =========================
                AI + IDEMPOTENCY
            ========================== */}

            <div className="grid gap-4 xl:grid-cols-2">

              {/* AI OPERATIONS */}

              <DarkPanel
                title="AI operations"
                subtitle="How RecoverAI is using diagnosis engines."
              >

                <div className="grid grid-cols-2 gap-3">

                  <DarkMiniMetric
                    label="Total diagnoses"
                    value={aiMetrics.total_diagnoses}
                  />

                  <DarkMiniMetric
                    label="Rule-engine diagnoses"
                    value={aiMetrics.rule_engine_diagnoses}
                  />

                  <DarkMiniMetric
                    label="LLM diagnoses"
                    value={aiMetrics.llm_diagnoses}
                  />

                  <DarkMiniMetric
                    label="LLM calls"
                    value={aiMetrics.llm_calls}
                  />

                </div>

                <div className="mt-4 rounded-lg border border-[#282c35] bg-[#0d0f13] p-4">

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#858da0]">
                      Rule engine
                    </span>

                    <span className="text-xs font-semibold text-[#dce0e8]">
                      {percentageFormatter.format(
                        aiMetrics.rule_percentage,
                      )}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#242834]">
                    <div
                      className="h-full rounded-full bg-[#5059a8]"
                      style={{
                        width: `${Math.min(
                          Math.max(
                            aiMetrics.rule_percentage * 100,
                            0,
                          ),
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-[#858da0]">
                      LLM
                    </span>

                    <span className="text-xs font-semibold text-[#dce0e8]">
                      {percentageFormatter.format(
                        aiMetrics.llm_percentage,
                      )}
                    </span>
                  </div>

                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#242834]">
                    <div
                      className="h-full rounded-full bg-[#818cf8]"
                      style={{
                        width: `${Math.min(
                          Math.max(
                            aiMetrics.llm_percentage * 100,
                            0,
                          ),
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="mt-4 border-t border-[#282c35] pt-3 text-xs">
                    <span className="text-[#687082]">
                      AI cost:{" "}
                    </span>

                    <span className="text-[#b9beca]">
                      {aiMetrics.ai_cost_available &&
                      aiMetrics.ai_cost !== null
                        ? currencyFormatter.format(
                            aiMetrics.ai_cost,
                          )
                        : "Not available"}
                    </span>
                  </div>

                </div>
              </DarkPanel>

              {/* IDEMPOTENCY */}

              <DarkPanel
                title="Idempotency"
                subtitle="Safety check for duplicate recovery actions."
              >

                <div className="grid grid-cols-2 gap-3">

                  <DarkMiniMetric
                    label="Recovery actions"
                    value={idempotency.total_recovery_actions}
                  />

                  <DarkMiniMetric
                    label="Unique keys"
                    value={idempotency.unique_idempotency_keys}
                  />

                  <DarkMiniMetric
                    label="Duplicate actions"
                    value={idempotency.duplicate_count}
                    danger={idempotency.duplicate_count > 0}
                  />

                  <DarkMiniMetric
                    label="Duplicate rate"
                    value={percentageFormatter.format(
                      idempotency.duplicate_rate,
                    )}
                    danger={idempotency.duplicate_count > 0}
                  />

                </div>

                <div
                  className={`mt-4 rounded-lg border p-4 ${
                    idempotency.batch_is_clean
                      ? "border-emerald-900/60 bg-emerald-950/20"
                      : "border-rose-900/60 bg-rose-950/20"
                  }`}
                >

                  <p
                    className={`text-xs font-semibold ${
                      idempotency.batch_is_clean
                        ? "text-emerald-400"
                        : "text-rose-400"
                    }`}
                  >
                    {idempotency.batch_is_clean
                      ? "✓ Batch is clean"
                      : "⚠ Duplicate recovery actions detected"}
                  </p>

                  <p className="mt-1 text-[11px] text-[#727a8c]">
                    RecoverAI checks recovery actions for duplicate
                    execution.
                  </p>

                </div>
              </DarkPanel>
            </div>

            {/* =========================
                ROOT CAUSE
            ========================== */}

            <DarkPanel
              title="Recovery by root cause"
              subtitle="Recovery performance grouped by transaction failure cause."
            >

              {recoveryByCause.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#30343e] bg-[#0d0f13] p-8 text-center">

                  <p className="text-sm font-medium text-[#bfc4cf]">
                    No recovery results yet
                  </p>

                  <p className="mt-1 text-xs text-[#6f7788]">
                    Run the recovery pipeline to populate outcome
                    data.
                  </p>

                </div>
              ) : (
                <div className="overflow-x-auto">

                  <table className="w-full min-w-[720px] text-left text-xs">

                    <thead>
                      <tr className="border-b border-[#292d36] text-[10px] uppercase tracking-wider text-[#697184]">

                        <th className="px-3 py-3 font-medium">
                          Root cause
                        </th>

                        <th className="px-3 py-3 font-medium">
                          Transactions
                        </th>

                        <th className="px-3 py-3 font-medium">
                          Recovered
                        </th>

                        <th className="px-3 py-3 font-medium">
                          Failed
                        </th>

                        <th className="px-3 py-3 font-medium">
                          Escalated / stopped
                        </th>

                        <th className="px-3 py-3 font-medium">
                          Recovery rate
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {recoveryByCause.map((item) => (
                        <tr
                          key={item.root_cause}
                          className="border-b border-[#1d2027] last:border-0"
                        >

                          <td className="px-3 py-3 font-medium text-[#d9dce3]">
                            {item.root_cause}
                          </td>

                          <td className="px-3 py-3 text-[#858da0]">
                            {item.transaction_count}
                          </td>

                          <td className="px-3 py-3 text-emerald-400">
                            {item.recovered_count}
                          </td>

                          <td className="px-3 py-3 text-rose-400">
                            {item.failed_count}
                          </td>

                          <td className="px-3 py-3 text-amber-400">
                            {item.escalated_or_stopped_count}
                          </td>

                          <td className="px-3 py-3 font-medium text-[#cbd0da]">
                            {percentageFormatter.format(
                              item.recovery_rate,
                            )}
                          </td>

                        </tr>
                      ))}

                    </tbody>
                  </table>
                </div>
              )}
            </DarkPanel>

            {/* =========================
                SYSTEM STATUS
            ========================== */}

            <DarkPanel
              title="System status"
              subtitle="RecoverAI V1 service health."
            >

              <div className="grid gap-3 md:grid-cols-3">

                <DarkStatus
                  label="FastAPI backend"
                  status="Operational"
                />

                <DarkStatus
                  label="SQLite database"
                  status="Connected"
                />

                <DarkStatus
                  label="Frontend API"
                  status="Connected"
                />

              </div>

            </DarkPanel>

            <footer className="pb-8 pt-3 text-center text-[10px] text-[#555d6d]">
              RecoverAI V1 • AI-powered payment recovery
            </footer>

          </div>
        </section>
      </div>
    </main>
  );
}


/* =========================================================
   DARK METRIC CARD
========================================================= */

function DarkMetricCard({
  label,
  value,
  accent = "default",
  change,
  badge,
}: {
  label: string;
  value: string | number;
  accent?: "default" | "success" | "risk" | "warning";
  change?: string;
  badge?: string;
}) {
  const accentStyles = {
    default: "bg-[#667085]",
    success: "bg-emerald-400",
    risk: "bg-rose-400",
    warning: "bg-amber-400",
  };

  const valueStyles = {
    default: "text-[#e7e9ef]",
    success: "text-emerald-400",
    risk: "text-[#e7e9ef]",
    warning: "text-[#e7e9ef]",
  };

  return (
    <div className="rounded-md border border-[#252932] bg-[#101216] p-4">

      <div
        className={`mb-3 h-0.5 w-7 rounded-full ${accentStyles[accent]}`}
      />

      <p className="text-[9px] font-medium tracking-wide text-[#737b8d]">
        {label}
      </p>

      <div className="mt-2 flex items-end gap-2">

        <p
          className={`text-xl font-semibold tracking-tight ${valueStyles[accent]}`}
        >
          {value}
        </p>

        {change && (
          <span className="mb-0.5 text-[9px] font-medium text-emerald-400">
            {change}
          </span>
        )}

        {badge && (
          <span className="mb-0.5 rounded-sm border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 text-[8px] text-amber-400">
            {badge}
          </span>
        )}

      </div>
    </div>
  );
}


/* =========================================================
   DARK PANEL
========================================================= */

function DarkPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-4 rounded-md border border-[#292c34] bg-[#111216]">

      <div className="border-b border-[#252830] px-4 py-4">

        <h2 className="text-sm font-semibold text-[#e2e5eb]">
          {title}
        </h2>

        <p className="mt-1 text-[11px] text-[#71798a]">
          {subtitle}
        </p>

      </div>

      <div className="p-4">
        {children}
      </div>

    </section>
  );
}


/* =========================================================
   MINI METRIC
========================================================= */

function DarkMiniMetric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-[#292d35] bg-[#0d0f13] p-3">

      <p className="text-[10px] text-[#70788a]">
        {label}
      </p>

      <p
        className={`mt-2 text-lg font-semibold ${
          danger ? "text-rose-400" : "text-[#dfe2e8]"
        }`}
      >
        {value}
      </p>

    </div>
  );
}


/* =========================================================
   STATUS
========================================================= */

function DarkStatus({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#292d35] bg-[#0d0f13] p-3">

      <span className="text-xs text-[#aeb4c1]">
        {label}
      </span>

      <span className="flex items-center gap-2 text-[10px] font-medium text-emerald-400">

        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

        {status}

      </span>

    </div>
  );
}


/* =========================================================
   COMPACT CURRENCY
========================================================= */

function formatCompactCurrency(value: number) {
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(1)}Cr`;
  }

  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(1)}L`;
  }

  if (value >= 1000) {
    return `₹${(value / 1000).toFixed(1)}k`;
  }

  return currencyFormatter.format(value);
}