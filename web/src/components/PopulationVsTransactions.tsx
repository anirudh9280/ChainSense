import { familyColor } from "../lib/families";

export type PopTxnRow = { name: string; pctWallets: number; pctTxns: number };

export default function PopulationVsTransactions({ rows }: { rows: PopTxnRow[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.pctWallets, r.pctTxns]), 1);
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          POPULATION VS. TRANSACTION SHARE
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-muted">
          <Legend dim={false} label="% wallets" />
          <Legend dim label="% transactions" />
        </div>
      </div>

      <div className="mt-5 space-y-5">
        {rows.map((r) => {
          const c = familyColor(r.name);
          const skew = r.pctWallets > 0 ? r.pctTxns / r.pctWallets : 0;
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
                  <span style={{ color: c }}>{r.pctWallets.toFixed(1)}%</span>
                  {" wallets · "}
                  <span className="text-fg">{r.pctTxns.toFixed(1)}%</span>
                  {" txns"}
                  {skew >= 1.6 && (
                    <span className="ml-2 text-amber-300">{skew.toFixed(1)}× active</span>
                  )}
                </span>
              </div>
              <PairBar pct={r.pctWallets} txn={r.pctTxns} max={max} color={c} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PairBar({
  pct,
  txn,
  max,
  color,
}: {
  pct: number;
  txn: number;
  max: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-borderSoft">
        <div
          className="h-full rounded-full"
          style={{ width: `${(pct / max) * 100}%`, background: color }}
        />
      </div>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-borderSoft">
        <div
          className="h-full rounded-full"
          style={{ width: `${(txn / max) * 100}%`, background: color, opacity: 0.4 }}
        />
      </div>
    </div>
  );
}

function Legend({ dim, label }: { dim: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-[3px] w-4 rounded-full bg-fg"
        style={{ opacity: dim ? 0.35 : 0.8 }}
      />
      {label}
    </span>
  );
}
