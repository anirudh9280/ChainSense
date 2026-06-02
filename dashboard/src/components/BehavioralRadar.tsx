import { useState } from "react";
import { compact } from "../lib/data";

export type RadarSignature = { feature: string; direction: "up" | "down"; z: number };

export type RadarFamily = {
  name: string;
  color: string;
  radar: Record<string, number>; // normalized 0–1 per axis (drives the shape)
  radarRaw?: Record<string, number>; // un-normalized axis values (shown in the detail card)
  pctWallets?: number;
  pctTxns?: number;
  wallets?: number;
  medianTxns?: number;
  signature?: RadarSignature[]; // top features that most separate this family
};

// Raw feature keys → Title Case for the signature list (automation_share → Automation Share).
const humanizeFeat = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

// Raw axis values span counts, ratios, and ETH — pick a sensible precision per
// magnitude so the readout stays compact and legible.
const fmtRaw = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1000) return (v / 1000).toFixed(1) + "k";
  if (a >= 100) return Math.round(v).toString();
  if (a >= 1) return v.toFixed(1);
  return v.toFixed(2);
};

const W = 480;
const H = 440;
const CX = W / 2;
const CY = H / 2 + 6;
const R = 148;

export default function BehavioralRadar({
  axes,
  families,
}: {
  axes: string[];
  families: RadarFamily[];
}) {
  const [focus, setFocus] = useState<string | null>(null);
  const n = axes.length;

  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i: number, r: number) => {
    const a = angle(i);
    return [CX + Math.cos(a) * r, CY + Math.sin(a) * r] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const focused = focus ? families.find((f) => f.name === focus) : null;

  // The detail card defaults to the most prevalent family, then follows the hover.
  const defaultFam = [...families].sort((a, b) => (b.wallets ?? 0) - (a.wallets ?? 0))[0] ?? null;
  const detailFam = focused ?? defaultFam;

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[11px] font-semibold tracking-[0.18em] text-fg">
        BEHAVIORAL FINGERPRINTS
      </div>
      <div className="mt-1 text-[11.5px] text-fg/70">
        Each family's typical behavior across the key dimensions (scaled 0 to 1)
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[11px]">
        {families.map((f) => (
          <button
            key={f.name}
            onMouseEnter={() => setFocus(f.name)}
            onMouseLeave={() => setFocus(null)}
            className="flex items-center gap-1.5 transition"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: f.color, boxShadow: `0 0 6px ${f.color}` }}
            />
            <span className="text-fg/85">{f.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="lg:w-[56%]">
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

            {families.map((f) => {
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
                    return (
                      <circle key={i} cx={x} cy={y} r={focus === f.name ? 3 : 2.2} fill={f.color} />
                    );
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
                  fill="#C7CBD6"
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  fontFamily="Inter, system-ui"
                >
                  {label}
                </text>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-col gap-4 lg:w-[44%]">
          {detailFam && <FamilyDetail fam={detailFam} axes={axes} />}
          <div className="border-t border-borderSoft pt-3 text-[10.5px] text-mutedSoft">
            {focused
              ? "showing the family you're hovering"
              : `showing ${defaultFam?.name ?? "the largest family"} — hover any shape or swatch to switch`}
          </div>
        </div>
      </div>
    </div>
  );
}

// The right rail: one family at a time, with the context the radar alone can't
// show — how common it is, what most sets it apart, and the real
// (un-normalized) values behind each axis.
function FamilyDetail({ fam, axes }: { fam: RadarFamily; axes: string[] }) {
  const hasPrevalence = fam.pctWallets != null;
  return (
    <div className="flex flex-col gap-3.5">
      <div>
        <div className="text-[14px] font-semibold leading-tight" style={{ color: fam.color }}>
          {fam.name}
        </div>
        {hasPrevalence && (
          <div className="mt-1 font-num text-[11px] text-fg/70">
            {fam.pctWallets}% of wallets · {fam.pctTxns}% of txns
            {fam.wallets != null && <> · {compact(fam.wallets)} wallets</>}
            {fam.medianTxns != null && <> · {fam.medianTxns} median txns</>}
          </div>
        )}
      </div>

      {fam.signature && fam.signature.length > 0 && (
        <div>
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fg/55">
            What sets it apart
          </div>
          <div className="mt-1.5 space-y-1.5">
            {fam.signature.map((s) => (
              <SignatureRow key={s.feature} s={s} color={fam.color} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-fg/55">
          Typical values
        </div>
        <dl className="mt-1.5 grid grid-cols-2 gap-x-5 font-num text-[11px]">
          {axes.map((a) => (
            <div
              key={a}
              className="flex items-baseline justify-between gap-2 border-b border-borderSoft/40 py-1"
            >
              <dt className="truncate text-fg/65">{a}</dt>
              <dd className="shrink-0 text-fg">
                {fam.radarRaw ? fmtRaw(fam.radarRaw[a] ?? 0) : (fam.radar[a] ?? 0).toFixed(2)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// One separating feature: name, a bar scaled by |z| (saturating at 4σ), and the
// signed z. Up = over-indexes vs the population, down = under-indexes.
function SignatureRow({ s, color }: { s: RadarSignature; color: string }) {
  const up = s.direction === "up";
  const mag = Math.min(1, Math.abs(s.z) / 4);
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-[112px] shrink-0 truncate text-[11px] text-fg/85" title={s.feature}>
        {humanizeFeat(s.feature)}
      </div>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${mag * 100}%`, background: color, opacity: up ? 0.75 : 0.4 }}
        />
      </div>
      <div
        className="w-[40px] shrink-0 text-right font-num text-[10.5px]"
        style={{ color: up ? color : "#8A8FA0" }}
      >
        {up ? "▲" : "▼"}
        {Math.abs(s.z).toFixed(1)}
      </div>
    </div>
  );
}
