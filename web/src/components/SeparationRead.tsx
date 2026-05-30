export type SeparationFeature = {
  feature: string;
  direction: "up" | "down";
  z: number;
};

export type SeparationFamily = {
  name: string;
  color: string;
  pct: number;
  topFeatures: SeparationFeature[];
};

const FRIENDLY: Record<string, string> = {
  automation_share: "automation share",
  approve_share: "approve calls",
  selector_entropy: "selector entropy",
  tx_per_active_day: "tx / active day",
  same_block_tx_ratio: "same-block tx ratio",
  volume_asymmetry: "volume asymmetry",
  swap_general_share: "swap calls",
  transfer_share: "transfer calls",
  median_tx_interval_sec: "median tx interval",
  mint_share: "mint calls",
  counterparty_concentration_top3: "top-3 counterparty share",
  contract_call_ratio: "contract-call ratio",
  has_eth_volume: "has ETH volume",
};

function friendly(f: string): string {
  return FRIENDLY[f] ?? f.replace(/_/g, " ");
}

export default function SeparationRead({ families }: { families: SeparationFamily[] }) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        SEPARATION READ
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        what defines each family · top features by |z| vs the population mean
      </div>

      <div className="mt-4 space-y-2.5">
        {families.map((s) => (
          <div
            key={s.name}
            className="rounded-lg border border-borderSoft bg-panel2/60 px-3.5 py-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color, boxShadow: `0 0 6px ${s.color}aa` }}
                />
                {s.name}
              </div>
              <div className="font-num text-[11px] text-muted">{s.pct.toFixed(1)}%</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {s.topFeatures.map((t) => (
                <span
                  key={t.feature}
                  className="inline-flex items-center gap-1.5 rounded-full border border-borderSoft bg-panel/60 px-2 py-0.5 font-num text-[10.5px] text-muted"
                >
                  <span className={t.direction === "up" ? "text-sky-300" : "text-amber-300"}>
                    {t.direction === "up" ? "↑" : "↓"}
                  </span>
                  <span className="text-fg/80">{friendly(t.feature)}</span>
                  <span className="text-mutedSoft">
                    z{t.z >= 0 ? "+" : "−"}
                    {Math.abs(t.z).toFixed(2)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
