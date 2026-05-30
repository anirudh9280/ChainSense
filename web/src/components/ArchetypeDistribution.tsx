import type { Snapshot } from "../lib/snapshot";

const colorMap: Record<string, { dot: string; bar: string }> = {
  longterm: { dot: "#54E0A8", bar: "from-emerald-400/80 to-emerald-400/30" },
  traders:  { dot: "#5BB6F0", bar: "from-sky-400/80 to-sky-400/30" },
  nft:      { dot: "#B488F0", bar: "from-violet-400/80 to-violet-400/30" },
  bots:     { dot: "#F0A24A", bar: "from-amber-400/80 to-amber-400/30" },
};

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export default function ArchetypeDistribution({
  rows,
  total,
}: {
  rows: Snapshot["archetypes"];
  total: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="text-center text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        ARCHETYPE DISTRIBUTION
      </div>
      <div className="mt-1 text-center text-[11.5px] text-muted">
        K-Means cluster assignment over {total} wallets
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((r) => {
          const c = colorMap[r.color] ?? colorMap.traders;
          return (
            <div key={r.name}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2 text-fg">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: c.dot,
                      boxShadow: `0 0 6px ${c.dot}aa`,
                    }}
                  />
                  {r.name}
                </span>
                <span className="font-num text-muted">
                  <span className="text-fg">{fmt(r.count)}</span>{" "}
                  <span className="ml-2" style={{ color: c.dot }}>
                    {r.pct.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-borderSoft">
                <div
                  className={`h-full bg-gradient-to-r ${c.bar}`}
                  style={{ width: `${Math.min(r.pct * 2, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
