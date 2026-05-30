// App-wide owner of the live SSE stream (`/api/stream`). Mounted once in AppShell so it
// sits ABOVE the router — the price/gas and archetype-mix series keep accumulating while
// you're on other pages and are intact when you return to Live, instead of resetting every
// time the page unmounts. On (re)connect the backend replays a `snapshot` (its ring buffer),
// so a reload or a brand-new visitor backfills the last few minutes instantly rather than
// refilling from empty. The Live page is a pure consumer via useLiveStream().
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { LivePoint } from "../components/LiveStackedChart";
import type { TickPoint } from "../components/LiveTicker";
import { API } from "./api";

export type BlockEv = { number: number; txCount: number; senderCount: number; finalityLag: number; ts: number };
export type Counts = Record<string, number>;
export type Classified = { addr: string; family: string };
export type LogRow = Classified & { block: number; key: string };
export type Conn = "connecting" | "live" | "reconnecting" | "offline";

// Visible windows. These mirror the server-side ring buffers (TICK_HISTORY / COUNTS_HISTORY
// in backend/app.py) so a single snapshot fills the whole window — keep them in sync.
const MAX_POINTS = 45; // archetype-mix window (~9 min of finalized blocks)
const MAX_TICKS = 90; // ticker sparkline window (~7.5 min at the 5s poll cadence)
const MAX_LOG = 30; // classification-log rows retained

export type LiveState = {
  conn: Conn;
  block: BlockEv | null;
  blocksSeen: number;
  history: LivePoint[];
  ticks: TickPoint[];
  log: LogRow[];
};

const LiveStreamContext = createContext<LiveState | null>(null);

export function LiveStreamProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<Conn>("connecting");
  const [block, setBlock] = useState<BlockEv | null>(null);
  const [blocksSeen, setBlocksSeen] = useState(0);
  const [history, setHistory] = useState<LivePoint[]>([]);
  const [ticks, setTicks] = useState<TickPoint[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);

  // Refs: the classified/counts events carry no block number, but they always follow
  // their block event — read the latest block without re-subscribing on every render.
  const blockNumRef = useRef(0);
  const lastBlockRef = useRef<BlockEv | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);

    es.onopen = () => setConn("live");
    es.addEventListener("hello", () => setConn("live"));

    // Backfill: HYDRATE (replace), never append. The server replays its full ring buffer
    // on every (re)connect, so the snapshot already contains the most recent points —
    // appending it would double-count against whatever's already in memory.
    es.addEventListener("snapshot", (e) => {
      const s = JSON.parse((e as MessageEvent).data) as { counts?: LivePoint[]; ticker?: TickPoint[] };
      if (s.counts?.length) setHistory(s.counts.slice(-MAX_POINTS));
      if (s.ticker?.length) setTicks(s.ticker.slice(-MAX_TICKS));
    });

    es.addEventListener("block", (e) => {
      const b = JSON.parse((e as MessageEvent).data) as BlockEv;
      blockNumRef.current = b.number;
      lastBlockRef.current = b;
      setBlock(b);
      setBlocksSeen((n) => n + 1);
    });

    es.addEventListener("counts", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as Counts;
      const blk = lastBlockRef.current;
      const point: LivePoint = {
        block: blk?.number ?? 0,
        ts: blk?.ts ?? Math.floor(Date.now() / 1000),
        counts: data,
      };
      setHistory((prev) => {
        // A same-block point can arrive right after a snapshot backfill — replace it
        // rather than append a duplicate column.
        const same = prev.length > 0 && prev[prev.length - 1].block === point.block;
        const next = same ? [...prev.slice(0, -1), point] : [...prev, point];
        return next.slice(-MAX_POINTS);
      });
    });

    es.addEventListener("ticker", (e) => {
      const t = JSON.parse((e as MessageEvent).data) as TickPoint;
      setTicks((prev) => {
        // Same guard as counts: the last buffered tick can also arrive live on connect.
        const same = prev.length > 0 && prev[prev.length - 1].ts === t.ts;
        const next = same ? [...prev.slice(0, -1), t] : [...prev, t];
        return next.slice(-MAX_TICKS);
      });
    });

    es.addEventListener("classified", (e) => {
      const rows = JSON.parse((e as MessageEvent).data) as Classified[];
      const blk = blockNumRef.current;
      setLog((prev) => {
        const next = rows.map((r) => ({ ...r, block: blk, key: `${blk}-${++seqRef.current}` }));
        return [...next, ...prev].slice(0, MAX_LOG);
      });
    });

    es.onerror = () => {
      // Spec: a non-2xx / wrong-content-type response closes the stream for good
      // (readyState CLOSED, e.g. a 503 with no ALCHEMY_KEY). A network blip leaves
      // it CONNECTING while the browser auto-retries.
      setConn(es.readyState === EventSource.CLOSED ? "offline" : "reconnecting");
    };

    return () => es.close();
  }, []);

  const value: LiveState = { conn, block, blocksSeen, history, ticks, log };
  return <LiveStreamContext.Provider value={value}>{children}</LiveStreamContext.Provider>;
}

export function useLiveStream(): LiveState {
  const ctx = useContext(LiveStreamContext);
  if (!ctx) throw new Error("useLiveStream must be used within a LiveStreamProvider");
  return ctx;
}
