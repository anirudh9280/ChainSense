import PageHeader from "../components/PageHeader";
import NewsFeed from "../components/NewsFeed";
import LiveStackedChart from "../components/LiveStackedChart";
import LiveTicker from "../components/LiveTicker";
import LivePulse from "../components/LivePulse";
import LogTicker from "../components/LogTicker";
import { FAMILY_ORDER } from "../lib/families";
import { useLiveStream } from "../lib/liveStream";

// Named behavioral archetypes for the over-time chart. Unclassified is noise; the
// chart drops it + New / Unmodeled to keep the families legible — like the Overview.
const STACK_FAMILIES = FAMILY_ORDER.filter((f) => f !== "Unclassified");

function classifiedLabel(ts: number | null): string {
  if (!ts) return "awaiting first classification";
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RealtimeClassifier() {
  // The stream is owned app-wide by LiveStreamProvider (mounted in AppShell), so the
  // price/archetype series accumulate across navigation and survive a reload (backfilled
  // from the server's ring buffer). This page just renders the shared state.
  const { conn, block, history, ticks, log, classifiedAt } = useLiveStream();

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Live"
      />

      <div className="mt-4 space-y-3">
        <NewsFeed />

        <LiveTicker series={ticks} />
      </div>

      <div className="mt-6 space-y-3">
        {/* Live-monitor bar: pulsing LIVE badge + "Ns ago" counter — the page's "this is live" cue. */}
        <div className="flex items-center rounded-xl border border-border bg-panel/60 px-5 py-3">
          <LivePulse conn={conn} block={block} />
        </div>

        <LiveStackedChart history={history} families={STACK_FAMILIES} />

        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
                <span className="text-emerald-400">LIVE CLASSIFICATIONS</span>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted">
                Behavioral type inferred live by our ML model from each wallet's first hour on-chain
              </div>
            </div>
            <div className="shrink-0 font-num text-[11px] text-mutedSoft">
              Last classified · <span className="text-muted">{classifiedLabel(classifiedAt)}</span>
            </div>
          </div>
          <div className="mt-3">
            <LogTicker rows={log} />
          </div>
        </div>
      </div>
    </div>
  );
}
