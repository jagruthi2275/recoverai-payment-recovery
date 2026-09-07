import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  detail,
  tone = "default",
  onClick,
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "default" | "risk" | "success" | "warning";
  onClick?: () => void;
}) {
  const accent = {
    default: "bg-slate-500",
    risk: "bg-rose-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
  }[tone];

  const className =
    "rounded-xl border border-slate-200 bg-white p-5 shadow-sm " +
    (onClick
      ? "cursor-pointer text-left transition-transform hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
      : "");

  const content = (
    <>
      <div className={`h-1 w-8 rounded-full ${accent}`} />

      <p className="mt-4 text-sm font-medium text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>

      {detail ? (
        <p className="mt-2 text-xs text-slate-500">
          {detail}
        </p>
      ) : null}

      {onClick ? (
        <p className="mt-3 text-xs font-medium text-slate-500">
          Click to view details →
        </p>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full ${className}`}
      >
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-slate-950">
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}