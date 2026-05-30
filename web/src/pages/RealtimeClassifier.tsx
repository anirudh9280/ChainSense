import { type ReactNode } from "react";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";
import LiveStackedChart from "../components/LiveStackedChart";
import LiveTicker from "../components/LiveTicker";
import LivePulse from "../components/LivePulse";
import BlockHeartbeat from "../components/BlockHeartbeat";
import LogTicker from "../components/LogTicker";
import { FAMILY_ORDER } from "../lib/families";
import { useLiveStream } from "../lib/liveStream";

// Named behavioral archetypes for the over-time chart. Unclassified is noise; the
// chart drops it + New / Unmodeled to keep the families legible — like the Overview.
const STACK_FAMILIES = FAMILY_ORDER.filter((f) => f !== "Unclassified");

export default function RealtimeClassifier() {
  // The stream is owned app-wide by LiveStreamProvider (mounted in AppShell), so the
  // price/archetype series accumulate across navigation and survive a reload (backfilled
  // from the server's ring buffer). This page just renders the shared state.
  const { conn, block, blocksSeen, history, ticks, log } = useLiveStream();

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Live"
        subtitle="Finalized Ethereum blocks · every active sender matched to its behavioral family, live"
        status="head − 64 · finalized"
      />

      {/* Live-monitor bar: pulsing LIVE badge + "Ns ago" counter on the left, a
          block-arrival EKG on the right — the page's visceral "this is live" cue. */}
      <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-panel/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <LivePulse conn={conn} block={block} />
        <div className="flex items-center gap-3">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
            Block heartbeat
          </span>
          <BlockHeartbeat blockNumber={block?.number ?? null} live={conn === "live"} />
        </div>
      </div>

      <div className="mt-3">
        <InsightBanner
          insight={{
            tone: conn === "live" ? "good" : conn === "offline" ? "warn" : "info",
            title: "Enrichment-first — labels are looked up, never guessed",
            body:
              "Each finalized block's senders are matched against the 6.3M-wallet lookup table, so known wallets show their precomputed family instantly. Only addresses outside the modeled population fall to the New / Unmodeled bucket; they're never forced into a family.",
          }}
        />
      </div>

      <div className="mt-5">
        <LiveTicker series={ticks} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Latest finalized block" value={block ? block.number.toLocaleString() : "—"} mono />
        <Tile
          label="Active senders"
          value={block ? block.senderCount.toLocaleString() : "—"}
          sub={block ? `${block.txCount.toLocaleString()} txns in block` : undefined}
          mono
        />
        <Tile label="Finality lag" value="64 blocks" sub="≈ 13 min · settled" />
        <Tile label="Blocks this session" value={blocksSeen.toLocaleString()} mono />
      </div>

      <div className="mt-3">
        <LiveStackedChart history={history} families={STACK_FAMILIES} />
      </div>

      <div className="mt-3 rounded-xl border border-border bg-panel/60 p-5">
        <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          CLASSIFICATION LOG · most recent senders
        </div>
        <div className="mt-4">
          <LogTicker rows={log} />
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  mono,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-4 py-3">
      <div className="text-[10.5px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className={`mt-1 text-[18px] text-fg ${mono ? "font-num tabular-nums" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
      {children && <div className="mt-1.5">{children}</div>}
    </div>
  );
}
