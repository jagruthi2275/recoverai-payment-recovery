"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  ApiError,
  getTransactions,
  type TransactionSummary,
} from "@/lib/api";

import { Sidebar } from "@/components/dashboard/sidebar";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLabel(value: string | null | undefined) {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function outcomeBadge(outcome: string | null) {
  if (!outcome) {
    return "border-slate-700 bg-slate-900 text-slate-400";
  }

  const value = outcome.toLowerCase();

  if (value === "recovered") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  }

  if (value === "failed") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-400";
  }

  if (value === "escalated") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-400";
  }

  if (value === "stopped") {
    return "border-slate-700 bg-slate-800 text-slate-400";
  }

  return "border-indigo-500/40 bg-indigo-500/10 text-indigo-400";
}

function statusBadge(status: string | null) {
  if (!status) {
    return "border-slate-700 bg-slate-900 text-slate-400";
  }

  const value = status.toLowerCase();

  if (value === "recovered") {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";
  }

  if (value === "failed") {
    return "border-rose-500/40 bg-rose-500/10 text-rose-400";
  }

  if (value === "escalated") {
    return "border-amber-500/40 bg-amber-500/10 text-amber-400";
  }

  if (value === "stopped") {
    return "border-slate-700 bg-slate-800 text-slate-400";
  }

  return "border-indigo-500/40 bg-indigo-500/10 text-indigo-400";
}

