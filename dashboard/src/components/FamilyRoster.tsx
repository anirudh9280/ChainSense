import { useState } from "react";
import { familyColor } from "../lib/families";
import { compact } from "../lib/data";

export type RosterCluster = {
  id: number;
  name: string;
  validated: boolean;
  confidence: string;
  wallets: number;
};

export type RosterFamily = {
  name: string;
  wallets: number;
  pct: number;
  clusters: RosterCluster[];
};

const CONF: Record<string, string> = {
  high: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  low: "text-slate-300 border-slate-400/25 bg-slate-400/10",
};

const humanize = (s: string) => s.replace(/_/g, " ");

export default function FamilyRoster({
  families,
  total,
}: {
  families: RosterFamily[];
  total: string;
}) {
  const maxPct = Math.max(...families.map((f) => f.pct), 1);
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-5 py-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        FAMILY DISTRIBUTION
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        {total} wallets · <span className="text-emerald-300">✓</span> marks clusters validated against Etherscan
      </div>

      <div className="mt-4 space-y-1">
        {families.map((f) => (
          <FamilyRow key={f.name} f={f} maxPct={maxPct} />
        ))}
      </div>
    </div>
  );
}

function FamilyRow({ f, maxPct }: { f: RosterFamily; maxPct: number }) {
  const [open, setOpen] = useState(true);
  const c = familyColor(f.name);

  return (
    <div className="rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-panel2/30"
      >
        <svg
          viewBox="0 0 16 16"
          className={`h-3 w-3 shrink-0 text-mutedSoft transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: c, boxShadow: `0 0 5px ${c}aa` }}
        />
        <span className="flex-1 truncate text-[13px] text-fg">{f.name}</span>
        <span className="font-num text-[10.5px] text-mutedSoft">
          {f.clusters.length} {f.clusters.length === 1 ? "cluster" : "clusters"}
        </span>
        <span className="ml-2 shrink-0 font-num text-[11px] text-muted">
          <span className="text-fg">{compact(f.wallets)}</span>
          <span className="ml-2" style={{ color: c }}>
            {f.pct.toFixed(1)}%
          </span>
        </span>
      </button>

      <div className="px-2">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-borderSoft">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${(f.pct / maxPct) * 100}%`, background: c, opacity: 0.7 }}
          />
        </div>
      </div>

      {open && (
        <div className="mb-1 mt-1.5 space-y-0.5 pl-7 pr-2">
          {f.clusters.map((cl) => (
            <div
              key={cl.id}
              className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />
                <span className="truncate text-[12px] text-fg/85">{humanize(cl.name)}</span>
                {cl.validated && (
                  <span className="shrink-0 text-[10px] text-emerald-300" title="validated against Etherscan">
                    ✓
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-num text-[10.5px] text-muted">{compact(cl.wallets)}</span>
                <span
                  className={`rounded-full border px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide ${
                    CONF[cl.confidence] ?? "border-borderSoft text-mutedSoft"
                  }`}
                >
                  {cl.confidence}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
