import { useProjections, useFeatureGroups, useClusters, useFamilies, compact } from "../lib/data";
import { orderFamilies } from "../lib/families";
import PageHeader from "../components/PageHeader";
import UmapScatter from "../components/UmapScatter";
import FamilyRoster, { type RosterFamily, type RosterCluster } from "../components/FamilyRoster";

export default function ClusterAnalysis() {
  const { data: points, error } = useProjections();
  const { data: groups } = useFeatureGroups();
  const { data: clusters } = useClusters();
  const { data: summary } = useFamilies();

  if (error) return <ErrorCard msg={error} />;
  if (!points || !groups) return <Skeleton />;

  const totalFeatures = Object.values(groups).reduce((n, arr) => n + arr.length, 0);
  const clusterName = (id: number) => clusters?.[String(id)]?.name ?? `cluster ${id}`;

  const fams = Object.entries(summary?.families ?? {}).filter(([name]) => name !== "Unclassified");
  const rosterFamilies: RosterFamily[] = orderFamilies(fams, (f) => f.pct_wallets).map(
    ([name, f]) => ({
      name,
      wallets: f.wallets,
      pct: f.pct_wallets,
      clusters: f.clusters
        .map((id): RosterCluster | null => {
          const c = summary?.clusters[String(id)];
          return c
            ? { id, name: c.name, validated: c.validated, confidence: c.confidence, wallets: c.wallets }
            : null;
        })
        .filter((c): c is RosterCluster => c !== null)
        .sort((a, b) => b.wallets - a.wallets),
    })
  );

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Cluster Analysis"
        subtitle={`${totalFeatures}-dimensional behavioral feature space, projected to 2D via UMAP`}
      />

      <div className="mt-5 flex flex-col gap-4">
        <UmapScatter points={points} clusterName={clusterName} />
        {summary && rosterFamilies.length > 0 && (
          <FamilyRoster families={rosterFamilies} total={compact(summary.meta.total_wallets)} />
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px] animate-pulse">
      <div className="h-6 w-32 rounded bg-panel2" />
      <div className="mt-4 h-20 w-full rounded-xl bg-panel2" />
      <div className="mt-4 flex flex-col gap-4">
        <div className="h-[520px] rounded-xl bg-panel2" />
        <div className="h-[240px] rounded-xl bg-panel2" />
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="mx-auto max-w-[1140px]">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-[12.5px] text-rose-200">
        Failed to load Cluster Analysis data: {msg}
      </div>
    </div>
  );
}
