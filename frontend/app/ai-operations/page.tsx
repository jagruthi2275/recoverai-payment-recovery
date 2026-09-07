"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  ApiError,
  getAiOperationsMetrics,
  type AiOperationsMetrics,
} from "@/lib/api";

import { Sidebar } from "@/components/dashboard/sidebar";

const percentageFormatter = new Intl.NumberFormat("en-IN", {
  style: "percent",
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export default function AiOperationsPage() {
  const [metrics, setMetrics] = useState<AiOperationsMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAiOperationsMetrics()
      .then(setMetrics)
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load AI operations data.",
        );
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0c0f] text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1 bg-[#0b0c0f]">
          <header className="h-14 border-b border-[#272a33] bg-[#0d0e11]">
            <div className="flex h-full items-center justify-between px-6">
              <div className="flex h-8 w-80 items-center rounded-md border border-[#292c35] bg-[#111318] px-3">
                <span className="mr-2 text-xs text-slate-600">⌕</span>
                <span className="text-[11px] text-slate-500">
                  Search operational context...
                </span>
              </div>

              <div className="flex items-center gap-5">
                <div className="flex items-center gap-2 text-[10px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  System Operational
                </div>
                <span className="text-sm text-slate-600">•</span>
                <span className="text-sm text-slate-600">◉</span>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-7 py-7">
            {error ? (
              <div className="rounded-lg border border-red-900/60 bg-red-950/20 p-5">
                <p className="text-sm font-semibold text-red-400">
                  Unable to load AI operations
                </p>
                <p className="mt-1 text-xs text-slate-500">{error}</p>
              </div>
            ) : !metrics ? (
              <div className="flex min-h-[400px] items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
                  <p className="mt-4 text-xs text-slate-500">
                    Loading AI operations...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-indigo-400">
                    Revenue Recovery Intelligence
                  </p>
                  <h1 className="text-xl font-semibold tracking-tight text-slate-100">
                    AI Operations Monitor
                  </h1>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Operational view of RecoverAI&apos;s diagnosis engines.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Link
                    href="/transactions"
                    className="group rounded-lg border border-[#242730] bg-[#111318] p-4 transition hover:-translate-y-0.5 hover:border-[#3a3f50] hover:shadow-lg"
                  >
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">
                      Total diagnoses
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {metrics.total_diagnoses.toLocaleString("en-IN")}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-600">
                      Recorded diagnosis decisions
                    </p>
                  </Link>

                  <Link
                    href="/transactions?search=rule_engine"
                    className="group rounded-lg border border-[#242730] bg-[#111318] p-4 transition hover:-translate-y-0.5 hover:border-indigo-500/50 hover:shadow-lg"
                  >
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">
                      Rule engine
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {metrics.rule_engine_diagnoses.toLocaleString("en-IN")}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#252936]">
                        <div
                          className="h-full rounded-full bg-indigo-500"
                          style={{
                            width: `${Math.min(
                              Math.max(metrics.rule_percentage * 100, 0),
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500">
                        {percentageFormatter.format(metrics.rule_percentage)}
                      </span>
                    </div>
                  </Link>

                  <Link
                    href="/transactions?search=llm"
                    className="group rounded-lg border border-[#242730] bg-[#111318] p-4 transition hover:-translate-y-0.5 hover:border-indigo-400/50 hover:shadow-lg"
                  >
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">
                      LLM reasoning
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {metrics.llm_diagnoses.toLocaleString("en-IN")}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#252936]">
                        <div
                          className="h-full rounded-full bg-indigo-300"
                          style={{
                            width: `${Math.min(
                              Math.max(metrics.llm_percentage * 100, 0),
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-500">
                        {percentageFormatter.format(metrics.llm_percentage)}
                      </span>
                    </div>
                  </Link>

                  <div className="rounded-lg border border-[#242730] bg-[#111318] p-4">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">
                      LLM inference cost
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {metrics.ai_cost_available && metrics.ai_cost !== null
                        ? currencyFormatter.format(metrics.ai_cost)
                        : "N/A"}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-600">
                      {metrics.ai_cost_available
                        ? "Recorded AI usage cost"
                        : "Cost data unavailable"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-[#242730] bg-[#111318]">
                  <div className="border-b border-[#242730] px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-200">
                          Diagnosis mix
                        </h2>
                        <p className="mt-1 text-[10px] text-slate-500">
                          Actual distribution of recorded diagnosis methods.
                        </p>
                      </div>

                      <Link
                        href="/transactions"
                        className="rounded-md border border-[#292c35] px-3 py-2 text-[9px] font-medium text-slate-400 transition hover:border-indigo-500/60 hover:text-indigo-300"
                      >
                        View transactions →
                      </Link>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="h-4 overflow-hidden rounded-full bg-[#252936]">
                      <div className="flex h-full w-full">
                        <div
                          className="h-full bg-indigo-600 transition-all"
                          style={{
                            width: `${Math.min(
                              Math.max(metrics.rule_percentage * 100, 0),
                              100,
                            )}%`,
                          }}
                        />
                        <div
                          className="h-full bg-indigo-300 transition-all"
                          style={{
                            width: `${Math.min(
                              Math.max(metrics.llm_percentage * 100, 0),
                              100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 grid gap-5 md:grid-cols-3">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">
                          Total diagnoses
                        </p>
                        <p className="mt-1 text-lg font-semibold text-slate-200">
                          {metrics.total_diagnoses.toLocaleString("en-IN")}
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm bg-indigo-600" />
                          <p className="text-[9px] uppercase tracking-wider text-slate-500">
                            Rule engine
                          </p>
                        </div>
                        <p className="mt-1 text-lg font-semibold text-indigo-300">
                          {metrics.rule_engine_diagnoses.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-slate-600">
                          {percentageFormatter.format(metrics.rule_percentage)}{" "}
                          of diagnoses
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-sm bg-indigo-300" />
                          <p className="text-[9px] uppercase tracking-wider text-slate-500">
                            LLM reasoning
                          </p>
                        </div>
                        <p className="mt-1 text-lg font-semibold text-indigo-200">
                          {metrics.llm_diagnoses.toLocaleString("en-IN")}
                        </p>
                        <p className="text-[9px] text-slate-600">
                          {percentageFormatter.format(metrics.llm_percentage)}{" "}
                          of diagnoses
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <Link
                    href="/transactions?search=rule_engine"
                    className="group rounded-lg border border-[#242730] bg-[#111318] p-5 transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-indigo-400">
                          Deterministic layer
                        </p>
                        <h2 className="mt-1 text-sm font-semibold text-slate-200">
                          Rule Engine Activity
                        </h2>
                      </div>
                      <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-300">
                        →
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-slate-500">
                      Inspect rule-driven diagnoses and high-confidence paths
                      handled without generative reasoning.
                    </p>
                  </Link>

                  <Link
                    href="/transactions?search=llm"
                    className="group rounded-lg border border-[#242730] bg-[#111318] p-5 transition hover:-translate-y-0.5 hover:border-indigo-400/60 hover:shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-indigo-300">
                          Reasoning layer
                        </p>
                        <h2 className="mt-1 text-sm font-semibold text-slate-200">
                          LLM Activity
                        </h2>
                      </div>
                      <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-indigo-300">
                        →
                      </span>
                    </div>
                    <p className="mt-3 text-[10px] leading-5 text-slate-500">
                      Review transactions that required model-based reasoning,
                      including ambiguous and edge-case diagnosis paths.
                    </p>
                  </Link>
                </div>

                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-emerald-900/60 bg-emerald-950/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">
                      {metrics.llm_calls > 0
                        ? "LLM diagnosis is active"
                        : "No LLM activity recorded"}
                    </p>
                    <p className="mt-1 text-[9px] text-slate-500">
                      LLM usage is recorded separately from rule-engine
                      diagnosis.
                    </p>
                  </div>

                  {metrics.llm_calls > 0 && (
                    <Link
                      href="/evaluation"
                      className="rounded-md border border-emerald-800 bg-[#111318] px-3 py-2 text-[9px] font-medium text-emerald-400 transition hover:border-emerald-500"
                    >
                      View evaluation →
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
