import { useMemo, useState } from "react";
import { FAMILY_ORDER, familyColor } from "../lib/families";
import { compact, type ActivityDaily } from "../lib/data";

const W = 720;
const H = 240;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 14;
const PAD_B = 28;

// Named behavioral families only — Unclassified (the −1 noise class) is ~50×
// the others and would flatten everything, so it's excluded here for scale.
const STACK_FAMILIES = FAMILY_ORDER.filter((f) => f !== "Unclassified");

export default function StackedActiveChart({ activity }: { activity: ActivityDaily }) {
  const [hover, setHover] = useState<number | null>(null);

  const families = useMemo(
    () => STACK_FAMILIES.filter((f) => activity.families.includes(f)),
    [activity.families]
  );
  const rows = activity.rows;

  const stacked: number[][] = useMemo(
    () =>
      rows.map((row) => {
        let cum = 0;
        return families.map((f) => (cum += (row[f] as number) ?? 0));
      }),
    [rows, families]
  );

  const max = useMemo(
    () => Math.max(1, ...stacked.map((col) => col[col.length - 1] ?? 0)),
    [stacked]
  );

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const xAt = (i: number) => PAD_L + (i / Math.max(rows.length - 1, 1)) * innerW;
  const yAt = (v: number) => PAD_T + innerH - (v / max) * innerH;

  function layerPath(layerIdx: number) {
    const top: string[] = [];
    const bot: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const upper = stacked[i][layerIdx];
      const lower = layerIdx === 0 ? 0 : stacked[i][layerIdx - 1];
      top.push(`${xAt(i)},${yAt(upper)}`);
      bot.push(`${xAt(i)},${yAt(lower)}`);
    }
    return `M${top.join(" L")} L${bot.reverse().join(" L")} Z`;
  }

  const tickVals = Array.from({ length: 5 }, (_, i) => (max * i) / 4);
  const xTickIdx = Array.from({ length: 6 }, (_, i) =>
    Math.round((i / 5) * (rows.length - 1))
  );

  function fmtDate(t: string) {
    const d = new Date(t);
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        ACTIVE WALLETS BY FAMILY
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        stacked · per {activity.bucketLabel} · {rows.length} buckets · named families
        (Unclassified excluded for scale)
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" onMouseLeave={() => setHover(null)}>
        {tickVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yAt(v)} y2={yAt(v)} stroke="rgba(255,255,255,0.05)" />
            <text
              x={PAD_L - 6}
              y={yAt(v)}
              fontSize="9.5"
              fill="#8A8FA0"
              textAnchor="end"
              dominantBaseline="middle"
              fontFamily="JetBrains Mono, monospace"
            >
              {compact(Math.round(v))}
            </text>
          </g>
        ))}

        {families.map((name, layerIdx) => {
          const c = familyColor(name);
          return (
            <path
              key={name}
              d={layerPath(layerIdx)}
              fill={c}
              fillOpacity={0.55}
              stroke={c}
              strokeWidth="0.8"
              strokeOpacity={0.6}
            />
          );
        })}

        {hover != null && (
          <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD_T} y2={H - PAD_B} stroke="rgba(255,255,255,0.18)" />
        )}

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
            {fmtDate(rows[i].t)}
          </text>
        ))}

        <rect
          x={PAD_L}
          y={PAD_T}
          width={innerW}
          height={innerH}
          fill="transparent"
          onMouseMove={(e) => {
            const rect = (e.target as SVGRectElement).getBoundingClientRect();
            const rx = ((e.clientX - rect.left) / rect.width) * innerW;
            const i = Math.max(0, Math.min(rows.length - 1, Math.round((rx / innerW) * (rows.length - 1))));
            setHover(i);
          }}
        />
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
        {families.map((name) => (
          <span key={name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: familyColor(name) }} />
            {name}
          </span>
        ))}
      </div>

      {hover != null && (
        <div className="mt-3 rounded-md border border-borderSoft bg-panel2/70 px-3 py-2 font-num text-[11.5px]">
          <div className="text-muted">{rows[hover].t}</div>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
            {families.map((name) => (
              <div key={name} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-muted">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: familyColor(name) }} />
                  {name}
                </span>
                <span className="text-fg">{compact((rows[hover][name] as number) ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
