import { useMemo, useState } from "react";
import { ARCH_COLOR_HEX, type PcaJsonPoint } from "../lib/snapshot";

const W = 720;
const H = 460;
const PAD = 24;

const LABEL: Record<PcaJsonPoint["cls"], string> = {
  longterm: "Casual / Holder",
  traders: "Active DeFi",
  nft: "Airdrop receiver",
  bots: "Bot / MEV",
};

export default function PcaScatter({
  points,
  featureCount,
}: {
  points: PcaJsonPoint[];
  featureCount: number;
}) {
  const [hovered, setHovered] = useState<PcaJsonPoint | null>(null);

  const [minX, maxX, minY, maxY] = useMemo(() => {
    if (points.length === 0) return [-1, 1, -1, 1] as const;
    let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity;
    points.forEach((p) => {
      if (p.x < a) a = p.x;
      if (p.x > b) b = p.x;
      if (p.y < c) c = p.y;
      if (p.y > d) d = p.y;
    });
    return [a, b, c, d] as const;
  }, [points]);

  const sx = (x: number) => PAD + ((x - minX) / (maxX - minX || 1)) * (W - 2 * PAD);
  const sy = (y: number) => H - PAD - ((y - minY) / (maxY - minY || 1)) * (H - 2 * PAD);

  const present = useMemo(() => {
    const set = new Set(points.map((p) => p.cls));
    return (["traders", "longterm", "nft", "bots"] as const).filter((c) => set.has(c));
  }, [points]);

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-fg">
            Behavioral embedding · PCA
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            real PCA projection from <span className="font-num">wallet_projections.csv</span> · {points.length.toLocaleString()} wallets shown
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
          {present.map((c) => (
            <span key={c} className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: ARCH_COLOR_HEX[c] }}
              />
              {LABEL[c]}
            </span>
          ))}
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

          {points.map((p, i) => (
            <circle
              key={i}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={2.4}
              fill={ARCH_COLOR_HEX[p.cls]}
              fillOpacity={0.78}
              onMouseEnter={() => setHovered(p)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}

          {hovered && (
            <g pointerEvents="none">
              <rect
                x={Math.min(sx(hovered.x) + 8, W - 220)}
                y={Math.max(sy(hovered.y) - 36, 4)}
                rx={4}
                width={210}
                height={32}
                fill="#0A0B0F"
                stroke="rgba(255,255,255,0.1)"
              />
              <text
                x={Math.min(sx(hovered.x) + 16, W - 212)}
                y={Math.max(sy(hovered.y) - 22, 18)}
                fill="#E6E8EE"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {hovered.arch} · ({hovered.x.toFixed(2)}, {hovered.y.toFixed(2)})
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="mt-3 text-[11.5px] text-muted">
        Real 2D PCA projection of the {featureCount}-dim wallet feature space ·
        K-Means cluster labels colored. Hover any point for archetype + coordinate.
      </div>
    </div>
  );
}
