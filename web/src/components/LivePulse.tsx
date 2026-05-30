import { useEffect, useState } from "react";
import type { BlockEv, Conn } from "../lib/liveStream";

// The "is this actually live?" affordance: a status chip whose dot pings (red when
// live) next to a "Last block #N · Ns ago" counter that ticks every second off the
// latest finalized block's timestamp. The counter runs on its OWN 1s interval — it
// does not wait for stream events — so the age keeps climbing visibly between the
// ~12s block arrivals, and turns amber if the feed stalls.
const STATUS: Record<Conn, { label: string; dot: string; text: string; ring: string; ping: boolean }> = {
  live:         { label: "LIVE",         dot: "bg-red-500",   text: "text-red-400",   ring: "bg-red-500",   ping: true },
  connecting:   { label: "CONNECTING",   dot: "bg-amber-400", text: "text-amber-300", ring: "bg-amber-400", ping: false },
  reconnecting: { label: "RECONNECTING", dot: "bg-amber-400", text: "text-amber-300", ring: "bg-amber-400", ping: false },
  offline:      { label: "OFFLINE",      dot: "bg-slate-500", text: "text-muted",     ring: "bg-slate-500", ping: false },
};

function agoLabel(sec: number): string {
  if (sec < 1) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s ago`;
}

export default function LivePulse({ conn, block }: { conn: Conn; block: BlockEv | null }) {
  const s = STATUS[conn];
  const [nowSec, setNowSec] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const age = block ? Math.max(0, nowSec - block.ts) : null;
  const stalled = age !== null && age > 30;

  return (
    <div className="flex items-center gap-3">
      <span className="relative inline-flex h-2.5 w-2.5">
        {s.ping && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full ${s.ring} opacity-70 motion-safe:animate-ping`}
          />
        )}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${s.dot}`} />
      </span>
      <span className={`font-num text-[12px] font-semibold tracking-[0.22em] ${s.text}`}>{s.label}</span>
      <span className="text-mutedSoft">·</span>
      {block ? (
        <span className="font-num text-[12px] text-muted">
          Last block <span className="text-fg">#{block.number.toLocaleString()}</span>{" "}
          <span className={stalled ? "text-amber-300" : "text-muted"}>{agoLabel(age!)}</span>
        </span>
      ) : (
        <span className="text-[12px] text-muted">awaiting first finalized block…</span>
      )}
    </div>
  );
}
