import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";
import {
  useFamilies,
  useInspectorSample,
  pct,
  shortAddr,
  type ClusterMedian,
  type InspectorWallet,
} from "../lib/data";
import { familyColor } from "../lib/families";

// The showcase: clusters 2 (drain target) + 5 (funnel) form the Compromised/Phishing
// family — isolated by HDBSCAN on behavior alone, no labels, then Etherscan-checked.
const PHISHING = "Compromised/Phishing";
const PH_COLOR = familyColor(PHISHING); // #F45D7A — the only red in the palette
const POP_COLOR = "#6B7180";
const UP_COLOR = "#5BB6F0";

const humanize = (k: string) => k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

const MEDIAN_ROWS: { key: keyof ClusterMedian; label: string; kind: "count" | "eth" | "ratio" }[] = [
  { key: "tx_count", label: "Median txns", kind: "count" },
  { key: "unique_peers", label: "Unique peers", kind: "count" },
  { key: "distinct_tokens", label: "Distinct tokens", kind: "count" },
  { key: "in_volume_eth", label: "Inflow (ETH)", kind: "eth" },
  { key: "volume_asymmetry", label: "Volume asymmetry", kind: "ratio" },
  { key: "contract_call_ratio", label: "Contract-call ratio", kind: "ratio" },
];

function fmtMedian(kind: string, v: number | null): string {
  if (v == null) return "—";
  if (kind === "count") return v.toLocaleString();
  if (kind === "eth") return v === 0 ? "0" : v.toFixed(3);
  return v.toFixed(2);
}

