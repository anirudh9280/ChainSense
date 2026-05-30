import type { Snapshot } from "./snapshot";

export type Insight = {
  title: string;
  body: string;
  tone: "info" | "warn" | "good";
};

export function buildOverviewInsights(s: Snapshot): Insight[] {
  const out: Insight[] = [];
  const sorted = [...s.archetypes].sort((a, b) => b.txnSharePct - a.txnSharePct);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  if (top && top.txnSharePct >= top.pct * 1.4) {
    out.push({
      tone: "info",
      title: `${top.name} punches above their weight on traffic`,
      body: `${top.name} are ${top.pct.toFixed(1)}% of wallets but generate ${top.txnSharePct.toFixed(1)}% of transactions in this window — a ${(top.txnSharePct / Math.max(top.pct, 0.1)).toFixed(1)}× concentration ratio.`,
    });
  }

  const dormant = s.archetypes.find(
    (a) => a.pct >= 20 && a.txnSharePct < a.pct * 0.6
  );
  if (dormant) {
    out.push({
      tone: "good",
      title: `${dormant.name} dominate population, not activity`,
      body: `${dormant.pct.toFixed(1)}% of wallets are ${dormant.name.toLowerCase()}, but they account for only ${dormant.txnSharePct.toFixed(1)}% of transactions — capital sits still while other archetypes churn the chain.`,
    });
  }

  if (bottom && bottom.pct < 5) {
    out.push({
      tone: "warn",
      title: `${bottom.name} are rare in the sample (${bottom.count.toLocaleString()} wallets)`,
      body: `Only ${bottom.pct.toFixed(2)}% of wallets fall into this archetype. Small samples weaken any per-archetype stat — interpret the ${bottom.txnSharePct.toFixed(1)}% txn share with caution.`,
    });
  }

  return out;
}

export function explainSilhouette(v: number) {
  if (v >= 0.7) return "well-separated clusters";
  if (v >= 0.5) return "reasonable structure";
  if (v >= 0.25) return "weak but defensible structure";
  return "clusters overlap heavily";
}

export function explainDaviesBouldin(v: number) {
  if (v <= 0.5) return "tight, isolated clusters";
  if (v <= 1.0) return "acceptable separation";
  if (v <= 1.5) return "clusters bleed into each other";
  return "poor separation";
}

export function explainInertiaDrop(pct: number) {
  const mag = Math.abs(pct);
  if (mag >= 60) return "strong elbow vs k=1";
  if (mag >= 40) return "clear elbow signal";
  return "weak elbow — try other k";
}
