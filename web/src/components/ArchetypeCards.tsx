import { compact } from "../lib/data";

export type ClusterInCard = {
  id: number;
  name: string;
  confidence: string;
  validated: boolean;
  wallets: number;
  pct: number;
};

export type FamilyCard = {
  name: string;
  color: string;
  wallets: number;
  pct: number;
  pctTxns: number;
  medianTxns: number;
  clusters: ClusterInCard[];
};

const CONF: Record<string, string> = {
  high: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  medium: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  low: "text-slate-300 border-slate-400/25 bg-slate-400/10",
};

function humanize(name: string): string {
  return name.replace(/_/g, " ");
}

export default function FamilyCards({ cards }: { cards: FamilyCard[] }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.name}
          className="relative overflow-hidden rounded-xl border border-border bg-panel/70 p-4"
        >
          <div className="absolute inset-x-0 top-0 h-[2px]" style={{ background: c.color }} />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
              />
              {c.name}
            </div>
            <div className="font-num text-[11px] text-muted">
              {compact(c.wallets)} · <span className="text-fg/80">{c.pct.toFixed(1)}%</span>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-3 gap-x-3 font-num text-[11.5px]">
            <Stat label="TXN SHARE" value={`${c.pctTxns.toFixed(1)}%`} />
            <Stat label="MEDIAN TXNS" value={c.medianTxns.toLocaleString()} />
            <Stat label="CLUSTERS" value={String(c.clusters.length)} />
          </dl>

          <div className="mt-3 border-t border-borderSoft pt-3">
            <div className="space-y-1.5">
              {c.clusters.map((cl) => (
                <div key={cl.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5">
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
                        CONF[cl.confidence] ?? "text-mutedSoft border-borderSoft"
                      }`}
                    >
                      {cl.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-semibold tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-0.5 text-fg">{value}</div>
    </div>
  );
}
