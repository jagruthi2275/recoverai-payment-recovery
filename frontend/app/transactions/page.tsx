"use client";

import Link from "next/link";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  ApiError,
  getTransactions,
  type TransactionSummary,
} from "@/lib/api";

const PAGE_SIZE = 200;

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function formatCurrency(
  amount: number,
  currency: string = "INR",
): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${Number(amount || 0).toLocaleString("en-IN", {
      maximumFractionDigits: 2,
    })}`;
  }
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/* ---------------------------------------------
   DARK THEME BADGES
--------------------------------------------- */

function getOutcomeClass(
  outcome: string | null | undefined,
): string {
  switch (normalize(outcome)) {
    case "recovered":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";

    case "failed":
      return "border-rose-500/40 bg-rose-500/10 text-rose-400";

    case "escalated":
      return "border-amber-500/40 bg-amber-500/10 text-amber-400";

    case "stopped":
      return "border-slate-600 bg-slate-800/50 text-slate-400";

    default:
      return "border-slate-600 bg-slate-800/40 text-slate-400";
  }
}

function getStatusClass(
  status: string | null | undefined,
): string {
  switch (normalize(status)) {
    case "failed":
      return "border-rose-500/40 bg-rose-500/10 text-rose-400";

    case "degraded":
      return "border-amber-500/40 bg-amber-500/10 text-amber-400";

    case "success":
    case "recovered":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-400";

    case "pending":
      return "border-blue-500/40 bg-blue-500/10 text-blue-400";

    default:
      return "border-slate-600 bg-slate-800/40 text-slate-400";
  }
}

function getFailureClass(
  failureCode: string | null | undefined,
): string {
  if (!failureCode) {
    return "border-slate-600 bg-slate-800/40 text-slate-400";
  }

  return "border-rose-500/40 bg-rose-500/10 text-rose-400";
}

function getDiagnosisMethodLabel(
  method: string | null | undefined,
): string {
  if (!method) return "—";

  switch (normalize(method)) {
    case "rule_engine":
      return "Rule Engine";

    case "llm_reasoning":
      return "LLM Reasoning";

    default:
      return formatLabel(method);
  }
}

/* ---------------------------------------------
   METRIC CARD
--------------------------------------------- */

function MetricCard({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  detail: string;
  tone?: "slate" | "green" | "red" | "amber";
}) {
  const toneClasses = {
    slate: "border-[#252832]",
    green: "border-emerald-500/30",
    red: "border-rose-500/30",
    amber: "border-amber-500/30",
  };

  const barClasses = {
    slate: "bg-slate-500",
    green: "bg-emerald-500",
    red: "bg-rose-500",
    amber: "bg-amber-500",
  };

  const detailClasses = {
    slate: "text-slate-500",
    green: "text-emerald-400",
    red: "text-rose-400",
    amber: "text-amber-400",
  };

  return (
    <div
      className={`rounded-lg border bg-[#111318] p-5 shadow-none ${toneClasses[tone]}`}
    >
      <div
        className={`mb-4 h-1 w-7 rounded-full ${barClasses[tone]}`}
      />

      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold text-white">
        {value}
      </p>

      <p className={`mt-1 text-xs ${detailClasses[tone]}`}>
        {detail}
      </p>
    </div>
  );
}

