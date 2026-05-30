import { useMemo, useState } from "react";
import type { ProjectionPoint } from "../lib/data";
import { shortAddr } from "../lib/data";
import { FAMILY_ORDER, familyColor } from "../lib/families";

const W = 720;
const H = 480;
const PAD = 26;

// Draw order: noise underneath, the phishing showcase on top so its island pops.
const z = (f: string) => (f === "Unclassified" ? 0 : f === "Compromised/Phishing" ? 2 : 1);

export default function UmapScatter({
  points,
  clusterName,
}: {
  points: ProjectionPoint[];
  clusterName?: (id: number) => string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<ProjectionPoint | null>(null);

  const [minX, maxX, minY, maxY] = useMemo(() => {
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    for (const p of points) {
      if (p.x < a) a = p.x;
      if (p.x > b) b = p.x;
      if (p.y < c) c = p.y;
      if (p.y > d) d = p.y;
    }
    return [a, b, c, d] as const;
  }, [points]);

  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - 2 * PAD);

  const present = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) counts.set(p.family, (counts.get(p.family) ?? 0) + 1);
    return FAMILY_ORDER.filter((f) => counts.has(f)).map((f) => ({ f, n: counts.get(f)! }));
  }, [points]);

  const draw = useMemo(
    () => points.filter((p) => !hidden.has(p.family)).slice().sort((a, b) => z(a.family) - z(b.family)),
    [points, hidden]
  );

  const tip = hovered;
  const tipName = tip ? (clusterName ? clusterName(tip.cluster) : `cluster ${tip.cluster}`) : "";

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[13px] font-semibold text-fg">Behavioral embedding · UMAP</div>
          <div className="mt-0.5 text-[11px] text-muted">
            {points.length.toLocaleString()} wallets sampled · colored by family · click legend to filter
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" style={{ maxHeight: H }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={`gx${i}`}
              x1={PAD + (i * (W - 2 * PAD)) / 5}
              y1={PAD}
              x2={PAD + (i * (W - 2 * PAD)) / 5}
              y2={H - PAD}
              stroke="rgba(255,255,255,0.04)"
            />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`gy${i}`}
              x1={PAD}
              y1={PAD + (i * (H - 2 * PAD)) / 4}
              x2={W - PAD}
              y2={PAD + (i * (H - 2 * PAD)) / 4}
              stroke="rgba(255,255,255,0.04)"
            />
          ))}

          {draw.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={p.family === "Compromised/Phishing" ? 3 : 2.6}
              fill={familyColor(p.family)}
              fillOpacity={p.family === "Unclassified" ? 0.5 : 0.82}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {tip && (
            <g pointerEvents="none">
              <circle cx={sx(tip.x)} cy={sy(tip.y)} r={5} fill="none" stroke={familyColor(tip.family)} strokeWidth={1.5} />
              <rect
                x={Math.min(sx(tip.x) + 8, W - 246)}
                y={Math.max(sy(tip.y) - 44, 4)}
                rx={4}
                width={238}
                height={40}
                fill="#0A0B0F"
                stroke="rgba(255,255,255,0.12)"
              />
              <text
                x={Math.min(sx(tip.x) + 16, W - 238)}
                y={Math.max(sy(tip.y) - 29, 19)}
                fill={familyColor(tip.family)}
                fontSize="10.5"
                fontWeight="600"
                fontFamily="Inter, system-ui"
              >
                {tip.family} · {tipName.replace(/_/g, " ")}
              </text>
              <text
                x={Math.min(sx(tip.x) + 16, W - 238)}
                y={Math.max(sy(tip.y) - 15, 33)}
                fill="#8A8FA0"
                fontSize="9.5"
                fontFamily="JetBrains Mono, monospace"
              >
                {shortAddr(tip.address)} · ({tip.x.toFixed(2)}, {tip.y.toFixed(2)})
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px]">
        {present.map(({ f, n }) => {
          const off = hidden.has(f);
          return (
            <button
              key={f}
              onClick={() =>
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(f)) next.delete(f);
                  else next.add(f);
                  return next;
                })
              }
              className={`flex items-center gap-1.5 transition ${off ? "opacity-35" : ""}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: familyColor(f), boxShadow: off ? "none" : `0 0 6px ${familyColor(f)}` }}
              />
              <span className="text-muted">{f}</span>
              <span className="font-num text-[10px] text-mutedSoft">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 border-t border-borderSoft pt-3 text-[11.5px] text-muted">
        UMAP preserves neighborhood structure, not linear scale — read clusters and gaps, not coordinates.
        Distance ≈ behavioral similarity.
      </div>
    </div>
  );
}
