import { useState, type ReactNode } from "react";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";

// Section 6 of the research write-up, as a dashboard page. The deliberate spine:
// lead with the NULL result. The long+short curve looks like alpha (Sharpe 2.8,
// CAGR 202%) but it is mostly ETH beta during a rally; isolating the short-only
// leg (PSR 35.9%) shows the smart-money signal is not distinguishable from noise.
// Equity curves are QuantConnect screenshots (no time-series export); everything
// else is rendered native + themed.

const AMBER = "#F0B429";
const TEAL = "#33B6A6";

type Metric = { k: string; v: string; flag?: "good" | "bad" };

type Strat = {
  name: string;
  img: string;
  alt: string;
  read: string;
  tone: "beta" | "noise";
  metrics: Metric[];
  link: string;
};

const STRATS: Strat[] = [
  {
    name: "Long + Short",
    img: "/backtest-long-short.png",
    alt: "QuantConnect strategy-equity curve, long + short variant",
    read: "Mostly ETH beta during a rally — the long leg carried the return. Market exposure, not signal.",
    tone: "beta",
    link: "https://www.quantconnect.cloud/backtest/18086152701d005883f9e99d7ff770a2/?theme=darkly",
    metrics: [
      { k: "Sharpe", v: "2.8" },
      { k: "CAGR", v: "202.52%" },
      { k: "Max DD", v: "42%", flag: "bad" },
      { k: "Win rate", v: "56%" },
      { k: "PSR", v: "79.3%" },
      { k: "Sortino", v: "3.8" },
    ],
  },
  {
    name: "Short Isolated",
    img: "/backtest-short-only.png",
    alt: "QuantConnect strategy-equity curve, short-only variant",
    read: "The actual test of the signal. PSR 35.9% → ~64% chance the true Sharpe is ≤ 0 — QuantConnect's own test flags it as noise.",
    tone: "noise",
    link: "https://www.quantconnect.cloud/backtest/990765b142bcb3fc7c9f18dfe6bc96ce/?theme=darkly",
    metrics: [
      { k: "Sharpe", v: "0.6", flag: "bad" },
      { k: "CAGR", v: "32.51%" },
      { k: "Max DD", v: "42%", flag: "bad" },
      { k: "Win rate", v: "39%", flag: "bad" },
      { k: "PSR", v: "35.9%", flag: "bad" },
      { k: "Sortino", v: "0.8", flag: "bad" },
    ],
  },
];

const RULES: { k: string; v: ReactNode }[] = [
  { k: "Universe", v: "ETH/USD · hourly bars" },
  { k: "Window", v: "2025-05-05 00:00 → 2026-05-04 23:59" },
  { k: "Position", v: "single asset · single position" },
  {
    k: "Signal",
    v: "168h (1-week) rolling z-score of each archetype's net ETH flow",
  },
  {
    k: "Entry",
    v: (
      <>
        short 95% of portfolio when{" "}
        <span className="font-num text-fg">dex_aggregator_user&nbsp;z&nbsp;&gt;&nbsp;1.0</span>{" "}
        at an hourly close, if flat
      </>
    ),
  },
  { k: "Exit", v: "liquidate exactly 72h after entry, regardless of price" },
];

// Per-archetype correlation between net-flow z-score and ETH price (6.2). Only
// dex_aggregator_user showed any apparent relationship — and testing all four
// then keeping the one that "worked" is itself the selection-bias problem (6.4).
const CORR: { a: string; note: string; weak: boolean }[] = [
  { a: "Dex Aggregator User", note: "weak — the only one used", weak: true },
  { a: "Active Dex Trader", note: "≈ none", weak: false },
  { a: "Meme Token Degen Trader", note: "≈ none", weak: false },
  { a: "Multi-Router DeFi Bot", note: "≈ none", weak: false },
];

const WHY_NEGATIVE = [
  {
    h: "Beta, not alpha",
    b: "The window was a strong ETH rally; the long leg produced almost all the return — market exposure you'd get from buy-and-hold.",
  },
  {
    h: "The isolated short fails significance",
    b: "PSR 35.9% ⇒ ~64% chance the true Sharpe is ≤ 0. Calmar 0.77 (32% return vs 42% drawdown) is far below deployable.",
  },
  {
    h: "Selection bias",
    b: "All four archetypes were tested; only one showed apparent edge. Cherry-picking it inflates false positives — a cardinal backtesting sin.",
  },
  {
    h: "Most likely explanation",
    b: "Inverse-beta — any short profits on ETH dips regardless of signal — plus luck on a small sample of trades.",
  },
];

