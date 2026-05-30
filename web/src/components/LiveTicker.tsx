// Live market strip for the Live page. ETH/USD spot + current gas price, each with a
// hand-rolled SVG sparkline (no chart library, matching the rest of the dashboard).
// Data arrives on the SSE `ticker` event (backend proxies Coinbase spot + Alchemy
// eth_gasPrice) — see RealtimeClassifier. A field may be null on a transient poll
// miss, so each metric reads its own last non-null value and the sparkline drops gaps.

export type TickPoint = { ethUsd: number | null; gasGwei: number | null; ts: number };

const UP = "#34D399"; // emerald — matches the page's "live" accent
const DOWN = "#F45D7A"; // rose — the dashboard's down/alert red
const NEUTRAL = "#5BB6F0";
const GAS_COLOR = "#D6A53C"; // gold, same hue family as Holders & Receivers

function lastNonNull(values: (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i] as number;
  }
  return null;
}

function gasLabel(g: number): string {
  if (g < 8) return "low";
  if (g < 25) return "normal";
  if (g < 60) return "elevated";
  return "high";
}

// Gas spans regimes: tens of gwei at peak, but sub-1 gwei when the chain is quiet.
// Keep more decimals below 1 so a "0.186 gwei" reading doesn't flatten to "0.2".
function fmtGas(g: number): string {
  if (g >= 100) return g.toFixed(0);
  if (g >= 1) return g.toFixed(1);
  return g.toFixed(3);
}

function Sparkline({ values, color, height = 34 }: { values: number[]; color: string; height?: number }) {
  const W = 200;
  const H = height;
  const P = 3;
  if (values.length < 2) {
    // Reserve the height so the card doesn't jump once data starts flowing.
    return <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => P + (i / (values.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / span) * (H - 2 * P);
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(values.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <path d={area} fill={color} fillOpacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function LiveTicker({ series }: { series: TickPoint[] }) {
  const ethSeries = series.map((s) => s.ethUsd).filter((v): v is number => v != null);
  const gasSeries = series.map((s) => s.gasGwei).filter((v): v is number => v != null);

  const eth = lastNonNull(series.map((s) => s.ethUsd));
  const gas = lastNonNull(series.map((s) => s.gasGwei));

  const ethFirst = ethSeries.length ? ethSeries[0] : null;
  const ethDelta =
    eth != null && ethFirst != null && ethFirst !== 0 ? ((eth - ethFirst) / ethFirst) * 100 : null;
  const up = (ethDelta ?? 0) >= 0;
  const deltaColor = ethDelta == null ? "#8A8FA0" : up ? UP : DOWN;
  const ethLine = ethSeries.length < 2 ? NEUTRAL : up ? UP : DOWN;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-border bg-panel/60 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">ETH · USD spot</div>
            <div className="mt-1 font-num text-[22px] tabular-nums text-fg">
              {eth != null
                ? `$${eth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Δ session</div>
            <div className="mt-1 font-num text-[12.5px] tabular-nums" style={{ color: deltaColor }}>
              {ethDelta == null ? "—" : `${up ? "▲" : "▼"} ${Math.abs(ethDelta).toFixed(2)}%`}
            </div>
          </div>
        </div>
        <div className="mt-2">
          <Sparkline values={ethSeries} color={ethLine} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel/60 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">Gas · gwei</div>
            <div className="mt-1 font-num text-[22px] tabular-nums text-fg">
              {gas != null ? fmtGas(gas) : "—"}
              {gas != null && <span className="ml-1 text-[12px] text-muted">gwei</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">eth_gasPrice</div>
            <div className="mt-1 font-num text-[12.5px] tabular-nums text-muted">
              {gas != null ? gasLabel(gas) : "—"}
            </div>
          </div>
        </div>
        <div className="mt-2">
          <Sparkline values={gasSeries} color={GAS_COLOR} />
        </div>
      </div>
    </div>
  );
}
