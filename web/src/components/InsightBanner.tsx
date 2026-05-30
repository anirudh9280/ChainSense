import type { Insight } from "../lib/insights";

const toneMap: Record<Insight["tone"], { rail: string; pill: string; label: string }> = {
  info: { rail: "bg-sky-400/80",     pill: "bg-sky-400/10 text-sky-300",       label: "Insight" },
  good: { rail: "bg-emerald-400/80", pill: "bg-emerald-400/10 text-emerald-300", label: "Signal" },
  warn: { rail: "bg-amber-400/80",   pill: "bg-amber-400/10 text-amber-300",     label: "Watch"   },
};

export default function InsightBanner({ insight }: { insight: Insight }) {
  const t = toneMap[insight.tone];
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel/60 px-5 py-4 pl-6">
      <div className={`absolute inset-y-0 left-0 w-[3px] ${t.rail}`} />
      <div className="flex items-start gap-4">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${t.pill}`}>
          {t.label}
        </span>
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-fg">{insight.title}</div>
          <div className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {insight.body}
          </div>
        </div>
      </div>
    </div>
  );
}
