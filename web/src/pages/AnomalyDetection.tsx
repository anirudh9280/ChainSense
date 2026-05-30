import { useOutletContext } from "react-router-dom";
import type { Snapshot } from "../lib/snapshot";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";
import AnomalyPressure from "../components/AnomalyPressure";

type Ctx = { snap: Snapshot | null };

export default function AnomalyDetection() {
  const { snap } = useOutletContext<Ctx>();
  if (!snap) return null;

  const series = snap.anomalyPressure.values;
  const peak = series.length ? Math.max(...series) : 0;
  const peakIdx = series.indexOf(peak);
  const peakPct = series.length ? (peakIdx / series.length) * 100 : 0;

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Anomaly Detection"
        subtitle="Volume-pressure z-score derived from the real transaction stream"
      />

      <InsightBanner
        insight={{
          tone: peak >= 2 ? "warn" : "good",
          title:
            peak >= 2
              ? `Volume pressure crossed 2σ — peak ${peak.toFixed(1)}σ at ~${peakPct.toFixed(0)}% into the window`
              : `Volume stayed within ${peak.toFixed(1)}σ across the window — no anomaly trigger`,
          body:
            "Z-score of per-minute transaction count vs a trailing 10-minute baseline. Network-wide signal — sustained 2σ+ pressure is the cheapest first-pass anomaly indicator we can compute from raw tx volume alone.",
        }}
      />

      <div className="mt-5">
        <AnomalyPressure data={series} />
      </div>
    </div>
  );
}
