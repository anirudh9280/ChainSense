import { useState } from "react";
import { familyColor } from "../lib/families";
import { shortAddr, useFamilies } from "../lib/data";
import type { LogRow } from "../lib/liveStream";

// "cluster_name" formatting mirrors the Wallet Inspector: underscores → spaces,
// then Title Case so "multi_router_defi_bot" reads "Multi Router Defi Bot".
const humanize = (s: string) => s.replace(/_/g, " ");
const titleCase = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());

// Vertical classification stream: most-recent senders at the top, one per row, so the
// feed reads as a live log (new rows push the rest down) instead of a clipped marquee.
// Senders outside the 6.3M LUT get the New / Unmodeled teal — never a guessed family color.
const NEW_BUCKET = "New / Unmodeled";
function colorFor(family: string): string {
  return family === NEW_BUCKET ? "#46D5C8" : familyColor(family);
}

// Show the full retained log (liveStream caps it at MAX_LOG=30) but inside a fixed-height
// scroll box (~8 rows tall) so the Live page height stays constant when a batch floods in —
// the overflow scrolls internally instead of pushing the rest of the page down.
const MAX_DISPLAY = 30;

// Confidence tiers mirror the Wallet Inspector's chip scheme (emerald / amber / slate):
// the same visual language for "how sure the model is" across the whole app.
function confTier(conf: number): string {
  if (conf >= 0.7) return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (conf >= 0.5) return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  return "border-slate-400/25 bg-slate-400/10 text-slate-300";
}

export default function LogTicker({ rows }: { rows: LogRow[] }) {
  // Track which row was just copied so we can flash brief feedback. Keyed by row.key
  // (unique per emitted row) so only the clicked address shows "copied".
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Cluster id → archetype name, so the pill can read "family: cluster_name" exactly
  // like the Inspector. Family→cluster is one-to-many, so the specific name only comes
  // from the per-row cluster id the backend sends; absent that, we show family alone.
  const { data: families } = useFamilies();
  const clusterName = (cluster: number | undefined): string | null => {
    if (cluster == null) return null;
    const entry = families?.clusters[String(cluster)];
    return entry ? titleCase(humanize(entry.name)) : null;
  };

  if (rows.length === 0) {
    return <div className="text-[12.5px] text-muted">Waiting for the first finalized block…</div>;
  }

  const copy = (key: string, addr: string) => {
    navigator.clipboard?.writeText(addr);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1200);
  };

  // rows are newest-first (see liveStream).
  const recent = rows.slice(0, MAX_DISPLAY);
  return (
    <div className="scrollbar-dark flex max-h-[296px] flex-col overflow-y-auto pr-1">
      {recent.map((r, i) => (
        <div
          key={r.key}
          className={`flex items-center gap-3 px-1 py-[7px] ${
            i === 0 ? "rounded-md bg-panel2/40" : "border-t border-borderSoft/60"
          }`}
        >
          {/* Hover shows the full 0x… address; click copies it to the clipboard. */}
          <button
            type="button"
            onClick={() => copy(r.key, r.addr)}
            title={`${r.addr} — click to copy`}
            className="shrink-0 cursor-pointer font-num text-[12.5px] text-fg underline decoration-borderSoft decoration-dotted underline-offset-[3px] transition-colors hover:text-emerald-300 hover:decoration-emerald-400"
          >
            {copiedKey === r.key ? "copied" : shortAddr(r.addr)}
          </button>
          {/* Family pill in a fixed-width column so the confidence chip below lines up the
              same x across every row. Pill scheme matches the Wallet Inspector: tinted text
              on a faint fill with an inset ring, all derived from the archetype color. */}
          <div className="w-[184px] shrink-0">
            {(() => {
              const c = colorFor(r.family);
              const name = clusterName(r.cluster);
              const label = name ? `${r.family}: ${name}` : r.family;
              return (
                <span
                  title={label}
                  className="inline-block max-w-full truncate rounded-full px-2.5 py-1 align-middle text-[11px] font-semibold"
                  style={{ color: c, background: `${c}1a`, boxShadow: `inset 0 0 0 1px ${c}33` }}
                >
                  {label}
                </span>
              );
            })()}
          </div>
          {/* Confidence chip — tiered color (emerald/amber/slate) like the Inspector. */}
          {r.conf != null && (
            <span
              title={`Model confidence: ${(r.conf * 100).toFixed(1)}%`}
              className={`flex shrink-0 items-baseline gap-1 rounded-md border px-2 py-0.5 font-num text-[10.5px] font-semibold ${confTier(r.conf)}`}
            >
              <span className="text-[9px] font-semibold uppercase tracking-wide opacity-70">conf</span>
              {Math.round(r.conf * 100)}%
            </span>
          )}
          <span className="ml-auto shrink-0 font-num text-[11px] text-mutedSoft">#{r.block.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
