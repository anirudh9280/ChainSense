import { familyColor } from "../lib/families";
import { shortAddr } from "../lib/data";
import type { LogRow } from "../lib/liveStream";

// Single-line classification ticker: all recent senders scroll past on one row (CSS
// marquee), replacing the old vertical list. Senders outside the 6.3M LUT get the
// New / Unmodeled teal — never a guessed family color.
const NEW_BUCKET = "New / Unmodeled";
function colorFor(family: string): string {
  return family === NEW_BUCKET ? "#46D5C8" : familyColor(family);
}

function Entry({ r }: { r: LogRow }) {
  return (
    <span className="mx-3 inline-flex items-center gap-2 whitespace-nowrap">
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorFor(r.family) }} />
      <span className="font-num text-[12px] text-fg">{shortAddr(r.addr)}</span>
      <span className="text-[12px] text-muted">{r.family}</span>
      <span className="font-num text-[11px] text-mutedSoft">#{r.block.toLocaleString()}</span>
    </span>
  );
}

export default function LogTicker({ rows }: { rows: LogRow[] }) {
  if (rows.length === 0) {
    return <div className="text-[12.5px] text-muted">Waiting for the first finalized block…</div>;
  }
  // Duplicate the row set so a -50% translate loops seamlessly. Duration scales with
  // row count so a long log doesn't whip past too fast; hover pauses it (CSS).
  const durationS = Math.max(18, rows.length * 2.4);
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-panel to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-panel to-transparent" />
      <div className="marquee-track flex w-max" style={{ animationDuration: `${durationS}s` }}>
        <div className="flex shrink-0">
          {rows.map((r) => (
            <Entry key={r.key} r={r} />
          ))}
        </div>
        <div className="flex shrink-0" aria-hidden="true">
          {rows.map((r) => (
            <Entry key={`dup-${r.key}`} r={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
