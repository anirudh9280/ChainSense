import { useEffect, useState } from "react";

// The Live page "News Feed": crypto headlines pulled from TheBlock + CoinDesk RSS and
// summarized into a small HTML list by a local Ollama model (llama3.2), served by the
// backend at /api/news (TTL-cached there — the first load waits a few seconds on the
// LLM, then it's instant). The model returns raw <ul>/<li>/<a>, sanitized server-side;
// we render it and lean on .news-html (index.css) for readable contrast on the dark panel.
type NewsResp = { html: string; updated: number; source: string };

const SOURCE_LABEL: Record<string, string> = {
  ollama: "llama3.2",
  fallback: "headlines",
  empty: "unavailable",
};

function agoLabel(epochSec: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epochSec));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export default function NewsFeed() {
  const [data, setData] = useState<NewsResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/news")
      .then((r) => (r.ok ? (r.json() as Promise<NewsResp>) : Promise.reject(new Error(`/api/news: ${r.status}`))))
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-panel/60 px-5 py-4 pl-6">
      <div className="absolute inset-y-0 left-0 w-[3px] bg-emerald-400/80" />
      <div className="flex items-start gap-4">
        <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
          News Feed
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <div className="text-[14px] font-semibold text-fg">Crypto headlines · AI-summarized</div>
            {data && data.source !== "empty" && (
              <span className="shrink-0 font-num text-[10.5px] text-mutedSoft">
                {SOURCE_LABEL[data.source] ?? data.source} · {agoLabel(data.updated)}
              </span>
            )}
          </div>

          {error ? (
            <div className="mt-2 text-[12.5px] text-muted">
              News feed unavailable right now — the summarizer didn't respond.
            </div>
          ) : !data ? (
            <NewsSkeleton />
          ) : (
            <div
              className="news-html mt-2 text-[13px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: data.html }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div className="mt-3 space-y-2.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-3 rounded bg-panel2/80 motion-safe:animate-pulse"
          style={{ width: `${88 - i * 14}%` }}
        />
      ))}
      <div className="pt-0.5 text-[11px] text-mutedSoft">Summarizing the latest headlines…</div>
    </div>
  );
}
