import { useOutletContext } from "react-router-dom";
import type { Snapshot } from "../lib/snapshot";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";
import BehavioralRadar from "../components/BehavioralRadar";
import SeparationRead from "../components/SeparationRead";
import ArchetypeCards from "../components/ArchetypeCards";

type Ctx = { snap: Snapshot | null };

export default function Archetypes() {
  const { snap } = useOutletContext<Ctx>();
  if (!snap) return null;

  const dominant = [...snap.archetypes].sort((a, b) => b.pct - a.pct)[0];

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Archetypes"
        subtitle="The four behavioral clusters and what distinguishes them"
      />

      <InsightBanner
        insight={{
          tone: "info",
          title: `${dominant.name} is the dominant archetype (${dominant.pct.toFixed(1)}%)`,
          body: "Each cluster's fingerprint is the per-archetype mean of the scaled feature vectors, normalized 0–1 per axis so they're directly comparable. The separation-read panel ranks the features whose cluster mean drifts furthest from the population mean.",
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        <BehavioralRadar
          axes={snap.fingerprints.axes}
          fingerprints={snap.fingerprints.values}
        />
        <SeparationRead
          separation={snap.separation.values}
          archetypes={snap.archetypes}
        />
      </div>

      <div className="mt-5">
        <ArchetypeCards cards={snap.archetypeCards.values} />
      </div>
    </div>
  );
}
