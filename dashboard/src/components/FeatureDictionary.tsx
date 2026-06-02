import { familyColor } from "../lib/families";
import type { FeatureDictionary } from "../lib/data";

// Short column labels for the cramped matrix header — same set as the
// DECODED SELECTORS × FAMILY view so the two matrices read identically.
const SHORT: Record<string, string> = {
  "Mainstream/Retail": "Retail",
  "DeFi Traders": "DeFi",
  "Holders & Receivers": "Holders",
  "Token-Only": "Token",
  "Bots & Automation": "Bots",
  "Minters": "Mint",
  "Compromised/Phishing": "Phish",
};

// Plain-English headline per feature, shown in place of the raw column name.
const FRIENDLY: Record<string, string> = {
  tx_count: "Transaction count",
  active_days: "Active days",
  tx_per_active_day: "Daily burstiness",
  in_volume_eth: "ETH received",
  volume_asymmetry: "Net flow direction",
  median_tx_interval_sec: "Time between transactions",
  tx_interval_std_sec: "Timing variability",
  same_block_tx_ratio: "Same-block batching",
  median_priority_fee_gwei: "Priority fee paid",
  unique_peers: "Unique counterparties",
  counterparty_concentration_top3: "Top-3 counterparty concentration",
  contract_call_ratio: "Contract-call ratio",
  selector_entropy: "Function-call diversity",
  active_hour_entropy: "Hour-of-day spread",
  distinct_tokens: "Distinct tokens",
  token_churn_rate: "Token churn",
  has_eth_volume: "Moves ETH",
  has_aa: "Account abstraction",
  has_mev: "MEV activity",
};

// Color intensity saturates at |z| = CLAMP; the cell still prints the true z.
const CLAMP = 2;

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

const fmtZ = (z: number) =>
  Math.abs(z) < 0.05 ? "·" : `${z > 0 ? "+" : "−"}${Math.abs(z).toFixed(1)}`;

// Feature × family heatmap. Every model feature, defined, with each family's
// deviation (z-score) in the model's own standardized space. Shares the
// DECODED SELECTORS × FAMILY visual language: bold plain-English headline + grey
// technical name on the left, full-bleed heat cells.
export default function FeatureDictionaryPanel({ data }: { data: FeatureDictionary }) {
  const fams = data.meta.families;

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[11px] font-semibold tracking-[0.18em] text-fg">
        FEATURE DICTIONARY × FAMILY
      </div>
      <div className="mt-1 text-[11.5px] text-fg/70">
        {data.meta.feature_count} behavioral features the model clusters on. Each cell is a z-score —
        how many standard deviations a family sits from the population mean — so larger magnitudes
        mark the features that most distinguish that family.
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-[0.12em] text-fg/65">
              <th className="pb-2 pr-3 font-semibold">Feature</th>
              {fams.map((f) => (
                <th key={f} className="pb-2 px-1 text-center font-semibold">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full" style={{ background: familyColor(f) }} />
                    {SHORT[f] ?? f}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {data.groups.map((g) => (
              <GroupBlock key={g.group} group={g} fams={fams} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 border-t border-borderSoft pt-3 text-[11.5px] text-fg/70">
        z-score = standard deviations from the mean wallet, in the same log-scaled, standardized space
        HDBSCAN clustered on. ±2 saturates the color; the number is exact.
      </div>
    </div>
  );
}

function GroupBlock({
  group,
  fams,
}: {
  group: FeatureDictionary["groups"][number];
  fams: string[];
}) {
  return (
    <>
      <tr>
        <td colSpan={fams.length + 1} className="pt-3.5 pb-1.5">
          <span className="inline-flex items-baseline gap-2">
            <span className="h-3 w-[3px] translate-y-[2px] rounded-full bg-accent-silver/60" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-fg/90">
              {group.group}
            </span>
            <span className="font-num text-[10px] text-mutedSoft">
              {group.features.length} {group.features.length === 1 ? "feature" : "features"}
            </span>
          </span>
        </td>
      </tr>
      {group.features.map((r) => (
        <tr key={r.name} className="border-t border-borderSoft">
          <td className="py-1.5 pr-3 align-top">
            <span className="text-[12px] font-semibold text-fg">
              {FRIENDLY[r.name] ?? r.name}
            </span>
            <div className="mt-0.5 text-[10.5px] leading-snug text-fg/65">{r.def}</div>
          </td>
          {fams.map((f) => {
            const z = r.z[f] ?? 0;
            const pos = z > 0;
            const intensity = Math.min(1, (Math.abs(z) / CLAMP) * 0.9);
            return (
              <td
                key={f}
                className="px-1 text-center align-middle font-num text-[10.5px]"
                style={{
                  background: pos
                    ? hexToRgba(familyColor(f), intensity)
                    : `rgba(120,128,150,${intensity * 0.5})`,
                  color:
                    pos && intensity > 0.5
                      ? "#0c0e14"
                      : Math.abs(z) < 0.05
                        ? "#5b6072"
                        : "#cfd3e0",
                }}
              >
                {fmtZ(z)}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
