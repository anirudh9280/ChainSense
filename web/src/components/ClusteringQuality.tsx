import type { Snapshot } from "../lib/snapshot";
import {
  explainDaviesBouldin,
  explainInertiaDrop,
  explainSilhouette,
} from "../lib/insights";

export default function ClusteringQuality({
  q,
}: {
  q: Snapshot["clustering"];
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        CLUSTERING QUALITY
      </div>
      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5">
        <Stat
          label="SILHOUETTE"
          value={q.silhouette.toFixed(2)}
          caption={explainSilhouette(q.silhouette)}
        />
        <Stat
          label="DAVIES–BOULDIN"
          value={q.daviesBouldin.toFixed(2)}
          caption={explainDaviesBouldin(q.daviesBouldin)}
        />
        <Stat
          label="K (CLUSTERS)"
          value={q.k.toString()}
          caption="elbow + silhouette"
        />
        <Stat
          label="INERTIA DROP"
          value={`${q.inertiaDropPct}%`}
          caption={explainInertiaDrop(q.inertiaDropPct)}
          accent
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
  accent,
}: {
  label: string;
  value: string;
  caption: string;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] font-semibold tracking-[0.18em] text-muted">
        {label}
      </div>
      <div
        className={`mt-2 font-num text-[22px] font-semibold leading-none ${
          accent ? "text-emerald-300" : "text-fg"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[11px] text-muted">{caption}</div>
    </div>
  );
}
