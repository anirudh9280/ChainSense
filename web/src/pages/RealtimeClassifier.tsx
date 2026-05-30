import { useOutletContext } from "react-router-dom";
import type { Snapshot } from "../lib/snapshot";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";

type Ctx = { snap: Snapshot | null };

export default function RealtimeClassifier() {
  const { snap } = useOutletContext<Ctx>();
  if (!snap) return null;

  const tape = snap.liveTape.values;
  const hasTape = tape.length > 0;

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Real-time Classifier"
        subtitle="Live block ingestion + per-block archetype assignment"
        status={hasTape ? "live · subscriber online" : "offline · subscriber not running"}
      />

      <InsightBanner
        insight={{
          tone: hasTape ? "good" : "warn",
          title: hasTape
            ? "Subscriber output detected — block-level ingestion is live"
            : "No subscriber output found",
          body: hasTape
            ? `Reading the latest blocks written by subscriber.py. ${snap.liveTape._provenance}.`
            : "Run `python subscriber.py` (needs ALCHEMY_KEY in .env) and rebuild the snapshot to populate this page.",
        }}
      />

      {hasTape && (
        <div className="mt-5 rounded-xl border border-border bg-panel/60 p-5">
          <div className="flex items-center justify-between">
            <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
              LIVE TAPE · latest blocks from subscriber.py
            </div>
            <span className="inline-flex items-center gap-2 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              block {tape[0]?.block.toLocaleString()}
            </span>
          </div>
          <ul className="mt-4 space-y-1.5 font-num text-[12.5px]">
            {tape.map((r, i) => (
              <li
                key={`${r.block}-${i}`}
                className="flex items-center gap-3 rounded-md border border-borderSoft bg-panel2/60 px-3 py-2"
              >
                <span className="text-muted">{r.block}</span>
                <span className="flex-1 truncate text-fg">
                  {r.from} <span className="text-muted">→</span> {r.to}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
