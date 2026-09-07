"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  ApiError,
  getRecoveryByCause,
  type RecoveryByCauseItem,
} from "@/lib/api";

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

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function RecoveryPage() {
  const [items, setItems] = useState<RecoveryByCauseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRecovery() {
      try {
        const data = await getRecoveryByCause();
        setItems(data.items);
      } catch (caughtError: unknown) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load recovery data.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadRecovery();
  }, []);

  const totalTransactions = items.reduce(
    (sum, item) => sum + item.transaction_count,
    0,
  );

  const totalRecovered = items.reduce(
    (sum, item) => sum + item.recovered_count,
    0,
  );

  const totalFailed = items.reduce(
    (sum, item) => sum + item.failed_count,
    0,
  );

  const totalEscalated = items.reduce(
    (sum, item) => sum + item.escalated_or_stopped_count,
    0,
  );

  const totalRecoveredAmount = items.reduce(
    (sum, item) => sum + item.recovered_amount,
    0,
  );

  const overallRecoveryRate =
    totalTransactions > 0
      ? totalRecovered / totalTransactions
      : 0;

  const highestRecoveryCause =
    items.length > 0
      ? [...items].sort(
          (a, b) => b.recovery_rate - a.recovery_rate,
        )[0]
      : null;

  const maxTransactions =
    items.length > 0
      ? Math.max(...items.map((item) => item.transaction_count))
      : 1;

  return (
    <main className="min-h-screen bg-[#0b0c0f] text-[#f5f7fb]">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1">
          {/* TOP BAR */}
          <header className="h-14 border-b border-[#282b33] bg-[#0b0c0f]">
            <div className="flex h-full items-center justify-between px-6 lg:px-8">
              <div className="flex h-8 w-64 items-center rounded-md border border-[#292d37] bg-[#101217] px-3">
                <span className="mr-2 text-xs text-[#697184]">
                  ⌕
                </span>

                <span className="text-[11px] text-[#626a7c]">
                  Search recovering entities, tx IDs...
                </span>
              </div>

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

          {/* PAGE */}
          <div className="px-6 py-7 lg:px-8">
            {/* HEADER */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-medium text-[#858da0]">
                  Revenue Recovery Intelligence
                </p>

                <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#f5f7fb]">
                  Recovery Performance
                </h1>

                <p className="mt-1 text-xs text-[#737b8d]">
                  Real-time metrics and active recovery workflows.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-md border border-[#292d37] bg-[#101217] px-3 py-1.5 text-[10px] text-[#9da4b4]">
                  1H
                </button>

                <button className="rounded-md border border-[#818cf8] bg-[#17192a] px-3 py-1.5 text-[10px] font-medium text-[#a5b4fc]">
                  24H
                </button>

                <button className="rounded-md border border-[#292d37] bg-[#101217] px-3 py-1.5 text-[10px] text-[#9da4b4]">
                  7D
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#303541] border-t-[#818cf8]" />
              </div>
            ) : error ? (
              <div className="rounded-md border border-rose-900/60 bg-rose-950/20 p-6">
                <p className="text-sm font-semibold text-rose-400">
                  Unable to load recovery data
                </p>

                <p className="mt-2 text-xs text-[#9ca3b4]">
                  {error}
                </p>
              </div>
            ) : (
              <>
                {/* TOP METRICS */}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <DarkMetric
                    label="NET RECOVERY RATE"
                    value={percentageFormatter.format(
                      overallRecoveryRate,
                    )}
                    detail={`${totalRecovered.toLocaleString(
                      "en-IN",
                    )} recovered cases`}
                    accent="success"
                  />

                  <DarkMetric
                    label="TOTAL RECOVERED"
                    value={currencyFormatter.format(
                      totalRecoveredAmount,
                    )}
                    detail={`${totalRecovered.toLocaleString(
                      "en-IN",
                    )} successful operations`}
                    accent="success"
                  />

                  <div className="rounded-md border border-[#292c34] bg-[#111216] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[9px] font-medium tracking-wide text-[#737b8d]">
                        OUTCOME DISTRIBUTION
                      </span>

                      <span className="text-[9px] text-[#697184]">
                        {totalTransactions.toLocaleString("en-IN")} cases
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Outcome
                        label="Recovered"
                        value={totalRecovered}
                        tone="success"
                      />

                      <Outcome
                        label="Failed"
                        value={totalFailed}
                        tone="risk"
                      />

                      <Outcome
                        label="Escalated"
                        value={totalEscalated}
                        tone="warning"
                      />

                      <Outcome
                        label="Stopped"
                        value={0}
                        tone="default"
                      />
                    </div>
                  </div>
                </div>

                {/* MAIN CONTENT */}
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  {/* ROOT CAUSE */}
                  <section className="rounded-md border border-[#292c34] bg-[#111216]">
                    <div className="border-b border-[#252830] px-4 py-4">
                      <h2 className="text-sm font-semibold text-[#e2e5eb]">
                        Recovery by root cause
                      </h2>

                      <p className="mt-1 text-[11px] text-[#71798a]">
                        Distribution of recovery cases by failure diagnosis.
                      </p>
                    </div>

                    <div className="p-4">
                      {items.length === 0 ? (
                        <div className="py-10 text-center text-xs text-[#697184]">
                          No recovery results yet.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {items.map((item) => {
                            const width =
                              (item.transaction_count /
                                maxTransactions) *
                              100;

                            return (
                              <div key={item.root_cause}>
                                <div className="mb-1 flex items-center justify-between">
                                  <span className="text-[11px] text-[#cbd0da]">
                                    {formatLabel(item.root_cause)}
                                  </span>

                                  <span className="text-[10px] text-[#737b8d]">
                                    {percentageFormatter.format(
                                      item.transaction_count /
                                        Math.max(totalTransactions, 1),
                                    )}
                                  </span>
                                </div>

                                <div className="h-1.5 overflow-hidden rounded-full bg-[#242834]">
                                  <div
                                    className="h-full rounded-full bg-[#737cff]"
                                    style={{
                                      width: `${Math.min(
                                        Math.max(width, 2),
                                        100,
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="mt-1 flex items-center justify-between">
                                  <span className="text-[9px] text-[#697184]">
                                    {item.transaction_count.toLocaleString(
                                      "en-IN",
                                    )}{" "}
                                    transactions
                                  </span>

                                  <span className="text-[9px] text-emerald-400">
                                    {percentageFormatter.format(
                                      item.recovery_rate,
                                    )}{" "}
                                    recovery
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* RECENT ACTIONS */}
                  <section className="rounded-md border border-[#292c34] bg-[#111216]">
                    <div className="flex items-center justify-between border-b border-[#252830] px-4 py-4">
                      <div>
                        <h2 className="text-sm font-semibold text-[#e2e5eb]">
                          Recovery pipeline
                        </h2>

                        <p className="mt-1 text-[11px] text-[#71798a]">
                          Current recovery diagnosis and outcomes.
                        </p>
                      </div>

                      <span className="text-[9px] text-[#697184]">
                        View All →
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[10px]">
                        <thead>
                          <tr className="border-b border-[#252830] text-[9px] uppercase tracking-wide text-[#697184]">
                            <th className="px-4 py-3 font-medium">
                              Root Cause
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Cases
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Recovered
                            </th>

                            <th className="px-3 py-3 font-medium">
                              Rate
                            </th>

                            <th className="px-4 py-3 font-medium">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {items.slice(0, 6).map((item) => (
                            <tr
                              key={item.root_cause}
                              className="border-b border-[#1d2027] last:border-0"
                            >
                              <td className="px-4 py-3">
                                <p className="font-medium text-[#d9dce3]">
                                  {formatLabel(item.root_cause)}
                                </p>

                                <p className="mt-0.5 text-[9px] text-[#697184]">
                                  Recovery diagnosis
                                </p>
                              </td>

                              <td className="px-3 py-3 text-[#9da4b4]">
                                {item.transaction_count.toLocaleString(
                                  "en-IN",
                                )}
                              </td>

                              <td className="px-3 py-3 text-emerald-400">
                                {item.recovered_count.toLocaleString(
                                  "en-IN",
                                )}
                              </td>

                              <td className="px-3 py-3 text-[#cbd0da]">
                                {percentageFormatter.format(
                                  item.recovery_rate,
                                )}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={
                                    item.recovery_rate >= 0.7
                                      ? "rounded-sm border border-emerald-900/60 bg-emerald-950/30 px-2 py-1 text-[8px] text-emerald-400"
                                      : item.recovery_rate >= 0.4
                                        ? "rounded-sm border border-amber-900/60 bg-amber-950/30 px-2 py-1 text-[8px] text-amber-400"
                                        : "rounded-sm border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[8px] text-rose-400"
                                  }
                                >
                                  {item.recovery_rate >= 0.7
                                    ? "Recovered"
                                    : item.recovery_rate >= 0.4
                                      ? "Monitoring"
                                      : "Review"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>

                {/* BEST PERFORMING CAUSE */}
                <section className="mt-4 rounded-md border border-[#292c34] bg-[#111216]">
                  <div className="border-b border-[#252830] px-4 py-4">
                    <h2 className="text-sm font-semibold text-[#e2e5eb]">
                      Recovery insights
                    </h2>

                    <p className="mt-1 text-[11px] text-[#71798a]">
                      Operational signals from the current recovery batch.
                    </p>
                  </div>

                  <div className="grid gap-3 p-4 md:grid-cols-3">
                    <Insight
                      label="TOTAL CASES"
                      value={totalTransactions.toLocaleString("en-IN")}
                      detail="Recovery cases processed"
                    />

                    <Insight
                      label="FAILED"
                      value={totalFailed.toLocaleString("en-IN")}
                      detail="Recovery attempts requiring attention"
                      tone="risk"
                    />

                    <Insight
                      label="TOP RECOVERY CAUSE"
                      value={
                        highestRecoveryCause
                          ? formatLabel(
                              highestRecoveryCause.root_cause,
                            )
                          : "—"
                      }
                      detail={
                        highestRecoveryCause
                          ? `${percentageFormatter.format(
                              highestRecoveryCause.recovery_rate,
                            )} recovery rate`
                          : "No recovery data"
                      }
                      tone="success"
                    />
                  </div>
                </section>

                {/* SYSTEM STATUS */}
                <section className="mt-4 rounded-md border border-[#292c34] bg-[#111216]">
                  <div className="border-b border-[#252830] px-4 py-4">
                    <h2 className="text-sm font-semibold text-[#e2e5eb]">
                      System status
                    </h2>

                    <p className="mt-1 text-[11px] text-[#71798a]">
                      RecoverAI V1 service health.
                    </p>
                  </div>

                  <div className="grid gap-3 p-4 md:grid-cols-3">
                    <StatusItem
                      label="FastAPI backend"
                      status="Operational"
                    />

                    <StatusItem
                      label="SQLite database"
                      status="Connected"
                    />

                    <StatusItem
                      label="Frontend API"
                      status="Connected"
                    />
                  </div>
                </section>

                <footer className="pb-8 pt-4 text-center text-[10px] text-[#555d6d]">
                  RecoverAI V1 • AI-powered payment recovery
                </footer>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   METRIC
========================================================= */

function DarkMetric({
  label,
  value,
  detail,
  accent = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  accent?: "default" | "success" | "risk";
}) {
  const accentColor =
    accent === "success"
      ? "bg-emerald-400"
      : accent === "risk"
        ? "bg-rose-400"
        : "bg-[#667085]";

  const valueColor =
    accent === "success"
      ? "text-emerald-400"
      : "text-[#e7e9ef]";

  return (
    <div className="rounded-md border border-[#292c34] bg-[#111216] p-4">
      <div
        className={`mb-3 h-0.5 w-7 rounded-full ${accentColor}`}
      />

      <p className="text-[9px] font-medium tracking-wide text-[#737b8d]">
        {label}
      </p>

      <p
        className={`mt-2 text-xl font-semibold tracking-tight ${valueColor}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[9px] text-[#697184]">
        {detail}
      </p>
    </div>
  );
}

/* =========================================================
   OUTCOME
========================================================= */

function Outcome({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "risk" | "warning" | "default";
}) {
  const dot =
    tone === "success"
      ? "bg-emerald-400"
      : tone === "risk"
        ? "bg-rose-400"
        : tone === "warning"
          ? "bg-amber-400"
          : "bg-[#667085]";

  return (
    <div className="flex items-center justify-between rounded-sm border border-[#252830] bg-[#0d0f13] px-3 py-2">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />

        <span className="text-[9px] text-[#858da0]">
          {label}
        </span>
      </div>

      <span className="text-[11px] font-semibold text-[#dfe2e8]">
        {value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

/* =========================================================
   INSIGHT
========================================================= */

function Insight({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "default" | "success" | "risk";
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-400"
      : tone === "risk"
        ? "text-rose-400"
        : "text-[#e2e5eb]";

  return (
    <div className="rounded-md border border-[#292d35] bg-[#0d0f13] p-3">
      <p className="text-[9px] uppercase tracking-wide text-[#70788a]">
        {label}
      </p>

      <p
        className={`mt-2 text-lg font-semibold ${valueColor}`}
      >
        {value}
      </p>

      <p className="mt-1 text-[9px] text-[#697184]">
        {detail}
      </p>
    </div>
  );
}

/* =========================================================
   STATUS
========================================================= */

function StatusItem({
  label,
  status,
}: {
  label: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#292d35] bg-[#0d0f13] p-3">
      <span className="text-[10px] text-[#aeb4c1]">
        {label}
      </span>

      <span className="flex items-center gap-2 text-[9px] font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

        {status}
      </span>
    </div>
  );
}