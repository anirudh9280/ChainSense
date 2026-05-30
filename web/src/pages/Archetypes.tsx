import { useFamilies, useModel } from "../lib/data";
import { FAMILY_ORDER, familyColor } from "../lib/families";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";
import BehavioralRadar, { type RadarFamily } from "../components/BehavioralRadar";
import SeparationRead, { type SeparationFamily } from "../components/SeparationRead";
import FamilyCards, { type FamilyCard, type ClusterInCard } from "../components/ArchetypeCards";

// Show every named family by default. Unclassified (noise) stays as a toggle in the
// legend but starts hidden — its near-flat profile is clutter, not signal.
const RADAR_HIDDEN_BY_DEFAULT = new Set(["Unclassified"]);

const maxAbsZ = (s: SeparationFamily) =>
  Math.max(...s.topFeatures.map((t) => Math.abs(t.z)), 0);

export default function Archetypes() {
  const { data: model } = useModel();
  const { data, error } = useFamilies();

  if (error) return <ErrorCard msg={error} />;
  if (!data) return <Skeleton />;

  const { meta, families, clusters } = data;
  const axes = meta.radar_axes;
  const entries = Object.entries(families);
  const namedClusters = Object.values(clusters).filter((c) => c.family !== "Unclassified").length;

  const radarFamilies: RadarFamily[] = FAMILY_ORDER.filter((nm) => families[nm]).map((nm) => ({
    name: nm,
    color: familyColor(nm),
    radar: families[nm].radar,
  }));

  const sepFamilies: SeparationFamily[] = entries
    .map(([name, f]) => ({
      name,
      color: familyColor(name),
      pct: f.pct_wallets,
      topFeatures: f.separation_top_features,
    }))
    .sort((a, b) => maxAbsZ(b) - maxAbsZ(a));

  const cards: FamilyCard[] = entries
    .map(([name, f]) => {
      const inCards: ClusterInCard[] = f.clusters
        .map((id) => {
          const c = clusters[String(id)];
          if (!c) return null;
          return {
            id,
            name: c.name,
            confidence: c.confidence,
            validated: c.validated,
            wallets: c.wallets,
            pct: c.pct,
          };
        })
        .filter((c): c is ClusterInCard => c !== null)
        .sort((a, b) => b.wallets - a.wallets);
      return {
        name,
        color: familyColor(name),
        wallets: f.wallets,
        pct: f.pct_wallets,
        pctTxns: f.pct_txns,
        medianTxns: f.median_txns,
        clusters: inCards,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Archetypes"
        subtitle={`7 behavioral families + Unclassified · ${namedClusters} HDBSCAN clusters rolled up`}
        status={`${model?.algo ?? "HDBSCAN"} · ${namedClusters} clusters`}
      />

      <InsightBanner
        insight={{
          tone: "info",
          title: "Seven behavioral families, built bottom-up from the clusters",
          body: "Each family's fingerprint is the median behavioral profile across its constituent clusters, normalized 0–1 per axis so the shapes are directly comparable. The separation read ranks the features whose family mean drifts furthest from the population mean (|z|). Compromised/Phishing is the validated showcase family — see Anomaly Detection.",
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <BehavioralRadar
          axes={axes}
          families={radarFamilies}
          defaultVisible={radarFamilies
            .filter((f) => !RADAR_HIDDEN_BY_DEFAULT.has(f.name))
            .map((f) => f.name)}
        />
        <SeparationRead families={sepFamilies} />
      </div>

      <div className="mt-5">
        <FamilyCards cards={cards} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px] animate-pulse">
      <div className="h-6 w-32 rounded bg-panel2" />
      <div className="mt-4 h-20 w-full rounded-xl bg-panel2" />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-[440px] rounded-xl bg-panel2" />
        <div className="h-[440px] rounded-xl bg-panel2" />
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="mx-auto max-w-[1140px]">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-[12.5px] text-rose-200">
        Failed to load Archetypes data: {msg}
      </div>
    </div>
  );
}
