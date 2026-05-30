import { useProjections, useFeatureGroups, useSelectors, useClusters } from "../lib/data";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";
import UmapScatter from "../components/UmapScatter";
import SelectorTable from "../components/SelectorTable";

export default function FeatureSpace() {
  const { data: points, error } = useProjections();
  const { data: groups } = useFeatureGroups();
  const { data: selectors } = useSelectors();
  const { data: clusters } = useClusters();

  if (error) return <ErrorCard msg={error} />;
  if (!points || !groups || !selectors) return <Skeleton />;

  const totalFeatures = Object.values(groups).reduce((n, arr) => n + arr.length, 0);
  const clusterName = (id: number) => clusters?.[String(id)]?.name ?? `cluster ${id}`;

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Feature Space"
        subtitle={`${totalFeatures}-dimensional behavioral feature space, projected to 2D via UMAP`}
        status={`UMAP · ${points.length.toLocaleString()} sampled`}
      />

      <InsightBanner
        insight={{
          tone: "info",
          title: "Structure, not scale",
          body: "UMAP places behaviorally similar wallets near each other — the axes carry no units, so read clusters and gaps rather than coordinates. The Compromised/Phishing family separates into its own region purely from behavior; that unsupervised isolation is the showcase finding.",
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <UmapScatter points={points} clusterName={clusterName} />

        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
            FEATURE GROUPS · {totalFeatures}
          </div>
          <div className="mt-1 text-[11.5px] text-muted">
            engineered per wallet, log-transformed + standardized before UMAP
          </div>
          <div className="mt-4 space-y-3.5">
            {Object.entries(groups).map(([group, features]) => (
              <div key={group}>
                <div className="flex items-baseline justify-between">
                  <div className="text-[12px] font-semibold text-fg">{group}</div>
                  <div className="font-num text-[10px] text-mutedSoft">{features.length}</div>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {features.map((f) => (
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
        </div>
      </div>

      <div className="mt-5">
        <SelectorTable selectors={selectors.top_selectors} />
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px] animate-pulse">
      <div className="h-6 w-32 rounded bg-panel2" />
      <div className="mt-4 h-20 w-full rounded-xl bg-panel2" />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="h-[520px] rounded-xl bg-panel2" />
        <div className="h-[520px] rounded-xl bg-panel2" />
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="mx-auto max-w-[1140px]">
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-[12.5px] text-rose-200">
        Failed to load Feature Space data: {msg}
      </div>
    </div>
  );
}
