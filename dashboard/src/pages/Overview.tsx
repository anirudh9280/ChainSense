import { orderFamilies } from "../lib/families";
import { useModel, useFamilies, useActivity, compact, pct } from "../lib/data";
import PageHeader from "../components/PageHeader";
import MetricTile from "../components/MetricTile";
import PopulationVsTransactions, { type PopTxnRow } from "../components/PopulationVsTransactions";
import StackedActiveChart from "../components/StackedActiveChart";

export default function Overview() {
  const { data: model } = useModel();
  const { data: summary, error } = useFamilies();
  const { data: activity } = useActivity();

  if (error) return <ErrorCard msg={error} />;
  if (!model || !summary) return <Skeleton />;

  const meta = summary.meta;
  const fams = Object.entries(summary.families).filter(([name]) => name !== "Unclassified");

  const popTxnRows: PopTxnRow[] = orderFamilies(fams, (f) => f.pct_wallets).map(
    ([name, f]) => ({ name, pctWallets: f.pct_wallets, pctTxns: f.pct_txns })
  );

  const unclassified = summary.families["Unclassified"];

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Overview"
        subtitle="Ethereum mainnet · active EOAs with ≥10 txns over a 1-year window, clustered by behavior"
      />

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Wallets Clustered" value={compact(meta.total_wallets)} caption="active EOAs · ≥10 txns" accent="blue" />
        <MetricTile label="Transactions" value={compact(meta.total_txns)} caption="1-year lifetime window" accent="green" />
        <MetricTile label="Clusters" value={model.n_clusters} caption={`${model.algo} · ${model.n_features} features`} accent="purple" />
        <MetricTile label="Unclassified" value={pct(unclassified.pct_wallets)} caption={`noise class · ${pct(unclassified.pct_txns)} of txns`} accent="red" />
      </div>

      <div className="mt-5">
        {activity ? (
          <StackedActiveChart activity={activity} />
        ) : (
          <div className="h-[320px] animate-pulse rounded-xl border border-border bg-panel/60" />
        )}
      </div>

      <div className="mt-5">
        <PopulationVsTransactions rows={popTxnRows} />
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
