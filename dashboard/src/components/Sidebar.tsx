import { NavLink } from "react-router-dom";
import { type ComponentType, useEffect, useState } from "react";
import { useModel } from "../lib/data";
import { useLiveStream, type Conn } from "../lib/liveStream";

const COLLAPSE_KEY = "cs.sidebarCollapsed";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  end?: boolean;
  accent?: boolean; // emerald "Live" treatment — the realtime landing page
  disabled?: boolean; // shown but inert in the nav — page still WIP, route stays live
  divider?: boolean; // render a separator rule above this item
};

const items: NavItem[] = [
  { to: "/", label: "Live", icon: PulseIcon, end: true, accent: true },
  { to: "/wallets", label: "Wallet Inspector", icon: WalletIcon },
  { to: "/overview", label: "Overview", icon: GridIcon, divider: true },
  { to: "/cluster-analysis", label: "Cluster Analysis", icon: AxisIcon },
  { to: "/feature-analysis", label: "Feature Analysis", icon: HiveIcon },
  { to: "/signal-validation", label: "Signal Validation", icon: ShieldCheckIcon },
  { to: "/anomaly", label: "Anomaly Detection", icon: AlertIcon, disabled: true },
];

// The accent ("Live") nav item carries a status dot driven by the real SSE connection
// from the app-wide LiveStreamProvider, so the feed's health is visible from any page —
// not just Live. Mirrors the Live page's CONN treatment.
const LIVE_DOT: Record<Conn, { cls: string; title: string }> = {
  live:         { cls: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)] motion-safe:animate-pulse", title: "feed live" },
  connecting:   { cls: "bg-amber-400 motion-safe:animate-pulse",                                         title: "connecting…" },
  reconnecting: { cls: "bg-amber-400 motion-safe:animate-pulse",                                         title: "reconnecting…" },
  offline:      { cls: "bg-slate-500",                                                                   title: "feed unavailable" },
};

