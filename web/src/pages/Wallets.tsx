import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useInspectorSample,
  useFamilies,
  useFeatureGroups,
  shortAddr,
  type InspectorWallet,
} from "../lib/data";
import { familyColor } from "../lib/families";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";

// Authoritative per-wallet facts come from the backend (it owns the protected
// LUT + feature parquets). The browser only ever resolves the *public*
// cluster -> family/name/confidence mapping, exactly like every other page.
type WalletDetail = {
  address: string;
  found: boolean;
  effective_cluster: number;
  label_source: string | null;
  membership: { score: number | null; basis: string } | null;
  raw: {
    cluster: number;
    cluster_xgb: number;
    cluster_prob: number | null;
    xgb_conf: number | null;
    label_source: string;
  } | null;
  features: Record<string, number | null>;
};

type FetchState = "idle" | "loading" | "notfound" | "error";

const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

async function fetchWallet(addr: string): Promise<WalletDetail | "notfound"> {
  const res = await fetch(`/api/wallet/${addr}`);
  if (res.status === 404) return "notfound";
  if (!res.ok) throw new Error(`/api/wallet ${res.status}`);
  return (await res.json()) as WalletDetail;
}

const CONF: Record<string, string> = {
  high: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  medium: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  low: "border-slate-400/25 bg-slate-400/10 text-slate-300",
};

const SOURCE_LABEL: Record<string, string> = {
  hdbscan: "HDBSCAN core member",
  xgb_predicted: "XGBoost-propagated label",
  xgb_noise: "Noise — no cluster",
};

const humanize = (s: string) => s.replace(/_/g, " ");

function fmtVal(key: string, v: number | null | undefined): string {
  if (v == null) return "—";
  if (key.startsWith("has_")) return v ? "yes" : "no";
  if (Number.isInteger(v) && Math.abs(v) < 1e7) return v.toLocaleString();
  const a = Math.abs(v);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return v.toExponential(2);
  if (a < 1) return v.toFixed(4);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function Wallets() {
  const { data: sample } = useInspectorSample();
  const { data: families } = useFamilies();
  const { data: groups } = useFeatureGroups();

  const [searchParams] = useSearchParams();
  const addrParam = searchParams.get("addr");

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<WalletDetail | null>(null);
  const [status, setStatus] = useState<FetchState>("idle");

  // Deep-link: /wallets?addr=0x… (e.g. from an Anomaly Detection example) preselects
  // that wallet and seeds the search box.
  useEffect(() => {
    if (addrParam && ADDR_RE.test(addrParam)) {
      const a = addrParam.toLowerCase();
      setSelected(a);
      setQuery(a);
    }
  }, [addrParam]);

  // First sample row becomes the default inspected wallet — unless a deep-link addr
  // is taking precedence.
  useEffect(() => {
    if (sample && sample.length && !selected && !addrParam) setSelected(sample[0].address.toLowerCase());
  }, [sample, selected, addrParam]);

  // Any selection (list click or search submit) drives one backend lookup.
  useEffect(() => {
    if (!selected) return;
    let alive = true;
    setStatus("loading");
    fetchWallet(selected)
      .then((r) => {
        if (!alive) return;
        if (r === "notfound") {
          setDetail(null);
          setStatus("notfound");
        } else {
          setDetail(r);
          setStatus("idle");
        }
      })
      .catch((e) => {
        if (!alive) return;
        console.error(e);
        setDetail(null);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (sample ?? []).filter((w) => (q ? w.address.toLowerCase().includes(q) : true));
  }, [sample, query]);

  const familyOfCluster = (cluster: number | undefined) =>
    families?.clusters[String(cluster)]?.family ?? "Unclassified";

  if (!sample || !families || !groups) return <Skeleton />;

  const trimmed = query.trim();
  const canInspectTyped = ADDR_RE.test(trimmed) && !filtered.some((w) => w.address.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Wallet Inspector"
        subtitle="Per-address family assignment and the raw behavioral features behind it"
        status="live lookup · /api/wallet"
      />

      <InsightBanner
        insight={{
          tone: "info",
          title: "Every label here is the model's — never a heuristic",
          body: "An address's effective cluster is its HDBSCAN assignment where it's a core member, or the XGBoost-propagated label where it was noise to HDBSCAN. The raw 26-feature vector shown is exactly what the model embedded — pulled live from the backend, never bundled to the browser.",
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="rounded-xl border border-border bg-panel/60 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ADDR_RE.test(trimmed)) setSelected(trimmed.toLowerCase());
            }}
          >
            <input
              className="w-full rounded-lg border border-borderSoft bg-panel2 px-3 py-2 font-num text-[12.5px] text-fg placeholder:text-mutedSoft focus:outline-none focus:ring-1 focus:ring-sky-400/30"
              placeholder="0x… paste or search an address"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
          </form>

          {canInspectTyped && (
            <button
              onClick={() => setSelected(trimmed.toLowerCase())}
              className="mt-2 w-full rounded-md border border-sky-400/25 bg-sky-400/10 px-3 py-1.5 text-left font-num text-[11.5px] text-sky-300 transition hover:bg-sky-400/15"
            >
              Inspect {shortAddr(trimmed)} →
            </button>
          )}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
              SAMPLE · top-tx per cluster
            </div>
            <span className="text-[10.5px] text-muted">{filtered.length}</span>
          </div>

          <ul className="mt-2 max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((w) => (
              <SampleRow
                key={w.address}
                w={w}
                color={familyColor(familyOfCluster(w.cluster as number | undefined))}
                active={selected === w.address.toLowerCase()}
                onClick={() => setSelected(w.address.toLowerCase())}
              />
            ))}
            {filtered.length === 0 && !canInspectTyped && (
              <li className="px-1 py-6 text-center text-[11.5px] text-mutedSoft">
                No sample match. Paste a full 0x address to inspect it.
              </li>
            )}
          </ul>
        </div>

        <DetailPanel
          status={status}
          detail={detail}
          selected={selected}
          families={families}
          groups={groups}
        />
      </div>
    </div>
  );
}