/* ---------------------------------------------
   PAGE
--------------------------------------------- */

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0b0d12]" />}>
      <TransactionsContent />
    </Suspense>
  );
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSearchFromUrl =
    searchParams.get("search") ?? "";

  const initialRootCause =
    searchParams.get("root_cause") ?? "";

  const [transactions, setTransactions] = useState<
    TransactionSummary[]
  >([]);

  const [search, setSearch] = useState(
    initialSearchFromUrl,
  );

  const [status, setStatus] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ---------------------------------------------
     LOAD TRANSACTIONS
  --------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      setLoading(true);
      setError(null);

      try {
        const response = await getTransactions({
          root_cause: initialRootCause || undefined,
          limit: PAGE_SIZE,
          offset: 0,
        });

        if (!cancelled) {
          setTransactions(response.items);
        }
      } catch (caughtError: unknown) {
        if (cancelled) return;

        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load transactions.",
        );

        setTransactions([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [initialRootCause]);

  /* ---------------------------------------------
     SYNC SEARCH WITH URL
  --------------------------------------------- */

  useEffect(() => {
    setSearch(initialSearchFromUrl);
  }, [initialSearchFromUrl]);

  /* ---------------------------------------------
     FILTER TRANSACTIONS
  --------------------------------------------- */

  const filteredTransactions = useMemo(() => {
    const query = normalize(search);

    return transactions.filter((transaction) => {
      const searchableValues = [
        transaction.transaction_id,
        transaction.issuer,
        transaction.payment_method,
        transaction.failure_code,
        transaction.root_cause,
        transaction.diagnosis_method,
      ].map(normalize);

      const matchesSearch =
        !query ||
        searchableValues.some((value) =>
          value.includes(query),
        );

      const transactionStatus =
        normalize(transaction.status);

      const transactionOutcome =
        normalize(transaction.outcome);

      const matchesStatus =
        status === "all" ||
        transactionStatus === normalize(status);

      const matchesOutcome =
        outcome === "all" ||
        transactionOutcome === normalize(outcome);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesOutcome
      );
    });
  }, [transactions, search, status, outcome]);

  /* ---------------------------------------------
     METRICS
  --------------------------------------------- */

  const recoveredCount = useMemo(
    () =>
      filteredTransactions.filter(
        (transaction) =>
          normalize(transaction.outcome) === "recovered",
      ).length,
    [filteredTransactions],
  );

  const failedCount = useMemo(
    () =>
      filteredTransactions.filter(
        (transaction) =>
          normalize(transaction.outcome) === "failed",
      ).length,
    [filteredTransactions],
  );

  const escalatedOrStoppedCount = useMemo(
    () =>
      filteredTransactions.filter((transaction) => {
        const value = normalize(transaction.outcome);

        return (
          value === "escalated" ||
          value === "stopped"
        );
      }).length,
    [filteredTransactions],
  );

  /* ---------------------------------------------
     CLEAR FILTERS
  --------------------------------------------- */

  const handleClear = () => {
    setSearch("");
    setStatus("all");
    setOutcome("all");

    if (initialRootCause) {
      router.push(
        `/transactions?root_cause=${encodeURIComponent(
          initialRootCause,
        )}`,
      );
    } else {
      router.push("/transactions");
    }
  };

  const handleSearchChange = (
    value: string,
  ) => {
    setSearch(value);
  };

  /* ---------------------------------------------
     RENDER
  --------------------------------------------- */

  return (
    <div className="flex min-h-screen items-stretch bg-[#0b0d12] text-slate-100">
      <Sidebar />

      <main className="min-w-0 flex-1 bg-[#0b0d12]">

        {/* =========================================
            HEADER
        ========================================= */}

        <header className="border-b border-[#252832] bg-[#0b0d12]">
          <div className="mx-auto max-w-[1320px] px-6 py-7">

            <p className="text-xs text-slate-400">
              RecoverAI Operations
            </p>

            <div className="mt-1 flex items-start justify-between gap-4">
              <div>

                <h1 className="text-2xl font-semibold text-white">
                  Transactions
                </h1>

                <p className="mt-1 text-sm text-slate-400">
                  Monitor payment transactions and
                  their recovery status.
                </p>

              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400">
                {loading
                  ? "Loading transactions..."
                  : `${transactions.length} transactions loaded`}
              </div>

            </div>
          </div>
        </header>

        {/* =========================================
            MAIN CONTENT
        ========================================= */}

        <div className="mx-auto max-w-[1320px] px-6 py-6">

          {/* -----------------------------------------
              ERROR
          ----------------------------------------- */}

          {error && (
            <div className="mb-5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
              {error}
            </div>
          )}

          {/* -----------------------------------------
              METRIC CARDS
          ----------------------------------------- */}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            <MetricCard
              label="Total loaded"
              value={filteredTransactions.length}
              detail="Transactions returned by API"
            />

            <MetricCard
              label="Recovered"
              value={recoveredCount}
              detail="Successful recovery outcomes"
              tone="green"
            />

            <MetricCard
              label="Failed"
              value={failedCount}
              detail="Recovery attempts that failed"
              tone="red"
            />

            <MetricCard
              label="Escalated / stopped"
              value={escalatedOrStoppedCount}
              detail="Requires review or policy stop"
              tone="amber"
            />

          </div>

          {/* -----------------------------------------
              SEARCH PANEL
          ----------------------------------------- */}

          <section className="mt-6 rounded-lg border border-[#252832] bg-[#111318] p-5 shadow-none">

            <div className="mb-5">

              <h2 className="font-semibold text-white">
                Search transactions
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Search by transaction ID, issuer,
                payment method, failure code, or
                diagnosis.
              </p>

            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_160px_160px_auto]">

              {/* Search */}

              <div>

                <label
                  htmlFor="transaction-search"
                  className="mb-2 block text-xs font-medium text-slate-400"
                >
                  Search transactions
                </label>

                <input
                  id="transaction-search"
                  type="text"
                  value={search}
                  onChange={(event) =>
                    handleSearchChange(
                      event.target.value,
                    )
                  }
                  placeholder="Search transactions..."
                  className="w-full rounded-md border border-[#30333d] bg-[#0d0f13] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
                />

              </div>

              {/* Status */}

              <div>

                <label
                  htmlFor="transaction-status"
                  className="mb-2 block text-xs font-medium text-slate-400"
                >
                  Status
                </label>

                <select
                  id="transaction-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                  className="w-full rounded-md border border-[#30333d] bg-[#0d0f13] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
                >

                  <option value="all">
                    All statuses
                  </option>

                  <option value="failed">
                    Failed
                  </option>

                  <option value="degraded">
                    Degraded
                  </option>

                </select>

              </div>

              {/* Outcome */}

              <div>

                <label
                  htmlFor="transaction-outcome"
                  className="mb-2 block text-xs font-medium text-slate-400"
                >
                  Outcome
                </label>

                <select
                  id="transaction-outcome"
                  value={outcome}
                  onChange={(event) =>
                    setOutcome(event.target.value)
                  }
                  className="w-full rounded-md border border-[#30333d] bg-[#0d0f13] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30"
                >

                  <option value="all">
                    All outcomes
                  </option>

                  <option value="recovered">
                    Recovered
                  </option>

                  <option value="failed">
                    Failed
                  </option>

                  <option value="escalated">
                    Escalated
                  </option>

                  <option value="stopped">
                    Stopped
                  </option>

                </select>

              </div>

              {/* Clear */}

              <div className="flex items-end">

                <button
                  type="button"
                  onClick={handleClear}
                  className="w-full rounded-md border border-[#30333d] bg-[#111318] px-4 py-2.5 text-sm text-slate-300 transition hover:bg-[#181a20] hover:text-white"
                >
                  Clear
                </button>

              </div>

            </div>

            {/* Root cause indicator */}

            {initialRootCause && (
              <div className="mt-4 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-300">

                Root cause:{" "}

                <span className="font-medium">
                  {formatLabel(initialRootCause)}
                </span>

              </div>
            )}

            <div className="mt-4 border-t border-[#252832] pt-4">

              <p className="text-xs text-slate-500">

                Showing{" "}

                <span className="font-medium text-slate-300">
                  {filteredTransactions.length}
                </span>{" "}

                matching transactions.

              </p>

            </div>

          </section>

          {/* -----------------------------------------
              TRANSACTIONS TABLE
          ----------------------------------------- */}

          <section className="mt-6 overflow-hidden rounded-lg border border-[#252832] bg-[#111318] shadow-none">

            {loading ? (

              <div className="flex min-h-[220px] items-center justify-center">

                <p className="text-sm text-slate-400">
                  Loading transactions...
                </p>

              </div>

            ) : filteredTransactions.length === 0 ? (

              <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center">

                <p className="font-medium text-white">
                  No transactions match your filters.
                </p>

                <p className="mt-1 text-sm text-slate-400">
                  Try changing the search or filter
                  selections.
                </p>

              </div>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full min-w-[1200px] border-collapse">

                  <thead>

                    <tr className="border-b border-[#252832] bg-[#15171c] text-left">

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Transaction
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Amount
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Payment
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Status
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Failure
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Diagnosis
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Confidence
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Action
                      </th>

                      <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Outcome
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {filteredTransactions.map(
                      (transaction) => (

                        <tr
                          key={transaction.transaction_id}
                          className="border-b border-[#20232a] last:border-0 hover:bg-[#17191f]"
                        >

                          {/* Transaction */}

                          <td className="px-4 py-4">

                            <Link
                              href={`/transactions/${encodeURIComponent(
                                transaction.transaction_id,
                              )}`}
                              className="font-medium text-slate-100 underline-offset-2 hover:text-indigo-400 hover:underline"
                            >
                              {transaction.transaction_id}
                            </Link>

                            <p className="mt-1 text-xs text-slate-500">
                              {transaction.issuer || "—"}
                            </p>

                          </td>

                          {/* Amount */}

                          <td className="px-4 py-4 text-sm font-medium text-slate-100">

                            {formatCurrency(
                              transaction.amount,
                              transaction.currency,
                            )}

                          </td>

                          {/* Payment */}

                          <td className="px-4 py-4 text-sm text-slate-300">

                            {formatLabel(
                              transaction.payment_method,
                            )}

                          </td>

                          {/* Status */}

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClass(
                                transaction.status,
                              )}`}
                            >
                              {formatLabel(
                                transaction.status,
                              )}
                            </span>

                          </td>

                          {/* Failure */}

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${getFailureClass(
                                transaction.failure_code,
                              )}`}
                            >
                              {transaction.failure_code
                                ? transaction.failure_code
                                : "—"}
                            </span>

                          </td>

                          {/* Diagnosis */}

                          <td className="px-4 py-4">

                            <p className="text-sm text-slate-200">
                              {formatLabel(
                                transaction.root_cause,
                              )}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {getDiagnosisMethodLabel(
                                transaction.diagnosis_method,
                              )}
                            </p>

                          </td>

                          {/* Confidence */}

                          <td className="px-4 py-4 text-sm text-slate-300">

                            {transaction.confidence !== null &&
                            transaction.confidence !==
                              undefined
                              ? `${Math.round(
                                  transaction.confidence <= 1
                                    ? transaction.confidence *
                                      100
                                    : transaction.confidence,
                                )}%`
                              : "—"}

                          </td>

                          {/* Action */}

                          <td className="px-4 py-4">

                            <span className="inline-flex rounded-md border border-[#30333d] bg-[#181a20] px-2 py-1 text-xs text-slate-300">
                              {formatLabel(
                                transaction.final_action,
                              )}
                            </span>

                          </td>

                          {/* Outcome */}

                          <td className="px-4 py-4">

                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getOutcomeClass(
                                transaction.outcome,
                              )}`}
                            >
                              {formatLabel(
                                transaction.outcome,
                              )}
                            </span>

                          </td>

                        </tr>

                      ),
                    )}

                  </tbody>

                </table>

              </div>

            )}

          </section>

          {/* -----------------------------------------
              TRANSACTION DETAILS INFO
          ----------------------------------------- */}

          <section className="mt-5 rounded-lg border border-[#252832] bg-[#111318] p-4 shadow-none">

            <h2 className="text-sm font-medium text-white">
              Transaction details
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Click any transaction ID to view its
              complete payment, diagnosis and recovery
              decision details.
            </p>

          </section>

        </div>

      </main>

    </div>
  );
}