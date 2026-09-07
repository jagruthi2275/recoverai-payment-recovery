"use client";

import { useState } from "react";

import { API_BASE_URL } from "@/lib/api";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function SettingsPage() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [notifications, setNotifications] = useState(false);

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
                  Search operational settings...
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
                  Settings
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Configure application preferences and review system settings.
                </p>
              </div>
            </div>
          </header>

          {/* Content */}
          <div className="mx-auto max-w-[1100px] space-y-5 px-6 py-6 lg:px-8">

            {/* Application preferences */}
            <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d1015]">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Application preferences
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Control how the RecoverAI dashboard behaves.
                </p>
              </div>

              <div className="divide-y divide-slate-800">
                <SettingRow
                  title="Automatic refresh"
                  description="Refresh dashboard data when the page is open."
                  enabled={autoRefresh}
                  onChange={setAutoRefresh}
                />

                <SettingRow
                  title="Notifications"
                  description="Enable notifications for important recovery events."
                  enabled={notifications}
                  onChange={setNotifications}
                />
              </div>
            </section>

            {/* Recovery safeguards */}
            <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d1015]">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Recovery safeguards
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Safety controls used by the recovery workflow.
                </p>
              </div>

              <div className="space-y-3 p-5">
                <StatusRow
                  title="Policy enforcement"
                  description="Recovery decisions follow the configured policy."
                  status="Enabled"
                />

                <StatusRow
                  title="Idempotency protection"
                  description="Duplicate recovery actions are checked before execution."
                  status="Enabled"
                />

                <StatusRow
                  title="Audit logging"
                  description="Recovery events are recorded for operational review."
                  status="Enabled"
                />
              </div>
            </section>

            {/* Backend connection */}
            <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d1015]">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  Backend connection
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Current RecoverAI API configuration.
                </p>
              </div>

              <div className="p-5">
                <div className="flex flex-col gap-4 rounded-md border border-slate-800 bg-[#0b0e13] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-300">
                      API endpoint
                    </p>

                    <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                      {API_BASE_URL}
                    </p>
                  </div>

                  <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-md border border-emerald-900/70 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Connected
                  </span>
                </div>
              </div>
            </section>

            {/* About */}
            <section className="overflow-hidden rounded-lg border border-slate-800 bg-[#0d1015]">
              <div className="border-b border-slate-800 px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-100">
                  About RecoverAI
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Application information.
                </p>
              </div>

              <div className="grid gap-3 p-5 sm:grid-cols-2">
                <InfoCard
                  label="Application"
                  value="RecoverAI"
                />

                <InfoCard
                  label="Version"
                  value="V1"
                />

                <InfoCard
                  label="Frontend"
                  value="Next.js"
                />

                <InfoCard
                  label="Backend"
                  value="FastAPI"
                />
              </div>
            </section>

            {/* Footer note */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-[10px] text-slate-600">
              <span>RecoverAI Operations</span>
              <span>Configuration managed by the application</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SettingRow({
  title,
  description,
  enabled,
  onChange,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 px-5 py-5 transition hover:bg-slate-800/10">
      <div>
        <p className="text-sm font-medium text-slate-200">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-pressed={enabled}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled
            ? "bg-emerald-500"
            : "bg-slate-700"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function StatusRow({
  title,
  description,
  status,
}: {
  title: string;
  description: string;
  status: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-[#0b0e13] p-4">
      <div>
        <p className="text-sm font-medium text-slate-200">
          {title}
        </p>

        <p className="mt-1 text-xs text-slate-500">
          {description}
        </p>
      </div>

      <span className="inline-flex shrink-0 items-center gap-2 rounded-md border border-emerald-900/70 bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {status}
      </span>
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-slate-800 bg-[#0b0e13] p-4">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}