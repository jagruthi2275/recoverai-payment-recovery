"use client";

import { useEffect, useMemo, useState } from "react";
import { ApiError, getEvaluation, type Evaluation } from "@/lib/api";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function EvaluationPage() {
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  useEffect(() => {
    getEvaluation()
      .then(setEvaluation)
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load evaluation data.",
        );
      });
  }, []);

  const safetyEntries = useMemo(
    () => (evaluation ? Object.entries(evaluation.safety) : []),
    [evaluation],
  );

  const totalEvaluated =
    evaluation?.safety.total_evaluated ??
    evaluation?.safety.total_evaluations ??
    null;

  const falseConfidenceCount =
    evaluation?.safety.false_confidence_count ?? null;

  const falseEscalationCount =
    evaluation?.safety.false_escalation_count ?? null;

  const falseConfidenceRate =
    evaluation?.safety.false_confidence_rate ?? null;

  const falseEscalationRate =
    evaluation?.safety.false_escalation_rate ?? null;

  const scrollToResults = () => {
    document
      .getElementById("evaluation-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="min-h-screen bg-[#090b0f] text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1">
          <header className="border-b border-[#242833] bg-[#090b0f]">
            <div className="mx-auto max-w-[1280px] px-6 py-5 lg:px-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">
                Revenue Recovery Intelligence
              </p>
              <div className="mt-1 flex items-end justify-between gap-6">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-white">
                    Evaluation
                  </h1>
                  <p className="mt-1 text-sm text-slate-400">
                    Measure diagnosis accuracy and safety of automated recovery decisions.
                  </p>
                </div>

                {evaluation?.run_at ? (
                  <div className="hidden text-right sm:block">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">
                      Last evaluation run
                    </p>
                    <p className="mt-1 text-xs text-slate-300">
                      {new Date(evaluation.run_at).toLocaleString("en-IN")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1280px] space-y-5 px-6 py-6 lg:px-8">
            {error ? (
              <div className="rounded-xl border border-rose-900/70 bg-rose-950/20 p-5">
                <p className="text-sm font-semibold text-rose-300">
                  Unable to load evaluation
                </p>
                <p className="mt-1 text-sm text-slate-400">{error}</p>
              </div>
            ) : !evaluation ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-[#242833] bg-[#101217]">
                <div className="text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
                  <p className="mt-4 text-sm text-slate-500">
                    Loading evaluation...
                  </p>
                </div>
              </div>
            ) : (
              <>
                <section className="rounded-xl border border-[#242833] bg-[#101217]">
                  <div className="border-b border-[#242833] px-5 py-4">
                    <h2 className="text-sm font-semibold text-white">
                      Evaluation overview
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Current quality and safety signals from the evaluation pipeline.
                    </p>
                  </div>

                  <div className="grid gap-px bg-[#242833] sm:grid-cols-2 lg:grid-cols-4">
                    <Metric
                      label="Total evaluated"
                      value={formatValue(totalEvaluated)}
                      detail="Transactions evaluated"
                      tone="neutral"
                      onClick={
                        totalEvaluated !== null
                          ? () => setSelectedMetric("total_evaluated")
                          : undefined
                      }
                    />
                    <Metric
                      label="Misdiagnosed"
                      value={String(evaluation.error_analysis.misdiagnosed_count)}
                      detail="Incorrect diagnosis"
                      tone={
                        evaluation.error_analysis.misdiagnosed_count > 0
                          ? "danger"
                          : "success"
                      }
                      onClick={() => setSelectedMetric("misdiagnosed")}
                    />
                    <Metric
                      label="False confidence"
                      value={formatValue(falseConfidenceCount)}
                      detail={
                        falseConfidenceRate !== null
                          ? `${formatPercent(falseConfidenceRate)} rate`
                          : "Safety metric"
                      }
                      tone={
                        falseConfidenceCount === 0 ? "success" : "warning"
                      }
                      onClick={
                        falseConfidenceCount !== null
                          ? () => setSelectedMetric("false_confidence_count")
                          : undefined
                      }
                    />
                    <Metric
                      label="False escalation"
                      value={formatValue(falseEscalationCount)}
                      detail={
                        falseEscalationRate !== null
                          ? `${formatPercent(falseEscalationRate)} rate`
                          : "Safety metric"
                      }
                      tone={
                        falseEscalationCount === 0 ? "success" : "warning"
                      }
                      onClick={
                        falseEscalationCount !== null
                          ? () => setSelectedMetric("false_escalation_count")
                          : undefined
                      }
                    />
                  </div>
                </section>

                <section className="rounded-xl border border-[#242833] bg-[#101217]">
                  <div className="border-b border-[#242833] px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-semibold text-white">
                          Safety checks
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Metrics reported directly by the evaluation pipeline.
                        </p>
                      </div>
                      <span className="rounded-md border border-emerald-900/70 bg-emerald-950/30 px-2 py-1 text-[10px] font-medium text-emerald-400">
                        Evaluation active
                      </span>
                    </div>
                  </div>

                  {safetyEntries.length === 0 ? (
                    <div className="p-10 text-center">
                      <p className="text-sm font-medium text-slate-300">
                        No safety metrics available
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Run the evaluation pipeline to populate safety data.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                      {safetyEntries.map(([key, value]) => {
                        const isRate = key.includes("rate");
                        const numericValue =
                          typeof value === "number" ? value : null;
                        const displayValue = isRate
                          ? formatPercent(numericValue)
                          : formatValue(value);

                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setSelectedMetric(key)}
                            className="group rounded-lg border border-[#292e39] bg-[#0d0f14] p-4 text-left transition-colors hover:border-indigo-500/50 hover:bg-[#11141b]"
                          >
                            <div className="mb-3 h-1 w-7 rounded-full bg-slate-600 transition-colors group-hover:bg-indigo-400" />
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                              {formatLabel(key)}
                            </p>
                            <p className="mt-1 text-xl font-semibold text-white">
                              {displayValue}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-600">
                              Reported by evaluation
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-xl border border-[#242833] bg-[#101217]">
                  <div className="border-b border-[#242833] px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-sm font-semibold text-white">
                          Evaluation results
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                          Detailed checks returned by the evaluation endpoint.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={scrollToResults}
                        className="hidden text-[11px] text-indigo-400 hover:text-indigo-300 sm:block"
                      >
                        View results ↓
                      </button>
                    </div>
                  </div>

                  <div id="evaluation-results">
                    {evaluation.results.length === 0 ? (
                      <div className="p-8">
                        <div className="rounded-lg border border-dashed border-[#303542] bg-[#0d0f14] p-8 text-center">
                          <p className="text-sm font-medium text-slate-300">
                            No detailed evaluation results yet
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            The summary above reflects the evaluation data currently available.
                          </p>

                          <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-4">
                            <MiniStat
                              label="Evaluated"
                              value={formatValue(totalEvaluated)}
                            />
                            <MiniStat
                              label="Misdiagnosed"
                              value={String(
                                evaluation.error_analysis.misdiagnosed_count,
                              )}
                              tone="danger"
                            />
                            <MiniStat
                              label="False confidence"
                              value={formatValue(falseConfidenceCount)}
                            />
                            <MiniStat
                              label="False escalation"
                              value={formatValue(falseEscalationCount)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                          <thead>
                            <tr className="border-b border-[#292e39] bg-[#0d0f14] text-[10px] uppercase tracking-wider text-slate-500">
                              <th className="px-5 py-3 font-medium">Check</th>
                              <th className="px-5 py-3 font-medium">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {evaluation.results.map((result, index) => (
                              <tr
                                key={index}
                                className="border-b border-[#20242d] last:border-0 hover:bg-[#12151b]"
                              >
                                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-300">
                                  Evaluation {index + 1}
                                </td>
                                <td className="px-5 py-4">
                                  <pre className="whitespace-pre-wrap break-words text-xs leading-5 text-slate-500">
                                    {JSON.stringify(result, null, 2)}
                                  </pre>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      </div>

      {selectedMetric && evaluation ? (
        <MetricModal
          metric={selectedMetric}
          evaluation={evaluation}
          onClose={() => setSelectedMetric(null)}
        />
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
  onClick?: () => void;
}) {
  const accent =
    tone === "success"
      ? "bg-emerald-400"
      : tone === "warning"
        ? "bg-amber-400"
        : tone === "danger"
          ? "bg-rose-500"
          : "bg-slate-500";

  const valueClass =
    tone === "success"
      ? "text-emerald-400"
      : tone === "danger"
        ? "text-rose-400"
        : "text-white";

  const content = (
    <>
      <div className={`mb-4 h-1 w-7 rounded-full ${accent}`} />
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-600">{detail}</p>
    </>
  );

  if (!onClick) {
    return <div className="bg-[#101217] p-4">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-[#101217] p-4 text-left transition-colors hover:bg-[#13161d]"
    >
      {content}
    </button>
  );
}

function MiniStat({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "danger";
}) {
  return (
    <div className="rounded-md border border-[#292e39] bg-[#101217] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">
        {label}
      </p>
      <p
        className={`mt-1 text-lg font-semibold ${
          tone === "danger" ? "text-rose-400" : "text-slate-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function MetricModal({
  metric,
  evaluation,
  onClose,
}: {
  metric: string;
  evaluation: Evaluation;
  onClose: () => void;
}) {
  const title = formatLabel(metric);

  const body = (() => {
    switch (metric) {
      case "misdiagnosed":
        return (
          <>
            RecoverAI recorded{" "}
            <strong>{evaluation.error_analysis.misdiagnosed_count}</strong>{" "}
            misdiagnosed transactions during evaluation.
          </>
        );
      case "total_evaluated":
      case "total_evaluations":
        return (
          <>
            <strong>
              {formatValue(
                evaluation.safety.total_evaluated ??
                  evaluation.safety.total_evaluations,
              )}
            </strong>{" "}
            transactions were evaluated by the pipeline.
          </>
        );
      case "false_confidence_count":
        return (
          <>
            The evaluation pipeline reported{" "}
            <strong>
              {formatValue(evaluation.safety.false_confidence_count)}
            </strong>{" "}
            false-confidence cases.
          </>
        );
      case "false_escalation_count":
        return (
          <>
            The evaluation pipeline reported{" "}
            <strong>
              {formatValue(evaluation.safety.false_escalation_count)}
            </strong>{" "}
            false-escalation cases.
          </>
        );
      default: {
        const value = (
          evaluation.safety as Record<string, unknown>
        )[metric];

        return (
          <>
            The evaluation pipeline reported{" "}
            <strong>
              {metric.includes("rate")
                ? formatPercent(typeof value === "number" ? value : null)
                : formatValue(value)}
            </strong>{" "}
            for this metric.
          </>
        );
      }
    }
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#303542] bg-[#101217] p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
              Evaluation metric
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-slate-500 hover:bg-[#181b22] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mt-5 rounded-lg border border-[#292e39] bg-[#0d0f14] p-4 text-sm leading-6 text-slate-400">
          {body}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 rounded-md border border-[#303542] bg-[#151820] px-4 py-2 text-sm font-medium text-slate-200 hover:bg-[#1b1f28]"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return String(value);
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return "N/A";
  return `${(value * 100).toFixed(2)}%`;
}
