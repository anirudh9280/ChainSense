import { useOutletContext } from "react-router-dom";
import type { Snapshot } from "../lib/snapshot";
import { buildOverviewInsights } from "../lib/insights";
import PageHeader from "../components/PageHeader";
import MedallionStrip from "../components/MedallionStrip";
import MetricTile from "../components/MetricTile";
import InsightBanner from "../components/InsightBanner";
import ArchetypeDistribution from "../components/ArchetypeDistribution";
import PopulationVsTransactions from "../components/PopulationVsTransactions";
import ClusteringQuality from "../components/ClusteringQuality";
import StackedActiveChart from "../components/StackedActiveChart";
import { DataSourceBanner } from "../components/MissingData";

type Ctx = { snap: Snapshot | null };

export default function Overview() {
  const { snap } = useOutletContext<Ctx>();
  if (!snap) return <Skeleton />;
  const insights = buildOverviewInsights(snap);

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Overview"
        subtitle={`Ethereum mainnet · ${snap.meta.windowHours}h slice · ${snap.metrics.walletsLabeled} wallets · ${snap.metrics.txnsProcessed} transactions`}
        status={snap.meta.status}
      />

      <DataSourceBanner
        walletsPath={snap._dataSource.wallets}
        txnsPath={snap._dataSource.transactions}
        generatedAt={snap._dataSource.generatedAt}
      />

      <div className="mt-5">
        <MedallionStrip m={snap.medallion} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricTile label="Wallets Labeled" value={snap.metrics.walletsLabeled} caption="clusters CSV" accent="blue" />
        <MetricTile label="Transactions" value={snap.metrics.txnsProcessed} caption={`${snap.meta.windowHours}h window`} accent="green" />
        <MetricTile label="Features / Wallet" value={snap.metrics.featuresPerWallet} caption="engineered" accent="amber" />
        <MetricTile label="Active Wallets / Min" value={snap.metrics.activeWalletsPerMin} caption="1-min unique" accent="cyan" />
      </div>

      {insights.length > 0 && (
        <div className="mt-5 space-y-3">
          {insights.map((i, k) => (
            <InsightBanner key={k} insight={i} />
          ))}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ArchetypeDistribution rows={snap.archetypes} total={snap.metrics.walletsLabeled} />
        <PopulationVsTransactions rows={snap.archetypes} />
      </div>

      <div className="mt-5">
        <StackedActiveChart
          data={snap.activeByArchetype}
          archetypes={snap.archetypes}
        />
      </div>

      <div className="mt-5">
        <ClusteringQuality q={snap.clustering} />
      </div>

      <div className="mt-8 text-[11.5px] text-muted">
        {snap.metrics.walletsLabeled} wallets · {snap.metrics.featuresPerWallet} engineered features · {snap.medallion.model.algo}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px] animate-pulse">
      <div className="h-6 w-32 rounded bg-panel2" />
      <div className="mt-4 h-28 w-full rounded-xl bg-panel2" />
    </div>
  );
}
