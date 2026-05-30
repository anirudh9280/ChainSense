import type { Snapshot } from "../lib/snapshot";

const colorMap: Record<string, string> = {
  longterm: "#54E0A8",
  traders:  "#5BB6F0",
  nft:      "#B488F0",
  bots:     "#F0A24A",
};

export default function PopulationVsTransactions({
  rows,
}: {
  rows: Snapshot["archetypes"];
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          POPULATION VS. TRANSACTION SHARE
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-muted">
          <Legend swatch="bg-sky-400/70" label="% of wallets" />
          <Legend swatch="bg-emerald-400/70" label="% of transactions" />
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {rows.map((r) => {
          const c = colorMap[r.color] ?? "#888";
          return (
            <div key={r.name}>
              <div className="mb-2 flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2 text-fg">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c, boxShadow: `0 0 6px ${c}aa` }}
                  />
                  {r.name}
                </span>
                <span className="font-num text-muted">
                  <span className="text-sky-300">{r.pct.toFixed(1)}%</span>
                  {" wallets  ·  "}
                  <span className="text-emerald-300">{r.txnSharePct.toFixed(1)}%</span>
                  {" txns"}
                </span>
              </div>
              <PairBar pct={r.pct} txn={r.txnSharePct} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PairBar({ pct, txn }: { pct: number; txn: number }) {
  return (
    <div className="space-y-1">
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-borderSoft">
        <div className="h-full bg-sky-400/80" style={{ width: `${pct}%` }} />
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-borderSoft">
        <div className="h-full bg-emerald-400/80" style={{ width: `${txn}%` }} />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-[3px] w-4 rounded-full ${swatch}`} />
      {label}
    </span>
  );
}
