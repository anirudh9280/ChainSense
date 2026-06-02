import type { ReactNode } from "react";

export type Insight = {
  title: string;
  body: ReactNode;
  tone: "info" | "warn" | "good" | "danger";
};

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
