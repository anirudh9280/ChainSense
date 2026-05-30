import { PHISHING_FAMILY, orderFamilies } from "../lib/families";
import { useModel, useFamilies, useActivity, compact, pct } from "../lib/data";
import PageHeader from "../components/PageHeader";
import MetricTile from "../components/MetricTile";
import InsightBanner from "../components/InsightBanner";
import ArchetypeDistribution, { type DistRow } from "../components/ArchetypeDistribution";
import PopulationVsTransactions, { type PopTxnRow } from "../components/PopulationVsTransactions";
import StackedActiveChart from "../components/StackedActiveChart";

export default function Overview() {
  const { data: model } = useModel();
  const { data: summary, error } = useFamilies();
  const { data: activity } = useActivity();

  if (error) return <ErrorCard msg={error} />;
  if (!model || !summary) return <Skeleton />;

  const meta = summary.meta;
  const fams = Object.entries(summary.families);

  const distRows: DistRow[] = orderFamilies(fams, (f) => f.pct_wallets).map(
    ([name, f]) => ({ name, wallets: f.wallets, pct: f.pct_wallets, clusters: f.clusters.length })
  );
  const popTxnRows: PopTxnRow[] = orderFamilies(fams, (f) => f.pct_wallets).map(
    ([name, f]) => ({ name, pctWallets: f.pct_wallets, pctTxns: f.pct_txns })
  );

  const phish = summary.families[PHISHING_FAMILY];
  const unclassified = summary.families["Unclassified"];

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Cluster Analysis"
        subtitle={`Ethereum mainnet · ${compact(meta.total_wallets)} wallets · ${compact(
          meta.total_txns
        )} transactions · ${model.n_features} behavioral features`}
        status={`${model.algo} · ${model.n_clusters} clusters`}
      />

      <div className="space-y-3">
        <InsightBanner
          insight={{
            tone: "warn",
            title: `Two clusters (2 & 5) surfaced as phishing-victim drain wallets — with no labels`,
            body: `HDBSCAN isolated the ${PHISHING_FAMILY} family (${compact(
              phish.wallets
            )} wallets, ${pct(phish.pct_wallets)} of population) purely from behavior: near-total outflow (volume_asymmetry ≈ −1), few counterparties, minimal token diversity. Both clusters were validated against Etherscan after the fact. This is the showcase result — see Anomaly Detection.`,
          }}
        />
        <InsightBanner
          insight={{
            tone: "info",
            title: `Unclassified wallets are ${pct(unclassified.pct_wallets)} of the population but ${pct(
              unclassified.pct_txns
            )} of transactions`,
            body: `The noise class (HDBSCAN −1) concentrates the high-frequency, hard-to-segment tail. Behavioral structure is clearest in the named families; the heavy transactional volume lives in the long tail.`,
          }}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Wallets Clustered" value={compact(meta.total_wallets)} caption="active EOAs · ≥10 txns" accent="blue" />
        <MetricTile label="Transactions" value={compact(meta.total_txns)} caption="1-year lifetime window" accent="green" />
        <MetricTile label="Clusters" value={model.n_clusters} caption={`${model.algo} · ${model.n_features} features`} accent="purple" />
        <MetricTile label="Unclassified" value={pct(unclassified.pct_wallets)} caption={`noise class · ${pct(unclassified.pct_txns)} of txns`} accent="red" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ArchetypeDistribution rows={distRows} total={compact(meta.total_wallets)} />
        <PopulationVsTransactions rows={popTxnRows} />
      </div>

      <div className="mt-5">
        {activity ? (
          <StackedActiveChart activity={activity} />
        ) : (
          <div className="h-[320px] animate-pulse rounded-xl border border-border bg-panel/60" />
        )}
      </div>

      <div className="mt-8 text-[11.5px] text-muted">
        {compact(meta.total_wallets)} wallets · {model.n_features} features · {model.algo}
        (min_cluster_size {model.min_cluster_size.toLocaleString()}, min_samples {model.min_samples})
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px] animate-pulse">
      <div className="h-6 w-32 rounded bg-panel2" />
      <div className="mt-4 h-28 w-full rounded-xl bg-panel2" />
      <div className="mt-4 grid grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-panel2" />
        ))}
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="mx-auto max-w-[1140px]">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-[12.5px] text-rose-200">
        Failed to load Overview data: {msg}
      </div>
    </div>
  );
}
