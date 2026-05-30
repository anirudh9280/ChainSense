import { NavLink } from "react-router-dom";
import type { Snapshot } from "../lib/snapshot";

const items = [
  { to: "/", label: "Overview", icon: GridIcon, end: true },
  { to: "/archetypes", label: "Archetypes", icon: HiveIcon },
  { to: "/feature-space", label: "Feature Space", icon: AxisIcon },
  { to: "/wallets", label: "Wallet Inspector", icon: WalletIcon },
  { to: "/anomaly", label: "Anomaly Detection", icon: AlertIcon },
  { to: "/classifier", label: "Real-time Classifier", icon: PulseIcon },
];

export default function Sidebar({ snap }: { snap: Snapshot | null }) {
  return (
    <aside className="flex h-full w-[232px] shrink-0 flex-col justify-between border-r border-border bg-panel">
      <div>
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/30 to-purple-500/30 ring-1 ring-white/10">
            <NodesIcon className="h-4 w-4 text-indigo-200" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-fg">
              ChainSegment
            </div>
            <div className="text-[11px] text-muted">wallet behavior · ETH</div>
          </div>
        </div>
        <nav className="mt-2 flex flex-col gap-[2px] px-3">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                [
                  "group flex items-center justify-between rounded-md px-3 py-2 text-[13.5px] transition",
                  isActive
                    ? "bg-panel2 text-fg ring-1 ring-white/5"
                    : "text-muted hover:bg-panel2/60 hover:text-fg",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3">
                    <it.icon
                      className={`h-4 w-4 ${
                        isActive ? "text-fg" : "text-muted"
                      }`}
                    />
                    {it.label}
                  </span>
                  {isActive && (
                    <span className="text-muted">›</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="m-4 rounded-lg border border-borderSoft bg-bg/40 p-4">
        <div className="mb-3 text-center text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          SNAPSHOT
        </div>
        <dl className="space-y-1.5 text-[11.5px] font-num">
          <Row k="Network" v={snap?.meta.network ?? "—"} />
          <Row k="Window" v={`${snap?.meta.windowHours ?? "—"} h`} />
          <Row
            k="Blocks"
            v={`${snap?.meta.blockStart ?? "—"}→${snap?.meta.blockEnd ?? "—"}`}
          />
        </dl>
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
function NodesIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M7.5 7.5l3 8.5M16.5 7.5l-3 8.5M8 6h8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
