"use client";

import { useEffect, useState } from "react";

import {
  ApiError,
  getAuditLog,
  type ListResponse,
} from "@/lib/api";
import { Sidebar } from "@/components/dashboard/sidebar";

type AuditEvent = Record<string, unknown>;

export default function AuditLogPage() {
  const [auditLog, setAuditLog] =
    useState<ListResponse<AuditEvent> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAuditLog({ limit: 50, offset: 0 })
      .then(setAuditLog)
      .catch((caughtError: unknown) => {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "Unable to load audit log.",
        );
      });
  }, []);

  return (
    <main className="min-h-screen bg-[#090b0f] text-slate-100">
      <div className="flex min-h-screen">
        <Sidebar />

        <section className="min-w-0 flex-1">
          {/* Top bar */}
          <div className="border-b border-slate-800/80 bg-[#090b0f]">
            <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6 lg:px-8">
              <div className="flex h-8 w-72 items-center rounded-md border border-slate-800 bg-[#0d1015] px-3">
                <span className="mr-2 text-xs text-slate-600">
                  ⌕
                </span>

                <span className="text-xs text-slate-600">
                  Search audit events...
                </span>
              </div>

              <div className="flex items-center gap-4">
                <span className="flex items-center gap-2 text-[10px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  System Operational
                </span>

                <span className="text-xs text-slate-500">♧</span>
                <span className="text-xs text-slate-500">◉</span>
              </div>
            </div>
          </div>

          {/* Page header */}
          <header className="border-b border-slate-800/70">
            <div className="mx-auto flex max-w-[1400px] items-end justify-between px-6 py-7 lg:px-8">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-400">
                  Revenue Recovery Intelligence
                </p>

                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">
                  Audit Log
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Forensics and state transition records.
                </p>
              </div>

              <div className="hidden items-center gap-2 sm:flex">
                <button
                  type="button"
                  className="rounded-md border border-slate-800 bg-[#0d1015] px-3 py-2 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  Filter
                </button>

                <button
                  type="button"
                  className="rounded-md border border-slate-800 bg-[#0d1015] px-3 py-2 text-xs text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                >
                  Export
                </button>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="mx-auto max-w-[1400px] px-6 py-6 lg:px-8">
            {error ? (
              <div className="rounded-lg border border-rose-900/70 bg-rose-950/20 p-5">
                <p className="text-sm font-semibold text-rose-300">
                  Unable to load audit log
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {error}
                </p>
              </div>
            ) : !auditLog ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-slate-800 bg-[#0d1015]">
                <div className="text-center">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-400" />

                  <p className="mt-4 text-xs text-slate-500">
                    Loading audit log...
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Summary strip */}
                <div className="grid grid-cols-1 overflow-hidden rounded-lg border border-slate-800 bg-[#0d1015] sm:grid-cols-3">
                  <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Events loaded
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {auditLog.items.length}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-600">
                      Current audit window
                    </p>
                  </div>

                  <div className="border-b border-slate-800 p-5 sm:border-b-0 sm:border-r">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Limit
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {auditLog.limit}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-600">
                      Events requested
                    </p>
                  </div>

                  <div className="p-5">
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      Offset
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-slate-100">
                      {auditLog.offset}
                    </p>

                    <p className="mt-1 text-[11px] text-slate-600">
                      Pagination position
                    </p>
                  </div>
                </div>

                {/* Audit events panel */}
                <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d1015]">
                  {/* Panel header */}
                  <div className="border-b border-slate-800 px-5 py-4">
                    <h2 className="text-sm font-semibold text-slate-100">
                      Audit events
                    </h2>

                    <p className="mt-1 text-xs text-slate-500">
                      Recorded RecoverAI events, decisions, and state changes.
                    </p>
                  </div>

                  {auditLog.items.length === 0 ? (
                    <div className="p-6">
                      <div className="rounded-md border border-dashed border-slate-800 bg-[#0b0e13] p-12 text-center">
                        <p className="text-sm font-medium text-slate-300">
                          No audit events yet
                        </p>

                        <p className="mt-1 text-xs text-slate-600">
                          Audit events will appear here as the recovery
                          pipeline processes transactions.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] text-left">
                        <thead>
                          <tr className="border-b border-slate-800 bg-[#0b0e13] text-[10px] uppercase tracking-wider text-slate-600">
                            <th className="px-4 py-3 font-medium">
                              Event
                            </th>

                            <th className="px-4 py-3 font-medium">
                              Transaction
                            </th>

                            <th className="px-4 py-3 font-medium">
                              Decision summary
                            </th>

                            <th className="px-4 py-3 font-medium">
                              Time
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {auditLog.items.map((event, index) => {
                            const eventType = getString(
                              event,
                              "event_type",
                            );

                            const transactionId = getString(
                              event,
                              "transaction_id",
                            );

                            const timestamp =
                              getString(event, "created_at") ??
                              getString(event, "timestamp") ??
                              getString(event, "occurred_at");

                            const summary =
                              getString(event, "decision_summary") ??
                              getString(event, "details") ??
                              getString(event, "message");

                            return (
                              <tr
                                key={index}
                                className="group border-b border-slate-800/70 align-top transition last:border-0 hover:bg-slate-800/20"
                              >
                                {/* Event */}
                                <td className="px-4 py-4">
                                  <div className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />

                                    <span className="text-xs font-medium text-slate-300">
                                      {eventType ?? "System event"}
                                    </span>
                                  </div>
                                </td>

                                {/* Transaction */}
                                <td className="px-4 py-4 font-mono text-[11px] text-slate-500">
                                  {transactionId ?? "—"}
                                </td>

                                {/* Details */}
                                <td className="max-w-xl px-4 py-4">
                                  {summary ? (
                                    <p className="text-xs leading-5 text-slate-400">
                                      {summary}
                                    </p>
                                  ) : (
                                    <details className="text-xs">
                                      <summary className="cursor-pointer text-indigo-400 transition hover:text-indigo-300">
                                        View event payload
                                      </summary>

                                      <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-[#090b0f] p-3 text-[10px] leading-5 text-slate-500">
                                        {JSON.stringify(
                                          event,
                                          null,
                                          2,
                                        )}
                                      </pre>
                                    </details>
                                  )}
                                </td>

                                {/* Time */}
                                <td className="whitespace-nowrap px-4 py-4 text-[11px] text-slate-600">
                                  {formatTimestamp(timestamp)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between border-t border-slate-800 px-5 py-4 text-[11px] text-slate-600">
                    <span>
                      Showing{" "}
                      <span className="text-slate-400">
                        {auditLog.items.length}
                      </span>{" "}
                      events
                    </span>

                    <span>
                      Offset {auditLog.offset} · Limit {auditLog.limit}
                    </span>
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function getString(
  object: Record<string, unknown>,
  key: string,
): string | null {
  const value = object[key];

  return typeof value === "string" ? value : null;
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN");
}