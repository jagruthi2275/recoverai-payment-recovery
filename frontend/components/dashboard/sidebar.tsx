import Link from "next/link";

const navigation = [
  { label: "Dashboard", href: "/" },
  { label: "Transactions", href: "/transactions" },
  { label: "Recovery", href: "/recovery" },
  { label: "AI Operations", href: "/ai-operations" },
  { label: "Evaluation", href: "/evaluation" },
  { label: "Audit Log", href: "/audit-log" },
  { label: "Settings", href: "/settings" },
];

export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-[0_0_20px_rgba(129,140,248,0.2)]">
        R
      </div>

      <div>
        <p className="sidebar-brand-title">
          RecoverAI
        </p>

        <p className="sidebar-brand-subtitle">
          Revenue operations
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Brand />

      <div className="sidebar-section-title">
        Operations
      </div>

      <nav aria-label="Primary" className="sidebar-nav">
        {navigation.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="sidebar-link"
          >
            <span className="sidebar-dot" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-policy">
        Recovery decisions remain governed by the configured policy.
      </div>
    </aside>
  );
}