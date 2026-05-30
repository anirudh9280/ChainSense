import { familyColor } from "../lib/families";
import { compact } from "../lib/data";

export type DistRow = { name: string; wallets: number; pct: number; clusters: number };

export default function ArchetypeDistribution({
  rows,
  total,
}: {
  rows: DistRow[];
  total: string;
}) {
  const maxPct = Math.max(...rows.map((r) => r.pct), 1);
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="text-center text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        FAMILY DISTRIBUTION
      </div>
      <div className="mt-1 text-center text-[11.5px] text-muted">
        18 HDBSCAN clusters rolled up into 7 families + noise · {total} wallets
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((r) => {
          const c = familyColor(r.name);
          return (
            <div key={r.name}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-fg">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c, boxShadow: `0 0 6px ${c}aa` }}
                  />
                  {r.name}
                  <span className="font-num text-[10.5px] text-mutedSoft">
                    {r.clusters} {r.clusters === 1 ? "cluster" : "clusters"}
                  </span>
                </span>
                <span className="font-num text-muted">
                  <span className="text-fg">{compact(r.wallets)}</span>
                  <span className="ml-2" style={{ color: c }}>
                    {r.pct.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-borderSoft">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(r.pct / maxPct) * 100}%`, background: c }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