export default function AnomalyDetection() {
  const { data: fam } = useFamilies();
  const { data: sample } = useInspectorSample();
  if (!fam || !sample) return <Skeleton />;

  const family = fam.families[PHISHING];
  const axes = fam.meta.radar_axes;
  const c2 = fam.clusters["2"];
  const c5 = fam.clusters["5"];

  // Population reference = wallet-weighted mean of each normalized axis across every
  // family. The phishing shape is then read against where the average wallet sits.
  const totalW = Object.values(fam.families).reduce((s, f) => s + f.wallets, 0);
  const popRadar = axes.map(
    (ax) => Object.values(fam.families).reduce((s, f) => s + (f.radar[ax] ?? 0) * f.wallets, 0) / totalW
  );
  const phRadar = axes.map((ax) => family.radar[ax] ?? 0);

  const maxZ = Math.max(1, ...family.separation_top_features.map((f) => Math.abs(f.z)));
  const pick = (cluster: number) => sample.filter((w) => Number(w.cluster) === cluster).slice(0, 5);

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Anomaly Detection"
        subtitle="Compromised &amp; phishing-drained wallets — isolated unsupervised, then validated"
        status="HDBSCAN-isolated · Etherscan-validated"
      />

      <InsightBanner
        insight={{
          tone: "warn",
          title: `${family.wallets.toLocaleString()} wallets flagged compromised — discovered with zero labels`,
          body:
            "No blocklist, no phishing dataset, no supervision. Clustering on behavior alone pulled out two adjacent signatures — drained victim wallets and the funnels that collect from them — that share one tell: value flows almost entirely outward (volume asymmetry ≈ −1). Their family is the only one we then cross-checked on Etherscan.",
        }}
      />

      {/* hero stat band */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Wallets flagged" value={family.wallets.toLocaleString()} accent />
        <Stat label="Of all active wallets" value={pct(family.pct_wallets)} sub={`${pct(family.pct_txns)} of all txns`} />
        <Stat label="Labels used in training" value="0" sub="fully unsupervised" />
        <Stat label="Sub-signatures" value="2" sub="target · funnel" />
      </div>

      {/* radar + signature */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <SectionLabel>BEHAVIORAL SHAPE · phishing family vs. all wallets</SectionLabel>
          <div className="mt-2 flex flex-col items-center">
            <Radar
              axes={axes}
              series={[
                { color: POP_COLOR, values: popRadar, fill: false },
                { color: PH_COLOR, values: phRadar, fill: true },
              ]}
            />
            <div className="mt-2 flex items-center gap-5 text-[11.5px]">
              <Legend color={PH_COLOR} label="Compromised/Phishing" />
              <Legend color={POP_COLOR} label="All wallets (avg)" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <SectionLabel>THE SIGNATURE · standout features vs. population</SectionLabel>
          <div className="mt-5 space-y-3">
            {family.separation_top_features.map((f) => {
              const w = (Math.abs(f.z) / maxZ) * 50;
              const negative = f.z < 0;
              return (
                <div key={f.feature} className="grid grid-cols-[150px_1fr_52px] items-center gap-3">
                  <div className="truncate text-right text-[12px] text-fg" title={humanize(f.feature)}>
                    {humanize(f.feature)}
                  </div>
                  <div className="relative h-[20px] rounded bg-panel2/70">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-borderSoft" />
                    <div
                      className="absolute inset-y-[3px] rounded transition-all"
                      style={
                        negative
                          ? { right: "50%", width: `${w}%`, backgroundColor: PH_COLOR }
                          : { left: "50%", width: `${w}%`, backgroundColor: UP_COLOR }
                      }
                    />
                  </div>
                  <div
                    className="text-right font-num text-[12px] tabular-nums"
                    style={{ color: negative ? PH_COLOR : "#C6CDDD" }}
                  >
                    {f.z > 0 ? "+" : ""}
                    {f.z.toFixed(2)}σ
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-5 text-[12px] leading-relaxed text-muted">
            Distance from the all-wallet mean, in standard deviations.{" "}
            <span className="text-[#F7A8B8]">Red</span> = value leaving the wallet; blue = unusually bursty
            activity. The drain tell is <span className="text-fg">volume asymmetry −1.0σ</span>: money goes one way out.
          </p>
        </div>
      </div>

      {/* two faces */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ClusterCard
          role="Drain target"
          cluster={2}
          name={c2.name}
          wallets={c2.wallets}
          clusterPct={c2.pct}
          median={c2.median}
          note="Victim wallets. A malicious approval or contract empties them — value exits (asymmetry −1), a handful of peers, a single token left behind."
        />
        <ClusterCard
          role="Funnel"
          cluster={5}
          name={c5.name}
          wallets={c5.wallets}
          clusterPct={c5.pct}
          median={c5.median}
          note="Collector wallets. One counterparty, no contract calls, no tokens — a pure outbound conduit that aggregates the stolen funds."
        />
      </div>

      {/* validated examples */}
      <div className="mt-3 rounded-xl border border-border bg-panel/60 p-5">
        <SectionLabel>ETHERSCAN-VALIDATED EXAMPLES · real flagged addresses</SectionLabel>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <ExampleList title="Drain targets · cluster 2" rows={pick(2)} />
          <ExampleList title="Funnel wallets · cluster 5" rows={pick(5)} />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          These addresses were never labeled. HDBSCAN placed them here from behavior alone; spot-checking on
          Etherscan confirms the pattern — drained EOAs and the funnels that sweep them. Open any wallet in the{" "}
          <Link to="/wallets" className="text-sky-300 hover:underline">
            Inspector
          </Link>{" "}
          to see the exact feature vector behind its label.
        </p>
      </div>
    </div>
  );
}

// --- radar (hand-rolled SVG hexagon, no chart lib) -------------------------
function Radar({
  axes,
  series,
}: {
  axes: string[];
  series: { color: string; values: number[]; fill: boolean }[];
}) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const R = 84;
  const n = axes.length;
  const ang = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180);
  const pt = (i: number, v: number): [number, number] => [
    cx + R * v * Math.cos(ang(i)),
    cy + R * v * Math.sin(ang(i)),
  ];
  const polyStr = (vals: number[]) =>
    vals.map((v, i) => pt(i, Math.max(0, Math.min(1, v))).map((x) => x.toFixed(1)).join(",")).join(" ");
  const ringStr = (r: number) => axes.map((_, i) => pt(i, r).map((x) => x.toFixed(1)).join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[300px] overflow-visible" role="img" aria-label="behavioral radar">
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon key={r} points={ringStr(r)} fill="none" stroke="#2A2E3A" strokeWidth={1} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#2A2E3A" strokeWidth={1} />;
      })}
      {series.map((s, si) => (
        <polygon
          key={si}
          points={polyStr(s.values)}
          fill={s.fill ? s.color : "none"}
          fillOpacity={s.fill ? 0.18 : 0}
          stroke={s.color}
          strokeWidth={1.7}
          strokeLinejoin="round"
        />
      ))}
      {axes.map((ax, i) => {
        const [x, y] = pt(i, 1.32);
        const anchor = x > cx + 3 ? "start" : x < cx - 3 ? "end" : "middle";
        return (
          <text key={ax} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontSize="9" fill="#8A90A2">
            {ax}
          </text>
        );
      })}
    </svg>
  );
}

// --- small building blocks -------------------------------------------------
function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">{children}</div>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1 font-num text-[20px] tabular-nums ${accent ? "" : "text-fg"}`} style={accent ? { color: PH_COLOR } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function ClusterCard({
  role,
  cluster,
  name,
  wallets,
  clusterPct,
  median,
  note,
}: {
  role: string;
  cluster: number;
  name: string;
  wallets: number;
  clusterPct: number;
  median: ClusterMedian;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PH_COLOR }} />
            <span className="text-[13px] font-semibold text-fg">{role}</span>
            <span className="font-num text-[11px] text-muted">cluster {cluster}</span>
          </div>
          <div className="mt-0.5 font-num text-[11.5px] text-muted">{name}</div>
        </div>
        <div className="text-right">
          <div className="font-num text-[15px] tabular-nums text-fg">{wallets.toLocaleString()}</div>
          <div className="text-[11px] text-muted">{pct(clusterPct)} of all</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {MEDIAN_ROWS.map((r) => {
          const v = median[r.key];
          const hallmark =
            (r.key === "volume_asymmetry" && v === -1) ||
            (r.key === "unique_peers" && typeof v === "number" && v <= 1) ||
            (r.key === "distinct_tokens" && v === 0) ||
            (r.key === "contract_call_ratio" && v === 0);
          return (
            <div key={r.key} className="rounded-md border border-borderSoft bg-panel2/40 px-2.5 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-muted">{r.label}</div>
              <div
                className="font-num text-[13px] tabular-nums"
                style={{ color: hallmark ? PH_COLOR : "#D7DCE8" }}
              >
                {fmtMedian(r.kind, v)}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-muted">{note}</p>
    </div>
  );
}

function ExampleList({ title, rows }: { title: string; rows: InspectorWallet[] }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-muted">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {rows.map((w) => (
          <li
            key={w.address}
            className="flex items-center gap-2 rounded-md border border-borderSoft bg-panel2/50 px-3 py-1.5"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PH_COLOR }} />
            <span className="font-num text-[12px] text-fg">{shortAddr(w.address)}</span>
            <span className="flex-1" />
            <Link
              to={`/wallets?addr=${w.address}`}
              className="font-num text-[11px] text-sky-300 hover:underline"
            >
              Inspect →
            </Link>
            <a
              href={`https://etherscan.io/address/${w.address}`}
              target="_blank"
              rel="noreferrer"
              className="font-num text-[11px] text-muted hover:text-fg"
            >
              Etherscan ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px]">
      <div className="h-8 w-56 animate-pulse rounded bg-panel2/60" />
      <div className="mt-6 h-24 animate-pulse rounded-xl bg-panel2/40" />
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-panel2/40" />
        ))}
      </div>
    </div>
  );
}
