import { useFamilies, useFeatureDictionary } from "../lib/data";
import { FAMILY_ORDER, familyColor } from "../lib/families";
import PageHeader from "../components/PageHeader";
import BehavioralRadar, { type RadarFamily } from "../components/BehavioralRadar";
import FeatureDictionaryPanel from "../components/FeatureDictionary";

// Unclassified (noise) is excluded from this page entirely — its near-flat profile
// is clutter, not signal. It still lives on Cluster Analysis as the noise class.
const EXCLUDED = new Set(["Unclassified"]);

// Display-only relabel: the family keys "Compromised/Phishing" (clusters 2 + 5 —
// phishing_drain_target and phishing_drain_funnel) under one phishing umbrella.
// We surface it as just "Phishing" here. Keyed by the original name so colors and
// the radar/dictionary data still resolve against the underlying JSON.
const DISPLAY_NAME: Record<string, string> = { "Compromised/Phishing": "Phishing" };

export default function FeatureAnalysis() {
  const { data, error } = useFamilies();
  const { data: dict } = useFeatureDictionary();

  if (error) return <ErrorCard msg={error} />;
  if (!data) return <Skeleton />;

  const { meta, families } = data;
  const axes = meta.radar_axes;

  const radarFamilies: RadarFamily[] = FAMILY_ORDER.filter(
    (nm) => families[nm] && !EXCLUDED.has(nm)
  ).map((nm) => ({
    name: DISPLAY_NAME[nm] ?? nm,
    color: familyColor(nm),
    radar: families[nm].radar,
    radarRaw: families[nm].radar_raw,
    pctWallets: families[nm].pct_wallets,
    pctTxns: families[nm].pct_txns,
    wallets: families[nm].wallets,
    medianTxns: families[nm].median_txns,
    signature: families[nm].separation_top_features,
  }));

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Feature Analysis"
        subtitle="What makes each family different — every behavioral feature, defined and tied to the families that over- or under-index on it"
      />

      <div className="mt-5 flex flex-col gap-5">
        {/* Overview radar up top. */}
        <BehavioralRadar axes={axes} families={radarFamilies} />

        {/* The workhorse — every feature, defined, with per-family heat. */}
        {dict && <FeatureDictionaryPanel data={dict} />}
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
        Failed to load Feature Analysis data: {msg}
      </div>
    </div>
  );
}
