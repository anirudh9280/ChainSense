import { archColorHex } from "../lib/snapshot";
import type { Snapshot } from "../lib/snapshot";

const FRIENDLY: Record<string, string> = {
  tx_count: "transaction count",
  tx_frequency: "tx frequency",
  total_value_eth_sent: "ETH sent",
  total_value_eth_received: "ETH received",
  avg_gas: "avg gas",
  unique_recipients: "unique recipients",
  unique_senders: "unique senders",
  contract_call_ratio: "contract-call ratio",
  tokens_sent_count: "tokens sent",
  tokens_received_count: "tokens received",
  unique_tokens_sent: "unique tokens sent",
  unique_tokens_received: "unique tokens received",
};

export default function SeparationRead({
  separation,
  archetypes,
}: {
  separation: Snapshot["separation"]["values"];
  archetypes: Snapshot["archetypes"];
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        SEPARATION READ
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        what distinguishes each cluster · top features by |z-score| vs population
      </div>

      <div className="mt-4 space-y-3">
        {separation.map((s) => {
          const arch = archetypes.find((a) => a.name === s.archetype);
          if (!arch) return null;
          const c = archColorHex(arch);
          return (
            <div
              key={s.archetype}
              className="rounded-lg border border-borderSoft bg-panel2/60 px-3.5 py-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: c, boxShadow: `0 0 6px ${c}aa` }}
                  />
                  {s.archetype}
                </div>
                <div className="font-num text-[11px] text-muted">
                  {arch.pct.toFixed(1)}%
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
                <span>defined by</span>
                {s.topFeatures.map((t, i) => (
                  <span
                    key={t.feature}
                    className="inline-flex items-center gap-1 rounded-full border border-borderSoft px-2 py-0.5 font-num text-[10.5px]"
                  >
                    <span
                      className={
                        t.direction === "high"
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {t.direction === "high" ? "↑" : "↓"}
                    </span>
                    {FRIENDLY[t.feature] ?? t.feature}
                    {i === 0 && s.topFeatures.length > 1 && (
                      <span className="text-mutedSoft"> &nbsp;</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
