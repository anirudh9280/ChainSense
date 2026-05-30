import { ARCH_COLOR_HEX } from "../lib/snapshot";
import type { Snapshot } from "../lib/snapshot";

export default function ArchetypeCards({
  cards,
}: {
  cards: Snapshot["archetypeCards"]["values"];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => {
        const color = ARCH_COLOR_HEX[c.color] ?? "#888";
        return (
          <div
            key={c.archetype}
            className="relative overflow-hidden rounded-xl border border-border bg-panel/70 p-4"
          >
            <div
              className="absolute inset-x-0 top-0 h-[2px]"
              style={{ background: color }}
            />
            <div className="flex items-center justify-between">
              <div className="text-[13px] font-semibold text-fg">
                {c.archetype}
              </div>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: color, boxShadow: `0 0 6px ${color}` }}
              />
            </div>
            <div className="mt-2 font-num text-[11px] text-muted">
              {c.walletCount.toLocaleString()} wallets ·{" "}
              <span className="text-fg/80">{c.pct.toFixed(1)}%</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 font-num text-[11.5px]">
              <Stat label="MEDIAN TXNS" value={c.medianTx.toLocaleString()} />
              <Stat
                label="UNIQUE RECIPIENTS"
                value={c.medianUniqueRecipients.toLocaleString()}
              />
              <Stat
                label="VALUE SENT (ETH)"
                value={c.medianValueSent.toFixed(4)}
              />
              <Stat
                label="VALUE RECV (ETH)"
                value={c.medianValueReceived.toFixed(4)}
              />
              <Stat
                label="CONTRACT-CALL RATIO"
                value={c.medianContractCallRatio.toFixed(3)}
              />
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9.5px] font-semibold tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-fg">{value}</div>
    </div>
  );
}