export default function Sidebar({
  open = false,
  onClose,
}: {
  open?: boolean;
  onClose?: () => void;
}) {
  const { data: model } = useModel();
  const { conn } = useLiveStream();
  const liveDot = LIVE_DOT[conn];

  // Desktop-only icon-rail fold. Persisted so it survives reloads; defaults to expanded
  // so the desktop layout is unchanged until the user folds it. On mobile this is never
  // applied (every collapse class below is md:-gated) — the drawer is always full width.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Hide labels / trailing affordances on desktop only when collapsed.
  const labelHide = collapsed ? "md:hidden" : "";

  return (
    // Mobile (<md): a fixed slide-in drawer toggled by `open`. Desktop (md+): a static
    // in-flow column exactly as before — every md: class below restores the original
    // layout, so the desktop appearance is unchanged.
    <aside
      className={[
        "fixed inset-y-0 left-0 z-50 flex h-full w-[232px] shrink-0 flex-col justify-between border-r border-border bg-panel transition-[transform,width] duration-200 md:static md:z-auto md:translate-x-0",
        collapsed ? "md:w-[64px]" : "md:w-[232px]",
        open ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      <div>
        <div className={`flex items-center gap-[1.5px] py-5 px-5 ${collapsed ? "md:justify-center md:px-0" : ""}`}>
          <img src="/eth.svg" alt="Ethereum" className="h-8 w-8 shrink-0" />
          <div className={`leading-tight ${labelHide}`}>
            <div className="text-[15px] font-semibold tracking-tight text-fg">
              ChainSense
            </div>
            <div className="text-[11px] text-muted">ETH Behavior Analysis</div>
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-[2px] px-3">
          {items.map((it) => {
            const divider = it.divider ? (
              <hr key={`${it.to}-div`} className="my-2 border-borderSoft" />
            ) : null;
            if (it.disabled) {
              return (
                <div key={it.to}>
                  {divider}
                <div
                  aria-disabled="true"
                  title={collapsed ? `${it.label} — work in progress` : "Disabled for now — work in progress"}
                  className={`group flex cursor-not-allowed select-none items-center justify-between rounded-md px-3 py-2 text-[13.5px] text-muted opacity-40 ${
                    collapsed ? "md:justify-center" : ""
                  }`}
                >
                  <span className={`flex items-center gap-3 ${collapsed ? "md:gap-0" : ""}`}>
                    <it.icon className="h-4 w-4 text-muted" />
                    <span className={labelHide}>{it.label}</span>
                  </span>
                  <span className={`rounded bg-panel2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted ${labelHide}`}>
                    Soon
                  </span>
                </div>
                </div>
              );
            }
            return (
              <div key={it.to}>
                {divider}
              <NavLink
                to={it.to}
                end={it.end}
                onClick={onClose}
                title={collapsed ? it.label : undefined}
              className={({ isActive }) =>
                [
                  "group flex items-center justify-between rounded-md px-3 py-2 text-[13.5px] transition",
                  collapsed ? "md:justify-center" : "",
                  it.accent
                    ? isActive
                      ? "bg-panel2 text-emerald-300 ring-1 ring-emerald-400/20"
                      : "text-emerald-400 hover:bg-panel2/60 hover:text-emerald-300"
                    : isActive
                    ? "bg-panel2 text-fg ring-1 ring-white/5"
                    : "text-muted hover:bg-panel2/60 hover:text-fg",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`flex items-center gap-3 ${collapsed ? "md:gap-0" : ""}`}>
                    <it.icon
                      className={`h-4 w-4 ${
                        it.accent
                          ? isActive
                            ? "text-emerald-300"
                            : "text-emerald-400"
                          : isActive
                          ? "text-fg"
                          : "text-muted"
                      }`}
                    />
                    <span className={labelHide}>{it.label}</span>
                  </span>
                  {it.accent ? (
                    <span
                      title={liveDot.title}
                      className={`h-1.5 w-1.5 rounded-full ${liveDot.cls}`}
                    />
                  ) : (
                    isActive && <span className={`text-muted ${labelHide}`}>›</span>
                  )}
                </>
              )}
              </NavLink>
              </div>
            );
          })}
        </nav>
      </div>

      <div>
        {/* Desktop-only fold toggle. hidden on mobile (the drawer is dismissed via the
            top-bar hamburger / backdrop instead). */}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mx-3 mb-1 hidden h-9 items-center gap-2 rounded-md px-3 text-[12px] text-muted hover:bg-panel2/60 hover:text-fg md:flex ${
            collapsed ? "md:justify-center md:px-0" : ""
          }`}
        >
          <ChevronLeftIcon className={`h-4 w-4 shrink-0 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          <span className={labelHide}>Collapse</span>
        </button>

        <div className={`m-4 mt-1 rounded-lg border border-borderSoft bg-bg/40 p-4 ${labelHide}`}>
          <div className="mb-3 text-center text-[10.5px] font-semibold tracking-[0.18em] text-muted">
            MODEL
          </div>
          <dl className="space-y-1.5 text-[11.5px] font-num">
            <Row k="Algorithm" v={model?.algo ?? "—"} />
            <Row k="Clusters" v={model ? `${model.n_clusters} + noise` : "—"} />
            <Row k="Features" v={model ? String(model.n_features) : "—"} />
          </dl>
        </div>
      </div>
    </aside>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}

function ChevronLeftIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GridIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function HiveIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l8 4.5v9L12 21 4 16.5v-9L12 3z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M12 8l4 2.5v3L12 16l-4-2.5v-3L12 8z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function AxisIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 20V4M4 20h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 17l3-4 3 2 4-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WalletIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 12.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 9h14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function PulseIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M3 12h4l2-6 4 12 2-6h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ShieldCheckIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l7 3v5c0 4.5-2.9 7.6-7 9-4.1-1.4-7-4.5-7-9V6l7-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function AlertIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3l9 16H3L12 3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}
