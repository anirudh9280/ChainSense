export type Archetype = {
  name: string;
  count: number;
  pct: number;
  txnSharePct: number;
  color: string;
};

export type SampleWallet = {
  addr: string;
  short: string;
  archetype: string;
  txns: number;
  totalSentEth: number;
  totalReceivedEth: number;
  avgGas: number;
  uniqueRecipients: number;
  uniqueSenders: number;
  contractCallRatio: number;
  txFrequency: number;
  tokensSent: number;
  tokensReceived: number;
  uniqueTokensSent: number;
  uniqueTokensReceived: number;
};

export type PcaJsonPoint = {
  x: number;
  y: number;
  cls: "longterm" | "traders" | "nft" | "bots";
  arch: string;
};

export type TapeRow = {
  block: number;
  from: string;
  to: string;
  valueWei: string;
  txType: "transfer" | "swap" | "stake" | "nft" | "mev";
};

type WithProvenance<T> = { values: T; _provenance: string };

export type Snapshot = {
  _dataSource: {
    wallets: string;
    transactions: string;
    projections: string;
    subscriberDir: string | null;
    generatedAt: string;
  };
  meta: {
    network: string;
    windowHours: number;
    blockStart: string;
    blockEnd: string;
    status: "snapshot · indexed" | "live" | "stale";
  };
  medallion: {
    bronze: { rows: string; label: string; _provenance: string };
    silver: { rows: string; label: string; _provenance: string };
    gold: { rows: string; label: string; _provenance: string };
    model: { algo: string; silhouette: number; _provenance: string };
  };
  metrics: {
    walletsLabeled: string;
    txnsProcessed: string;
    eventsDecoded: string | null;
    featuresPerWallet: number;
    activeWalletsPerMin: string;
    flaggedForReview: number | null;
    flaggedPct: number | null;
    portfolioUnderLens: string | null;
    medianRisk: number | null;
    _provenance: Record<string, string>;
  };
  classifier: {
    model: string | null;
    auc: number | null;
    ingestRateTxs: number | null;
    lastBlockLagSec: number | null;
    _provenance: string;
  };
  archetypes: Archetype[];
  clustering: {
    silhouette: number;
    daviesBouldin: number;
    k: number;
    inertiaDropPct: number;
    _provenance: string;
  };
  activeSeries: WithProvenance<number[]> & { bucketLabel: string };
  activeByArchetype: {
    buckets: string[];
    series: Record<string, number[]>;
    bucketLabel: string;
    _provenance: string;
  };
  fingerprints: {
    values: {
      archetype: string;
      color: string;
      axes: Record<string, number>;
    }[];
    axes: string[];
    _provenance: string;
  };
  separation: {
    values: {
      archetype: string;
      topFeatures: { feature: string; direction: "high" | "low" }[];
    }[];
    _provenance: string;
  };
  archetypeCards: {
    values: {
      archetype: string;
      color: string;
      walletCount: number;
      pct: number;
      medianTx: number;
      medianValueSent: number;
      medianValueReceived: number;
      medianUniqueRecipients: number;
      medianContractCallRatio: number;
    }[];
    _provenance: string;
  };
  anomalyPressure: WithProvenance<number[]>;
  riskDistribution: WithProvenance<{ bucket: string; count: number }[] | null>;
  flaggedWallets: WithProvenance<
    { addr: string; archetype: string; risk: number; reason: string }[] | null
  >;
  pcaPoints: WithProvenance<PcaJsonPoint[]>;
  sampleWallets: WithProvenance<SampleWallet[]>;
  liveTape: WithProvenance<TapeRow[]>;
};

let cached: Snapshot | null = null;

export async function loadSnapshot(): Promise<Snapshot> {
  if (cached) return cached;
  const res = await fetch("/snapshot.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`snapshot.json: ${res.status}`);
  cached = (await res.json()) as Snapshot;
  return cached;
}

export const ARCH_COLOR_HEX: Record<string, string> = {
  longterm: "#54E0A8",
  traders: "#5BB6F0",
  nft: "#B488F0",
  bots: "#F0A24A",
  flagged: "#F45D7A",
};

export function archColorHex(archetype: Archetype | string, archetypes?: Archetype[]) {
  if (typeof archetype === "string") {
    const found = archetypes?.find((a) => a.name === archetype);
    return ARCH_COLOR_HEX[found?.color ?? "traders"];
  }
  return ARCH_COLOR_HEX[archetype.color];
}
