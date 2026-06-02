import { useState } from "react";
import type { Insight } from "../lib/insights";

const toneMap: Record<Insight["tone"], { rail: string; pill: string; label: string }> = {
  info: { rail: "bg-sky-400/80",     pill: "bg-sky-400/10 text-sky-300",       label: "Insight" },
  good: { rail: "bg-emerald-400/80", pill: "bg-emerald-400/10 text-emerald-300", label: "Signal" },
  warn: { rail: "bg-amber-400/80",   pill: "bg-amber-400/10 text-amber-300",     label: "Watch"   },
  danger: { rail: "bg-rose-500/80",  pill: "bg-rose-500/10 text-rose-300",       label: "Alert"   },
};

// Collapsible: the body folds away to a single title line, freeing the top of
// the page. State persists across navigation via localStorage when an `id` is
// given (each page passes a stable one).
export default function InsightBanner({
  insight,
  id,
  compact = false,
  label,
}: {
  insight: Insight;
  id?: string;
  compact?: boolean;
  label?: string;
}) {
  const t = toneMap[insight.tone];
  const pillLabel = label ?? t.label;
  const storageKey = id ? `cs.banner.${id}` : null;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!storageKey) return false;
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, next ? "1" : "0");
        } catch {
          /* ignore */
        }
      }
      return next;
    });

  return (
    <div
      className={`relative overflow-hidden ${
        compact
          ? "rounded-lg border border-borderSoft bg-panel2/40 px-4 py-3 pl-5"
          : "rounded-xl border border-border bg-panel/60 px-5 py-4 pl-6"
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-[3px] ${t.rail}`} />
      <div className={`flex items-start ${compact ? "gap-3" : "gap-4"}`}>
        {!compact && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] ${t.pill}`}
          >
            {pillLabel}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className={`font-semibold text-fg ${compact ? "text-[12px]" : "text-[14px]"}`}>
            {insight.title}
          </div>
          {!collapsed && (
            <div
              className={`mt-1 leading-relaxed text-muted ${compact ? "text-[11px]" : "text-[12.5px]"}`}
            >
              {insight.body}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand insight" : "Collapse insight"}
          aria-expanded={!collapsed}
          className="-mr-1 -mt-1 shrink-0 rounded-md p-1 text-muted transition hover:bg-panel2/60 hover:text-fg"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`h-4 w-4 transition-transform ${collapsed ? "" : "rotate-180"}`}
          >
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
