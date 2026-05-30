import { useState } from "react";
import { ARCH_COLOR_HEX } from "../lib/snapshot";

type FP = {
  archetype: string;
  color: string;
  axes: Record<string, number>;
};

const W = 460;
const H = 420;
const CX = W / 2;
const CY = H / 2 + 10;
const R = 150;

export default function BehavioralRadar({
  axes,
  fingerprints,
}: {
  axes: string[];
  fingerprints: FP[];
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const n = axes.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => {
    const a = angle(i);
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        BEHAVIORAL FINGERPRINTS
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        normalized feature intensity per archetype (0–1) · click a label to
        toggle
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" style={{ maxHeight: H }}>
        {/* concentric rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={axes
              .map((_, i) => {
                const [x, y] = pt(i, R * r);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
          />
        ))}
        {/* axis lines */}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.05)"
            />
          );
        })}

        {/* archetype polygons */}
        {fingerprints
          .filter((fp) => !hidden.has(fp.archetype))
          .map((fp) => {
            const color = ARCH_COLOR_HEX[fp.color] ?? "#888";
            const pts = axes
              .map((axisName, i) => {
                const v = fp.axes[axisName] ?? 0;
                const [x, y] = pt(i, R * v);
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <g key={fp.archetype}>
                <polygon points={pts} fill={color} fillOpacity={0.12} stroke={color} strokeWidth="1.6" />
                {axes.map((axisName, i) => {
                  const v = fp.axes[axisName] ?? 0;
                  const [x, y] = pt(i, R * v);
                  return <circle key={i} cx={x} cy={y} r={2.4} fill={color} />;
                })}
              </g>
            );
          })}

        {/* axis labels */}
        {axes.map((label, i) => {
          const [x, y] = pt(i, R + 22);
          return (
            <text
              key={label}
              x={x}
              y={y}
              fontSize="10"
              fill="#8A8FA0"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="Inter, system-ui"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px]">
        {fingerprints.map((fp) => {
          const c = ARCH_COLOR_HEX[fp.color] ?? "#888";
          const off = hidden.has(fp.archetype);
          return (
            <button
              key={fp.archetype}
              onClick={() => {
                setHidden((h) => {
                  const next = new Set(h);
                  if (next.has(fp.archetype)) next.delete(fp.archetype);
                  else next.add(fp.archetype);
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 transition ${off ? "opacity-40" : ""}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: c, boxShadow: off ? "none" : `0 0 6px ${c}` }}
              />
              <span className="text-muted">{fp.archetype}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