function SampleRow({
  w,
  color,
  active,
  onClick,
}: {
  w: InspectorWallet;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const txns = typeof w.tx_count === "number" ? w.tx_count : null;
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
          active ? "border-white/10 bg-panel2" : "border-transparent hover:border-borderSoft hover:bg-panel2/60"
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: color }} />
          <span className="font-num text-[12px] text-fg">{shortAddr(w.address)}</span>
        </span>
        {txns != null && <span className="font-num text-[11px] text-muted">{txns.toLocaleString()} tx</span>}
      </button>
    </li>
  );
}

function DetailPanel({
  status,
  detail,
  selected,
  families,
  groups,
}: {
  status: FetchState;
  detail: WalletDetail | null;
  selected: string | null;
  families: NonNullable<ReturnType<typeof useFamilies>["data"]>;
  groups: Record<string, string[]>;
}) {
  if (status === "error")
    return (
      <Card>
        <Note tone="rose">
          Backend lookup failed. Is the API running on <span className="font-num">:8000</span> (launch config{" "}
          <span className="font-num">api</span>)?
        </Note>
      </Card>
    );

  if (status === "notfound")
    return (
      <Card>
        <Note tone="amber">
          <span className="font-num">{selected && shortAddr(selected)}</span> isn't in the modeled set (needs ≥10
          lifetime txns in the 1-year window).
        </Note>
      </Card>
    );

  if (!detail || status === "loading")
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-panel2" />
          <div className="h-3 w-64 rounded bg-panel2" />
          <div className="mt-6 grid grid-cols-2 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-7 rounded bg-panel2" />
            ))}
          </div>
        </div>
      </Card>
    );

  const entry = families.clusters[String(detail.effective_cluster)];
  const family = entry?.family ?? "Unclassified";
  const clusterName = entry ? humanize(entry.name) : `cluster ${detail.effective_cluster}`;
  const color = familyColor(family);
  const score = detail.membership?.score ?? null;
  const basis = detail.membership?.basis ?? "";
  const sourceLabel = detail.label_source ? SOURCE_LABEL[detail.label_source] ?? detail.label_source : "Unlabeled";

  // Group raw features by the taxonomy, rendering only keys present in the
  // response; anything outside the taxonomy lands in "Other" so nothing drops.
  const seen = new Set<string>();
  const grouped: [string, string[]][] = [];
  for (const [g, keys] of Object.entries(groups)) {
    const present = keys.filter((k) => k in detail.features);
    if (present.length) {
      grouped.push([g, present]);
      present.forEach((k) => seen.add(k));
    }
  }
  const other = Object.keys(detail.features).filter((k) => !seen.has(k));
  if (other.length) grouped.push(["Other", other]);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">SELECTED WALLET</div>
          <div className="mt-1 font-num text-[18px] font-semibold text-fg">{shortAddr(detail.address)}</div>
          <div className="mt-0.5 truncate font-num text-[10.5px] text-muted">{detail.address}</div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ color, background: `${color}1a`, boxShadow: `inset 0 0 0 1px ${color}33` }}
        >
          {family}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-borderSoft bg-panel2 px-2 py-1 font-num text-[11px] text-fg/90">
          {clusterName} · cluster {detail.effective_cluster}
        </span>
        {entry?.confidence && (
          <span
            className={`rounded-md border px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
              CONF[entry.confidence] ?? CONF.low
            }`}
          >
            {entry.confidence} conf
          </span>
        )}
        {entry?.validated && (
          <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10.5px] font-semibold text-emerald-300">
            ✓ Etherscan-verified
          </span>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-borderSoft bg-panel2/50 px-3.5 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[11.5px] text-muted">{sourceLabel}</span>
          {score != null && (
            <span className="font-num text-[11.5px] text-fg/85">
              {basis} {score.toFixed(3)}
            </span>
          )}
        </div>
        <div className="mt-1 text-[10.5px] leading-relaxed text-mutedSoft">
          {detail.label_source === "hdbscan"
            ? "Assigned directly by the unsupervised clustering — membership is the HDBSCAN core strength."
            : detail.label_source === "xgb_predicted"
            ? "Noise to HDBSCAN; the classifier propagated the most likely cluster — score is XGBoost confidence."
            : "The classifier could not place this wallet in any cluster."}
        </div>
      </div>

      <div className="mt-5 border-t border-borderSoft pt-4">
        <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          BEHAVIORAL FEATURES · raw, unstandardized
        </div>
        <div className="mt-3 space-y-3.5">
          {grouped.map(([g, keys]) => (
            <div key={g}>
              <div className="text-[11px] font-semibold text-fg/80">{g}</div>
              <dl className="mt-1.5 grid grid-cols-2 gap-x-6 gap-y-1.5 font-num text-[12px]">
                {keys.map((k) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-borderSoft/40 pb-1">
                    <dt className="truncate text-muted" title={k}>
                      {k}
                    </dt>
                    <dd className="shrink-0 text-fg">{fmtVal(k, detail.features[k])}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-panel/60 p-5">{children}</div>;
}

function Note({ tone, children }: { tone: "rose" | "amber"; children: React.ReactNode }) {
  const cls =
    tone === "rose"
      ? "border-rose-500/30 bg-rose-500/10 text-rose-200"
      : "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return <div className={`rounded-lg border px-4 py-3 text-[12px] ${cls}`}>{children}</div>;
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1140px] animate-pulse">
      <div className="h-6 w-40 rounded bg-panel2" />
      <div className="mt-4 h-20 w-full rounded-xl bg-panel2" />
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.5fr]">
        <div className="h-[560px] rounded-xl bg-panel2" />
        <div className="h-[560px] rounded-xl bg-panel2" />
      </div>
    </div>
  );
}
