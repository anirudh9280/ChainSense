import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Static asset paths (served from web/public/data, produced by
// scripts/build_frontend_data.py). The big LUT/feature parquets and the model
// artifacts are NOT here — those are backend-only.
// ---------------------------------------------------------------------------
export const DATA = {
  model: "/data/model_stats.json",
  families: "/data/family_summary.json",
  clusters: "/data/cluster_archetypes.json",
  featureGroups: "/data/feature_groups.json",
  selectors: "/data/top20selectors.json",
  inspector: "/data/inspector_sample.json",
  projections: "/data/projections.json",
  activity: "/data/activity_daily.json",
} as const;

// ---------------------------------------------------------------------------
// Types (mirror the JSON schemas)
// ---------------------------------------------------------------------------
export type ModelStats = {
  algo: string;
  n_clusters: number;
  noise_pct: number;
  n_features: number;
  sample_size: number;
  min_cluster_size: number;
  min_samples: number;
};

export type SeparationFeature = {
  feature: string;
  direction: "up" | "down";
  z: number;
};

export type FamilyEntry = {
  wallets: number;
  pct_wallets: number;
  pct_txns: number;
  clusters: number[];
  median_txns: number;
  radar_raw: Record<string, number>;
  radar: Record<string, number>;
  separation_top_features: SeparationFeature[];
};

export type ClusterMedian = {
  tx_count: number;
  unique_peers: number;
  in_volume_eth: number;
  volume_asymmetry: number | null;
  contract_call_ratio: number;
  distinct_tokens: number;
};

export type ClusterEntry = {
  name: string;
  family: string;
  confidence: string;
  validated: boolean;
  wallets: number;
  pct: number;
  median: ClusterMedian;
};

export type FamilySummary = {
  meta: {
    total_wallets: number;
    total_txns: number;
    n_families: number;
    n_clusters: number;
    radar_axes: string[];
  };
  families: Record<string, FamilyEntry>;
  clusters: Record<string, ClusterEntry>;
};

export type ClusterArchetype = {
  name: string;
  confidence: string;
  validated: boolean;
};
export type ClusterArchetypes = Record<string, ClusterArchetype>;

export type FeatureGroups = Record<string, string[]>;

export type Selector = {
  rank: number;
  selector: string;
  signature: string;
  meaning: string;
  bucket: string;
  verified: boolean;
};
export type Top20Selectors = { top_selectors: Selector[] };

export type ProjectionPoint = {
  x: number;
  y: number;
  cluster: number;
  family: string;
  address: string;
};

export type ActivityDaily = {
  bucketLabel: string;
  families: string[];
  rows: Array<{ t: string } & Record<string, number>>;
};

// Inspector sample: address + raw feature columns. Loosely typed — the raw
// feature panel iterates keys, so we keep it open beyond the known fields.
export type InspectorWallet = {
  address: string;
  family?: string;
  cluster?: number;
  [feature: string]: number | string | undefined;
};

// ---------------------------------------------------------------------------
// Fetch + cache + hook
// ---------------------------------------------------------------------------
const cache = new Map<string, unknown>();

export async function fetchJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const data = (await res.json()) as T;
  cache.set(url, data);
  return data;
}

export type Loaded<T> = { data: T | null; error: string | null; loading: boolean };

export function useJson<T>(url: string): Loaded<T> {
  const [data, setData] = useState<T | null>(() => (cache.get(url) as T) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (cache.has(url)) {
      setData(cache.get(url) as T);
      return;
    }
    fetchJson<T>(url)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, [url]);

  return { data, error, loading: !data && !error };
}

export const useModel = () => useJson<ModelStats>(DATA.model);
export const useFamilies = () => useJson<FamilySummary>(DATA.families);
export const useClusters = () => useJson<ClusterArchetypes>(DATA.clusters);
export const useFeatureGroups = () => useJson<FeatureGroups>(DATA.featureGroups);
export const useSelectors = () => useJson<Top20Selectors>(DATA.selectors);
export const useInspectorSample = () => useJson<InspectorWallet[]>(DATA.inspector);
export const useProjections = () => useJson<ProjectionPoint[]>(DATA.projections);
export const useActivity = () => useJson<ActivityDaily>(DATA.activity);

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------
export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString("en-US");
}

export function pct(n: number, digits = 1): string {
  return n.toFixed(digits) + "%";
}

export function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