export default function SignalValidation() {
  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Signal Validation"
        subtitle="Do smart-money archetype flows predict ETH price? A backtest — and a rigorous null result."
      />

      {/* hypothesis */}
      <div className="mt-5 rounded-xl border border-border bg-panel/60 p-5">
        <CardHeading>Hypothesis</CardHeading>
        <p className="mt-3 text-[13px] leading-relaxed text-fg">
          If the clustering found genuinely sophisticated wallets, their
          aggregate flow should predict future ETH price better than a random
          cohort does.
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Tested as the rolling z-score of each archetype's net ETH flow
          against subsequent price — strategy below.
        </p>
      </div>

      {/* strategy design */}
      <div className="mt-3 rounded-xl border border-border bg-panel/60 p-5">
        <CardHeading>Strategy Design</CardHeading>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {RULES.map((r) => (
            <div
              key={r.k}
              className="grid grid-cols-[72px_1fr] items-baseline gap-3"
            >
              <dt className="text-[11px] uppercase tracking-wide text-muted">
                {r.k}
              </dt>
              <dd className="text-[12.5px] leading-snug text-fg">{r.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* results: two strategies side by side */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {STRATS.map((s) => (
          <StratCard key={s.name} strat={s} />
        ))}
      </div>

      {/* analysis — flow-vs-price correlation + our read on the negative result */}
      <div className="mt-3 rounded-xl border border-border bg-panel/60 p-5">
        <CardHeading>Analysis</CardHeading>

        <div className="mt-4">
          <InsightBanner
            id="signal-correlation"
            compact
            label="Insight"
            insight={{
              tone: "warn",
              title: "Hypothesis Fails — smart-money flow did not predict ETH price",
              body: (
                <>
                  Three of the four archetypes show essentially zero flow-vs-price
                  correlation, and only{" "}
                  <span style={{ color: AMBER }}>Dex Aggregator User</span> registers
                  anything at all. Traded in isolation that lone leg returns PSR 35.9%
                  — a ~64% chance its true Sharpe is ≤ 0 — and selecting it{" "}
                  <em>because</em> it was the one hit is the multiple-comparison trap.
                </>
              ),
            }}
          />
        </div>

        <div className="mt-5 flex items-center gap-2">
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Flow-vs-Price Correlation
          </span>
          <span className="text-[10.5px] text-mutedSoft">· by archetype</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CORR.map((c) => (
            <div
              key={c.a}
              className="rounded-md border border-borderSoft bg-panel2/40 px-3 py-2.5"
            >
              <div className="text-[11px] text-muted">{c.a}</div>
              <div
                className="mt-1 font-num text-[13px] tabular-nums"
                style={{ color: c.weak ? AMBER : "#9098AB" }}
              >
                {c.note}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {WHY_NEGATIVE.map((w) => (
            <div
              key={w.h}
              className="rounded-md border border-borderSoft bg-panel2/40 p-4"
            >
              <div className="text-[12.5px] font-semibold text-fg">{w.h}</div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {w.b}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* conclusions */}
      <div className="relative mt-3 overflow-hidden rounded-xl border border-border bg-panel/60 p-5 pl-6">
        <div
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: TEAL }}
        />
        <SectionLabel>CONCLUSIONS</SectionLabel>
        <p className="mt-3 text-[13px] leading-relaxed text-fg">
          Although behavioral archetypes were a genuinely interesting hypothesis,
          we found no evidence that archetype flows predict ETH price. The headline
          return is ETH beta from a rising market, and the one archetype that looked
          predictive was the lone survivor of four tested — statistically
          insignificant and indistinguishable from chance.
        </p>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
          The archetypes likely have more to offer as description than prediction:
          the shifting mix of active clusters could be a useful read on market
          regime and, if it proves orthogonal to price and volatility, a
          supplemental signal that adds information a returns-only model would miss.
          Confirming that across multiple regimes is the obvious next step.
        </p>
      </div>
    </div>
  );
}

function StratCard({ strat }: { strat: Strat }) {
  const [imgError, setImgError] = useState(false);
  const isBeta = strat.tone === "beta";
  const tag = isBeta ? "BETA, NOT ALPHA" : "NOT SIGNIFICANT";
  const tagColor = isBeta ? AMBER : "#F45D7A";
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="text-[13.5px] font-semibold text-fg">{strat.name}</div>
          <a
            href={strat.link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-borderSoft bg-panel2/60 px-2 py-0.5 text-[10px] font-semibold text-muted transition hover:border-border hover:text-fg"
          >
            QuantConnect
            <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5">
              <path
                d="M7 17L17 7M17 7H8M17 7v9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ backgroundColor: `${tagColor}1A`, color: tagColor }}
        >
          {tag}
        </span>
      </div>

      <figure className="mt-3">
        {imgError ? (
          <div className="flex aspect-[2/1] w-full flex-col items-center justify-center rounded-lg border border-dashed border-borderSoft bg-panel2/40 px-4 text-center">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
              Backtest screenshot
            </div>
            <div className="mt-1.5 text-[11.5px] text-muted">
              Save the QuantConnect image to
            </div>
            <code className="mt-1 font-num text-[11px] text-sky-300">
              {strat.img.replace("/", "web/public/")}
            </code>
          </div>
        ) : (
          <img
            src={strat.img}
            alt={strat.alt}
            loading="lazy"
            onError={() => setImgError(true)}
            className="aspect-[1040/546] w-full rounded-lg border border-borderSoft bg-panel2 object-cover [filter:invert(0.92)_hue-rotate(180deg)]"
          />
        )}
        <figcaption className="mt-2 text-[11.5px] leading-relaxed text-muted">
          {strat.read}
        </figcaption>
      </figure>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {strat.metrics.map((m) => (
          <div
            key={m.k}
            className="rounded-md border border-borderSoft bg-panel2/40 px-2.5 py-1.5"
          >
            <div className="text-[9.5px] uppercase tracking-wide text-muted">
              {m.k}
            </div>
            <div
              className="font-num text-[14px] tabular-nums"
              style={{
                color:
                  m.flag === "bad"
                    ? "#F0889C"
                    : m.flag === "good"
                    ? TEAL
                    : "#D7DCE8",
              }}
            >
              {m.v}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
      {children}
    </div>
  );
}

function CardHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-[3px] rounded-full bg-accent-silver/70" />
      <h2 className="text-[13px] font-semibold leading-none tracking-tight text-fg">
        {children}
      </h2>
    </div>
  );
}
