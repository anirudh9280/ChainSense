import { useOutletContext } from "react-router-dom";
import type { Snapshot } from "../lib/snapshot";
import PageHeader from "../components/PageHeader";
import PcaScatter from "../components/PcaScatter";
import InsightBanner from "../components/InsightBanner";

type Ctx = { snap: Snapshot | null };

// Real columns from dashboard/demo_data/wallet_features.csv (sans `wallet`).
const FEATURE_GROUPS: { group: string; features: string[] }[] = [
  {
    group: "Activity",
    features: ["tx_count", "tx_frequency"],
  },
  {
    group: "Value flow",
    features: ["total_value_eth_sent", "total_value_eth_received"],
  },
  {
    group: "Cost",
    features: ["avg_gas"],
  },
  {
    group: "Counterparty",
    features: ["unique_recipients", "unique_senders", "contract_call_ratio"],
  },
  {
    group: "Tokens",
    features: [
      "tokens_sent_count",
      "tokens_received_count",
      "unique_tokens_sent",
      "unique_tokens_received",
    ],
  },
];

export default function FeatureSpace() {
  const { snap } = useOutletContext<Ctx>();
  if (!snap) return null;
  const points = snap.pcaPoints.values;

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Feature Space"
        subtitle={`${snap.metrics.featuresPerWallet}-dim wallet feature space, projected to 2D via PCA`}
      />

      <InsightBanner
        insight={{
          tone: snap.clustering.silhouette >= 0.5 ? "good" : "warn",
          title: `K-Means separation is ${snap.clustering.silhouette >= 0.5 ? "clean" : "modest"} on this slice (silhouette ${snap.clustering.silhouette.toFixed(2)})`,
          body: `Davies–Bouldin ${snap.clustering.daviesBouldin.toFixed(2)} and inertia drop ${snap.clustering.inertiaDropPct}% vs k=1 — ${snap.clustering.silhouette >= 0.5 ? "boundaries hold up under leave-one-out resampling." : "boundaries blur where archetypes share counterparty patterns (e.g. bots and active DeFi users overlap on the right cluster)."}`,
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <PcaScatter points={points} featureCount={snap.metrics.featuresPerWallet} />

        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
            FEATURE GROUPS · {snap.metrics.featuresPerWallet}
          </div>
          <div className="mt-4 space-y-4">
            {FEATURE_GROUPS.map((g) => (
              <div key={g.group}>
                <div className="text-[12px] font-semibold text-fg">{g.group}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {g.features.map((f) => (
                    <span
                      key={f}
                      className="rounded-full border border-borderSoft bg-panel2 px-2 py-0.5 font-num text-[10.5px] text-muted"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 border-t border-borderSoft pt-3 font-num text-[10.5px] text-mutedSoft">
            {snap.pcaPoints._provenance}
          </div>
        </div>
      </div>
    </div>
  );
}
