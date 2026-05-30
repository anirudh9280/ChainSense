import { memo, useEffect, useRef, useState } from "react";

// A block-arrival EKG. Each new finalized block stamps a QRS spike at the right edge;
// the waveform scrolls left at a constant rate, so a fresh beat lands every ~12s and
// reads viscerally as a live heartbeat monitor.
//
// Arrival timing is wall-clock and LOCAL to this component: it records Date.now() each
// time `blockNumber` changes (the block's own `ts` is the finalized head−64 timestamp,
// ~13 min in the past, so it can't drive a real-time scroll). The waveform is redrawn
// imperatively in a requestAnimationFrame loop — the `d` attribute is written via
// setAttribute rather than rendered in JSX, so the 60fps scroll never triggers React
// re-renders or path-reconciliation flicker.
const W = 240;
const H = 56;
const BY = 32; // baseline y
const WINDOW_MS = 45_000; // visible time window (~3–4 beats at a 12s cadence)

// One QRS complex as (dx from beat center, dy from baseline). Negative dy points up.
const QRS: ReadonlyArray<readonly [number, number]> = [
  [-4, 0],
  [-3, 3], // Q — small dip
  [-1.5, -22], // R — tall spike up
  [0, 12], // S — dip below baseline
  [1.5, -5], // small overshoot
  [3, 0],
];

function buildPath(beats: number[], now: number): string {
  let d = `M 0 ${BY}`;
  const xs = beats
    .map((t) => W - ((now - t) / WINDOW_MS) * W)
    .filter((x) => x >= -12 && x <= W + 12)
    .sort((a, b) => a - b);
  for (const cx of xs) {
    d += ` L ${(cx + QRS[0][0]).toFixed(1)} ${BY}`;
    for (const [dx, dy] of QRS) {
      d += ` L ${(cx + dx).toFixed(1)} ${(BY + dy).toFixed(1)}`;
    }
  }
  d += ` L ${W} ${BY}`;
  return d;
}

function BlockHeartbeat({ blockNumber, live }: { blockNumber: number | null; live: boolean }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const beatsRef = useRef<number[]>([]);
  const lastNumRef = useRef<number | null>(null);
  const [lastBeat, setLastBeat] = useState(0);

  // Record a wall-clock arrival whenever a NEW finalized block lands.
  useEffect(() => {
    if (blockNumber == null || lastNumRef.current === blockNumber) return;
    lastNumRef.current = blockNumber;
    const now = Date.now();
    beatsRef.current = [...beatsRef.current, now].slice(-12);
    setLastBeat(now);
  }, [blockNumber]);

  // One rAF loop drives the scroll for the component's whole lifetime.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const p = pathRef.current;
      if (p) p.setAttribute("d", buildPath(beatsRef.current, Date.now()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const stroke = live ? "#34D399" : "#5C6072";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="overflow-visible">
      <line x1="0" y1={BY} x2={W} y2={BY} stroke="#1F222C" strokeWidth="1" />
      <path
        ref={pathRef}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ filter: live ? "drop-shadow(0 0 3px rgba(52,211,153,0.5))" : "none" }}
      />
      {/* leading cursor pinned at the right edge */}
      <circle cx={W} cy={BY} r="2" fill={stroke} />
      {/* one-shot ring that pings outward when a new beat lands (remounts via key) */}
      {live && lastBeat > 0 && (
        <circle key={lastBeat} className="ekg-blip" cx={W} cy={BY} r="2" fill="none" stroke={stroke} strokeWidth="1.4" />
      )}
    </svg>
  );
}

// Only re-render when the block number or live state changes — the rAF loop owns the
// continuous animation, so unrelated parent updates (every tick/count) shouldn't churn it.
export default memo(BlockHeartbeat, (a, b) => a.live === b.live && a.blockNumber === b.blockNumber);