function DetailCard({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-[#111318] p-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <div className="mt-2 text-sm font-medium text-slate-100">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#101216]">
      <div className="border-b border-slate-800 px-5 py-4">
        <h2 className="text-sm font-semibold text-slate-100">
          {title}
        </h2>

        {subtitle && (
          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="p-5">
        {children}
      </div>
    </section>
  );
}

function FlowStep({
  number,
  title,
  value,
  tone = "default",
}: {
  number: string;
  title: string;
  value: string;
  tone?: "default" | "danger" | "success" | "warning";
}) {
  const toneClasses = {
    default:
      "border-indigo-500/40 bg-indigo-500/10 text-indigo-400",
    danger:
      "border-rose-500/40 bg-rose-500/10 text-rose-400",
    success:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    warning:
      "border-amber-500/40 bg-amber-500/10 text-amber-400",
  };

  return (
    <div className="flex min-w-0 flex-1 items-center">
      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${toneClasses[tone]}`}
        >
          {number}
        </div>

        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          {title}
        </p>

        <p className="mt-1 max-w-[120px] truncate text-xs font-medium text-slate-200">
          {value}
        </p>
      </div>

      <div className="mb-8 h-px flex-1 bg-slate-800" />
    </div>
  );
}

export default function TransactionDetailsPage() {
  const params = useParams();

  const transactionId = decodeURIComponent(
    String(params.transactionId ?? ""),
  );

  const [transaction, setTransaction] =
    useState<TransactionSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTransaction() {
      try {
        const response = await getTransactions({
          limit: 200,
          offset: 0,
        });

        const found = response.items.find(
          (item) => item.transaction_id === transactionId,
        );

        if (!found) {
          setError("Transaction not found.");
          return;
        }

        setTransaction(found);
      } catch (caughtError: unknown) {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load transaction details.",
        );
      } finally {
        setLoading(false);
      }
    }

    if (transactionId) {
      loadTransaction();
    }
  }, [transactionId]);

  return (
    <main className="min-h-screen bg-[#0b0d10] text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1">
          {/* TOP BAR */}
          <header className="border-b border-slate-800 bg-[#0b0d10]">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3 lg:px-8">
              <Link
                href="/transactions"
                className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
              >
                <span className="text-base">←</span>
                Back to Transactions
              </Link>

              <div className="hidden items-center gap-3 sm:flex">
                <span className="text-xs font-semibold text-slate-300">
                  RecoverAI
                </span>

                <span className="h-1 w-1 rounded-full bg-slate-700" />

                <span className="text-[10px] uppercase tracking-[0.15em] text-slate-600">
                  Revenue Operations
                </span>
              </div>
            </div>
          </header>

          {/* PAGE */}
          <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
            {/* TITLE */}
            <div className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-indigo-400">
                  RecoverAI Operations
                </p>

                <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">
                  Transaction Details
                </h1>

                <p className="mt-1 font-mono text-xs text-slate-500">
                  {transactionId}
                </p>
              </div>

              {transaction && (
                <div
                  className={`self-start rounded-full border px-3 py-1.5 text-xs font-medium ${outcomeBadge(
                    transaction.outcome,
                  )}`}
                >
                  {formatLabel(transaction.outcome ?? "Pending")}
                </div>
              )}
            </div>

            <div className="mt-6 space-y-5">
              {/* LOADING */}
              {loading ? (
                <Section
                  title="Transaction"
                  subtitle="Loading transaction details."
                >
                  <div className="flex items-center justify-center py-24">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />
                  </div>
                </Section>
              ) : error ? (
                /* ERROR */
                <Section
                  title="Transaction"
                  subtitle="Transaction details could not be loaded."
                >
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-5">
                    <p className="text-sm font-semibold text-rose-400">
                      Unable to load transaction
                    </p>

                    <p className="mt-2 text-sm text-slate-400">
                      {error}
                    </p>

                    <Link
                      href="/transactions"
                      className="mt-5 inline-flex rounded-md border border-slate-700 bg-[#15181e] px-4 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      ← Back to Transactions
                    </Link>
                  </div>
                </Section>
              ) : transaction ? (
                <>
                  {/* TRANSACTION OVERVIEW */}
                  <Section
                    title="Transaction Overview"
                    subtitle="Payment and recovery information for this transaction."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <DetailCard
                        label="Transaction ID"
                        value={
                          <span className="break-all font-mono text-xs text-slate-200">
                            {transaction.transaction_id}
                          </span>
                        }
                      />

                      <DetailCard
                        label="Issuer"
                        value={transaction.issuer ?? "Unknown issuer"}
                      />

                      <DetailCard
                        label="Amount"
                        value={
                          <span className="text-base font-semibold text-white">
                            {formatCurrency(
                              transaction.amount,
                              transaction.currency,
                            )}
                          </span>
                        }
                      />

                      <DetailCard
                        label="Payment Method"
                        value={formatLabel(
                          transaction.payment_method,
                        )}
                      />
                    </div>
                  </Section>

                  {/* DECISION FLOW */}
                  <Section
                    title="Decision Flow"
                    subtitle="How RecoverAI moved from payment failure to recovery outcome."
                  >
                    <div className="hidden items-start sm:flex">
                      <FlowStep
                        number="01"
                        title="Failure"
                        value={
                          formatLabel(
                            transaction.failure_code,
                          ) || "Payment failure"
                        }
                        tone="danger"
                      />

                      <FlowStep
                        number="02"
                        title="Diagnosis"
                        value={formatLabel(transaction.root_cause)}
                      />

                      <FlowStep
                        number="03"
                        title="Policy Check"
                        value="Recovery policy"
                      />

                      <FlowStep
                        number="04"
                        title="Decision"
                        value={formatLabel(
                          transaction.final_action,
                        )}
                        tone="warning"
                      />

                      <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold ${
                            transaction.outcome?.toLowerCase() ===
                            "recovered"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          05
                        </div>

                        <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                          Outcome
                        </p>

                        <p className="mt-1 text-xs font-medium text-slate-200">
                          {formatLabel(
                            transaction.outcome ?? "Pending",
                          )}
                        </p>
                      </div>
                    </div>

                    {/* MOBILE FLOW */}
                    <div className="space-y-3 sm:hidden">
                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#111318] p-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-500/40 bg-rose-500/10 text-xs text-rose-400">
                          01
                        </span>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Failure
                          </p>

                          <p className="text-xs text-slate-200">
                            {formatLabel(
                              transaction.failure_code,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#111318] p-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/10 text-xs text-indigo-400">
                          02
                        </span>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Diagnosis
                          </p>

                          <p className="text-xs text-slate-200">
                            {formatLabel(transaction.root_cause)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#111318] p-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-500/10 text-xs text-indigo-400">
                          03
                        </span>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Policy Check
                          </p>

                          <p className="text-xs text-slate-200">
                            Recovery policy
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#111318] p-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/10 text-xs text-amber-400">
                          04
                        </span>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Decision
                          </p>

                          <p className="text-xs text-slate-200">
                            {formatLabel(
                              transaction.final_action,
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#111318] p-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-xs text-emerald-400">
                          05
                        </span>

                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                            Outcome
                          </p>

                          <p className="text-xs text-slate-200">
                            {formatLabel(
                              transaction.outcome ?? "Pending",
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Section>

                  {/* FAILURE + DIAGNOSIS */}
                  <Section
                    title="Failure & Diagnosis"
                    subtitle="How RecoverAI interpreted the payment failure."
                  >
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <DetailCard
                        label="Failure Code"
                        value={
                          <span className="inline-flex rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-medium text-rose-400">
                            {transaction.failure_code ??
                              "No failure code"}
                          </span>
                        }
                      />

                      <DetailCard
                        label="Root Cause"
                        value={formatLabel(
                          transaction.root_cause,
                        )}
                      />

                      <DetailCard
                        label="Diagnosis Method"
                        value={formatLabel(
                          transaction.diagnosis_method,
                        )}
                      />

                      <DetailCard
                        label="Confidence"
                        value={
                          transaction.confidence !== null
                            ? `${Math.round(
                                transaction.confidence * 100,
                              )}%`
                            : "—"
                        }
                      />

                      <DetailCard
                        label="Status"
                        value={
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusBadge(
                              transaction.status,
                            )}`}
                          >
                            {formatLabel(transaction.status)}
                          </span>
                        }
                      />

                      <DetailCard
                        label="Outcome"
                        value={
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${outcomeBadge(
                              transaction.outcome,
                            )}`}
                          >
                            {formatLabel(
                              transaction.outcome ?? "Pending",
                            )}
                          </span>
                        }
                      />
                    </div>
                  </Section>

                  {/* AI REASONING */}
                  <div className="grid gap-5 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                      <Section
                        title="AI Reasoning"
                        subtitle="Diagnosis engine output and confidence."
                      >
                        <div className="space-y-4">
                          <div className="rounded-md border border-indigo-500/30 bg-[#0c0f15] p-4">
                            <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-slate-500">
                              Diagnosis Engine
                            </p>

                            <p className="mt-2 text-sm font-medium text-slate-200">
                              RecoverAI
                            </p>

                            <div className="mt-4 flex items-end justify-between">
                              <div>
                                <p className="text-[9px] uppercase tracking-wide text-slate-600">
                                  Confidence
                                </p>

                                <p className="mt-1 text-xl font-semibold text-emerald-400">
                                  {transaction.confidence !==
                                  null
                                    ? `${Math.round(
                                        transaction.confidence *
                                          100,
                                      )}%`
                                    : "—"}
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="text-[9px] uppercase tracking-wide text-slate-600">
                                  Method
                                </p>

                                <p className="mt-1 text-xs text-slate-300">
                                  {formatLabel(
                                    transaction.diagnosis_method,
                                  )}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-md border border-slate-800 bg-[#0c0f12] p-4">
                            <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-slate-500">
                              Diagnosis Output
                            </p>

                            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-slate-400">
{`{
  "root_cause": "${transaction.root_cause ?? "unknown"}",
  "failure_code": "${transaction.failure_code ?? "unknown"}",
  "confidence": ${
    transaction.confidence !== null
      ? transaction.confidence
      : "null"
  }
}`}
                            </pre>
                          </div>

                          <div className="border-l-2 border-indigo-500/50 pl-3">
                            <p className="text-[9px] font-medium uppercase tracking-[0.15em] text-slate-500">
                              Analysis
                            </p>

                            <p className="mt-2 text-xs leading-5 text-slate-400">
                              RecoverAI evaluated the payment failure,
                              matched it against the transaction
                              diagnosis, and selected the configured
                              recovery action.
                            </p>
                          </div>
                        </div>
                      </Section>
                    </div>

                    {/* RECOVERY DECISION */}
                    <div className="lg:col-span-3">
                      <Section
                        title="Recovery Decision"
                        subtitle="Action recommended or executed by RecoverAI."
                      >
                        <div className="grid gap-3 sm:grid-cols-2">
                          <DetailCard
                            label="Final Action"
                            value={
                              <span className="text-indigo-400">
                                {formatLabel(
                                  transaction.final_action,
                                )}
                              </span>
                            }
                          />

                          <DetailCard
                            label="Recovery Outcome"
                            value={formatLabel(
                              transaction.outcome ?? "Pending",
                            )}
                          />
                        </div>

                        <div className="mt-4 rounded-lg border border-slate-800 bg-[#0d1014] p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                              ↗
                            </div>

                            <div>
                              <p className="text-xs font-semibold text-slate-200">
                                Recovery action selected
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                The configured policy determined the
                                final action based on the transaction
                                diagnosis and confidence.
                              </p>
                            </div>
                          </div>
                        </div>
                      </Section>
                    </div>
                  </div>

                  {/* AUDIT LOG */}
                  <Section
                    title="Audit Log"
                    subtitle="Recent events associated with this transaction."
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="pb-3 pr-4 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-600">
                              Event
                            </th>

                            <th className="pb-3 pr-4 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-600">
                              Actor
                            </th>

                            <th className="pb-3 pr-4 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-600">
                              Details
                            </th>

                            <th className="pb-3 text-[9px] font-medium uppercase tracking-[0.12em] text-slate-600">
                              Status
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          <tr className="border-b border-slate-800/70">
                            <td className="py-4 pr-4 text-xs text-slate-300">
                              Payment Failure
                            </td>

                            <td className="py-4 pr-4">
                              <span className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[9px] text-slate-400">
                                SYSTEM
                              </span>
                            </td>

                            <td className="py-4 pr-4 text-xs text-slate-500">
                              Payment failure detected and
                              transaction marked for diagnosis.
                            </td>

                            <td className="py-4">
                              <span className="text-[10px] text-rose-400">
                                FAILED
                              </span>
                            </td>
                          </tr>

                          <tr className="border-b border-slate-800/70">
                            <td className="py-4 pr-4 text-xs text-slate-300">
                              Diagnosis
                            </td>

                            <td className="py-4 pr-4">
                              <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[9px] text-indigo-400">
                                RECOVERAI
                              </span>
                            </td>

                            <td className="py-4 pr-4 text-xs text-slate-500">
                              {formatLabel(
                                transaction.root_cause,
                              )}{" "}
                              identified using{" "}
                              {formatLabel(
                                transaction.diagnosis_method,
                              )}
                              .
                            </td>

                            <td className="py-4">
                              <span className="text-[10px] text-indigo-400">
                                DIAGNOSED
                              </span>
                            </td>
                          </tr>

                          <tr className="border-b border-slate-800/70">
                            <td className="py-4 pr-4 text-xs text-slate-300">
                              Policy Check
                            </td>

                            <td className="py-4 pr-4">
                              <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-[9px] text-indigo-400">
                                POLICY
                              </span>
                            </td>

                            <td className="py-4 pr-4 text-xs text-slate-500">
                              Recovery policy evaluated the
                              transaction and approved the configured
                              action.
                            </td>

                            <td className="py-4">
                              <span className="text-[10px] text-emerald-400">
                                PASSED
                              </span>
                            </td>
                          </tr>

                          <tr>
                            <td className="py-4 pr-4 text-xs text-slate-300">
                              Recovery Action
                            </td>

                            <td className="py-4 pr-4">
                              <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] text-amber-400">
                                RECOVERY
                              </span>
                            </td>

                            <td className="py-4 pr-4 text-xs text-slate-500">
                              Executed action:{" "}
                              {formatLabel(
                                transaction.final_action,
                              )}
                              .
                            </td>

                            <td className="py-4">
                              <span
                                className={`text-[10px] ${
                                  transaction.outcome?.toLowerCase() ===
                                  "recovered"
                                    ? "text-emerald-400"
                                    : "text-amber-400"
                                }`}
                              >
                                {formatLabel(
                                  transaction.outcome ?? "Pending",
                                ).toUpperCase()}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </Section>

                  {/* FOOTER ACTIONS */}
                  <div className="flex flex-wrap gap-3 border-t border-slate-800 pt-5">
                    <Link
                      href="/transactions"
                      className="rounded-md border border-slate-700 bg-[#111318] px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      ← Back to Transactions
                    </Link>

                    <Link
                      href="/audit-log"
                      className="rounded-md border border-slate-700 bg-[#111318] px-4 py-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:text-white"
                    >
                      View Audit Log
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}