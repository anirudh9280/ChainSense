export default function AnomalyPressure({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const W = 720, H = 180, PAD = 20;
  const innerW = W - 2 * PAD;
  const innerH = H - 2 * PAD;

  const pts = data.map((v, i) => {
    const x = PAD + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = H - PAD - (v / max) * innerH;
    return [x, y] as const;
  });

  const path = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const area =
    path +
    ` L ${pts[pts.length - 1][0]},${H - PAD}` +
    ` L ${pts[0][0]},${H - PAD} Z`;

  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="flex items-baseline justify-between">
        <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          ANOMALY PRESSURE · z-score over baseline
        </div>
        <div className="font-num text-[11px] text-muted">
          peak {Math.max(...data).toFixed(1)}σ
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full">
        <defs>
          <linearGradient id="anomFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#F45D7A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#F45D7A" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* baseline threshold (2σ) */}
        <line
          x1={PAD}
          x2={W - PAD}
          y1={H - PAD - (2 / max) * innerH}
          y2={H - PAD - (2 / max) * innerH}
          stroke="rgba(244,93,122,0.4)"
          strokeDasharray="3 4"
        />
        <text
          x={W - PAD - 4}
          y={H - PAD - (2 / max) * innerH - 4}
          fill="#F45D7A"
          fontSize="9"
          fontFamily="JetBrains Mono, monospace"
          textAnchor="end"
        >
          2σ alert
        </text>

        <path d={area} fill="url(#anomFill)" />
        <path d={path} fill="none" stroke="#F45D7A" strokeWidth="1.8" />
      </svg>

      <div className="mt-1 text-[11px] text-muted">
        Z-score of contract-event volume vs trailing 30-day baseline · spikes
        above 2σ trigger anomaly review.
      </div>
    </div>
  );
}
