import { useMemo, useState } from "react";
import { archColorHex } from "../lib/snapshot";
import type { Snapshot } from "../lib/snapshot";

const W = 720;
const H = 240;
const PAD_L = 36;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;

export default function StackedActiveChart({
  data,
  archetypes,
}: {
  data: Snapshot["activeByArchetype"];
  archetypes: Snapshot["archetypes"];
}) {
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const archNames = Object.keys(data.series);
  const buckets = data.buckets;

  const stacked: number[][] = useMemo(() => {
    return buckets.map((_, i) => {
      let cum = 0;
      return archNames.map((name) => {
        const v = data.series[name][i] ?? 0;
        cum += v;
        return cum;
      });
    });
  }, [buckets, archNames, data.series]);

  const max = useMemo(
    () => Math.max(1, ...stacked.map((col) => col[col.length - 1])),
    [stacked]
  );

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const xAt = (i: number) =>
    PAD_L + (i / Math.max(buckets.length - 1, 1)) * innerW;
  const yAt = (v: number) => PAD_T + innerH - (v / max) * innerH;

  // build a path per archetype layer (bottom→top of its stack, then back)
  function layerPath(layerIdx: number) {
    const top: string[] = [];
    const bot: string[] = [];
    for (let i = 0; i < buckets.length; i++) {
      const upper = stacked[i][layerIdx];
      const lower = layerIdx === 0 ? 0 : stacked[i][layerIdx - 1];
      top.push(`${xAt(i)},${yAt(upper)}`);
      bot.push(`${xAt(i)},${yAt(lower)}`);
    }
    return `M${top.join(" L")} L${bot.reverse().join(" L")} Z`;
  }

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (max * i) / ticks);

  const xTickIdx = Array.from({ length: 6 }, (_, i) =>
    Math.round((i / 5) * (buckets.length - 1))
  );

  function fmtTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        DAILY ACTIVE WALLETS BY ARCHETYPE
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        stacked · per {data.bucketLabel} bucket · {buckets.length} buckets
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        onMouseLeave={() => setHover(null)}
      >
        {/* y grid + labels */}
        {tickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={yAt(v)}
              y2={yAt(v)}
              stroke="rgba(255,255,255,0.05)"
            />
            <text
              x={PAD_L - 6}
              y={yAt(v)}
              fontSize="9.5"
              fill="#8A8FA0"
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* stacked areas */}
        {archNames.map((name, layerIdx) => {
          const c = archColorHex(name, archetypes);
          return (
            <path key={name} d={layerPath(layerIdx)} fill={c} fillOpacity={0.55} stroke={c} strokeWidth="0.8" strokeOpacity={0.6} />
          );
        })}

        {/* hover band */}
        {hover && (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={PAD_T}
            y2={H - PAD_B}
            stroke="rgba(255,255,255,0.18)"
          />
        )}

        {/* x-tick labels */}
        {xTickIdx.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - PAD_B + 14}
            fontSize="9.5"
            fill="#8A8FA0"
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
          >
            {fmtTime(buckets[i])}
          </text>
        ))}

        {/* invisible hover overlay */}
        <rect
          x={PAD_L}
          y={PAD_T}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.target as SVGRectElement).getBoundingClientRect();
            const rx = ((e.clientX - rect.left) / rect.width) * innerW;
            const i = Math.max(
              0,
              Math.min(
                buckets.length - 1,
                Math.round((rx / innerW) * (buckets.length - 1))
              )
            );
            setHover({ i, x: xAt(i), y: 0 });
          }}
        />
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {archNames.map((name) => {
          const c = archColorHex(name, archetypes);
          return (
            <span key={name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />
              {name}
            </span>
          );
        })}
      </div>

      {hover && (
        <div className="mt-3 rounded-md border border-borderSoft bg-panel2/70 px-3 py-2 font-num text-[11.5px]">
          <div className="text-muted">{fmtTime(buckets[hover.i])}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
            {archNames.map((name) => {
              const c = archColorHex(name, archetypes);
              return (
                <div key={name} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-muted">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                    {name}
                  </span>
                  <span className="text-fg">{data.series[name][hover.i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
