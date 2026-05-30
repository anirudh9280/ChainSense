import { useState } from "react";

export type RadarFamily = {
  name: string;
  color: string;
  radar: Record<string, number>; // normalized 0–1 per axis
};

const W = 480;
const H = 440;
const CX = W / 2;
const CY = H / 2 + 6;
const R = 148;

export default function BehavioralRadar({
  axes,
  families,
  defaultVisible,
}: {
  axes: string[];
  families: RadarFamily[];
  defaultVisible?: string[];
}) {
  const initial = new Set(defaultVisible ?? families.map((f) => f.name));
  const [visible, setVisible] = useState<Set<string>>(initial);
  const [focus, setFocus] = useState<string | null>(null);
  const n = axes.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => {
    const a = angle(i);
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const shown = families.filter((f) => visible.has(f.name));
  const focused = focus && visible.has(focus) ? families.find((f) => f.name === focus) : null;

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        BEHAVIORAL FINGERPRINTS
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        median profile per family, normalized 0–1 per axis · click a family to toggle, hover to isolate
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" style={{ maxHeight: H }}>
        {rings.map((r) => (
          <polygon
            key={r}
            points={axes.map((_, i) => pt(i, R * r).join(",")).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, R);
          return <line key={i} x1={CX} y1={CY} x2={x} y2={y} stroke="rgba(255,255,255,0.05)" />;
        })}

        {shown.map((f) => {
          const dim = focus && focus !== f.name;
          const pts = axes
            .map((axisName, i) => pt(i, R * (f.radar[axisName] ?? 0)).join(","))
            .join(" ");
          return (
            <g
              key={f.name}
              style={{ cursor: "pointer", transition: "opacity 120ms" }}
              opacity={dim ? 0.12 : 1}
              onMouseEnter={() => setFocus(f.name)}
              onMouseLeave={() => setFocus(null)}
            >
              <polygon
                points={pts}
                fill={f.color}
                fillOpacity={focus === f.name ? 0.2 : 0.1}
                stroke={f.color}
                strokeWidth={focus === f.name ? 2.2 : 1.5}
              />
              {axes.map((axisName, i) => {
                const [x, y] = pt(i, R * (f.radar[axisName] ?? 0));
                return <circle key={i} cx={x} cy={y} r={focus === f.name ? 3 : 2.2} fill={f.color} />;
              })}
            </g>
          );
        })}

        {axes.map((label, i) => {
          const [x, y] = pt(i, R + 24);
          const c = Math.cos(angle(i));
          const anchor = c > 0.3 ? "start" : c < -0.3 ? "end" : "middle";
          return (
            <text
              key={label}
              x={x}
              y={y}
              fontSize="10.5"
              fill="#8A8FA0"
              textAnchor={anchor}
              dominantBaseline="middle"
              fontFamily="Inter, system-ui"
            >
              {label}
            </text>
          );
        })}
      </svg>

      <div className="mt-1 flex min-h-[2.25rem] items-center justify-center text-center text-[11px] leading-snug text-muted">
        {focused ? (
          <span>
            <span className="font-semibold" style={{ color: focused.color }}>
              {focused.name}
            </span>
            {" — "}
            {axes
              .map((a) => `${a} ${(focused.radar[a] ?? 0).toFixed(2)}`)
              .join(" · ")}
          </span>
        ) : (
          <span className="text-mutedSoft">hover a family to read its axis values</span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-[11px]">
        {families.map((f) => {
          const off = !visible.has(f.name);
          return (
            <button
              key={f.name}
              onMouseEnter={() => setFocus(f.name)}
              onMouseLeave={() => setFocus(null)}
              onClick={() =>
                setVisible((v) => {
                  const next = new Set(v);
                  if (next.has(f.name)) next.delete(f.name);
                  else next.add(f.name);
                  return next;
                })
              }
              className={`flex items-center gap-1.5 transition ${off ? "opacity-35" : ""}`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: f.color, boxShadow: off ? "none" : `0 0 6px ${f.color}` }}
              />
              <span className="text-muted">{f.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
