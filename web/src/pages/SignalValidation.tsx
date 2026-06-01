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
};

const STRATS: Strat[] = [
  {
    name: "Long + Short",
    img: "/backtest-long-short.png",
    alt: "QuantConnect strategy-equity curve, long + short variant",
    read: "Mostly ETH beta during a rally — the long leg carried almost all of the return. That is market exposure, not signal.",
    tone: "beta",
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
    name: "Short only · isolated",
    img: "/backtest-short-only.png",
    alt: "QuantConnect strategy-equity curve, short-only variant",
    read: "The actual test of the signal. PSR 35.9% → ≈ 64% probability the true Sharpe is ≤ 0. QuantConnect's own significance test flags it as noise.",
    tone: "noise",
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
        <span className="font-num text-fg">power_protocol_user&nbsp;z&nbsp;&gt;&nbsp;1.0</span>{" "}
        at an hourly close, if flat
      </>
    ),
  },
  { k: "Exit", v: "liquidate exactly 72h after entry, regardless of price" },
];

// Per-archetype correlation between net-flow z-score and ETH price (6.2). Only
// power_protocol_user showed any apparent relationship — and testing all four
// then keeping the one that "worked" is itself the selection-bias problem (6.4).
const CORR: { a: string; note: string; weak: boolean }[] = [
  { a: "Dex Power Trader", note: "≈ none", weak: false },
  { a: "Long-Term Dex Trader", note: "≈ none", weak: false },
  { a: "Whale", note: "≈ none", weak: false },
  { a: "Power Protocol User", note: "weak — the only one used", weak: true },
];

const WHY_NEGATIVE = [
  {
    h: "Beta, not alpha",
    b: "The test window was a strong ETH rally. Decomposing returns shows the long leg produced almost all of them — that's market exposure, available from buy-and-hold.",
  },
  {
    h: "The isolated short fails significance",
    b: "PSR 35.9% means ≈ 64% probability the true Sharpe is ≤ 0. A Calmar of 0.77 (32% return against 42% drawdown) is well below any deployable threshold.",
  },
  {
    h: "Selection bias",
    b: "Signals from all four archetypes were tested; only power_protocol_user showed apparent edge. Multiple-comparison testing on one dataset inflates false positives — a cardinal backtesting sin.",
  },
  {
    h: "Most likely explanation",
    b: "Inverse-beta exposure — any short profits during ETH dips regardless of signal — combined with luck on a small sample of trades.",
  },
];

const NEXT_STEPS = [
  "Out-of-sample split — discover archetypes on months 1–8, test on 9–12.",
  "Random-cohort baseline — same strategy on equal-size random wallet samples to set a noise floor.",
  "Beta-neutralized returns — regress against ETH spot; only the residual is alpha.",
  "Realistic costs — perpetual funding (10–30%/yr for ETH shorts) and slippage.",
  "Look-ahead audit — confirm no signal at time t uses information from after t.",
];

export default function SignalValidation() {
  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Signal Validation"
        subtitle="Do smart-money archetype flows predict ETH price? A backtest — and an honest null result."
        status="QuantConnect · null result"
      />

      <InsightBanner
        insight={{
          tone: "warn",
          title: "The smart-money signal did not produce reliable alpha — and that is the result",
          body:
            "If the clustering found genuinely sophisticated wallets, their aggregate flow should predict price. The long+short backtest looks impressive (Sharpe 2.8, CAGR 202%) — but that is mostly ETH beta during a rally. Isolating the short-only leg, where a real signal would still pay, gives PSR 35.9%: roughly a 2-in-3 chance the true Sharpe is zero or negative. A null result, rigorously shown.",
        }}
      />

      {/* hypothesis + strategy rules */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.05fr]">
        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <SectionLabel>HYPOTHESIS</SectionLabel>
          <p className="mt-3 text-[13px] leading-relaxed text-fg">
            If the clustering identified genuinely sophisticated wallets, their
            aggregate trading flow should carry information about future price
            that a random cohort does not.
          </p>
          <p className="mt-3 text-[12px] leading-relaxed text-muted">
            For each hour, net ETH flow into and out of every wallet in each
            archetype is reduced to a 168-hour rolling z-score, then tested as a
            predictor of subsequent ETH price movement.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <SectionLabel>STRATEGY DESIGN</SectionLabel>
          <dl className="mt-3 space-y-2">
            {RULES.map((r) => (
              <div
                key={r.k}
                className="grid grid-cols-[88px_1fr] items-baseline gap-3"
              >
                <dt className="text-[11px] uppercase tracking-wide text-muted">
                  {r.k}
                </dt>
                <dd className="text-[12.5px] leading-snug text-fg">{r.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* results: two strategies side by side */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {STRATS.map((s) => (
          <StratCard key={s.name} strat={s} />
        ))}
      </div>

      {/* correlation by archetype */}
      <div className="mt-3 rounded-xl border border-border bg-panel/60 p-5">
        <SectionLabel>FLOW-VS-PRICE CORRELATION · by archetype</SectionLabel>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
        <p className="mt-4 text-[12px] leading-relaxed text-muted">
          Three of four archetypes showed essentially no correlation. Only{" "}
          <span style={{ color: AMBER }}>Power Protocol User</span> showed a weak
          relationship — and selecting it <em>because</em> it was the one that
          worked is exactly the multiple-comparison trap that makes the apparent
          edge untrustworthy.
        </p>
      </div>

      {/* why honestly negative */}
      <div className="mt-3 rounded-xl border border-border bg-panel/60 p-5">
        <SectionLabel>WHY THE RESULT IS HONESTLY NEGATIVE</SectionLabel>
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

      {/* what would make it conclusive + takeaway */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.1fr_1fr]">
        <div className="rounded-xl border border-border bg-panel/60 p-5">
          <SectionLabel>WHAT WOULD MAKE THIS CONCLUSIVE</SectionLabel>
          <ul className="mt-4 space-y-2.5">
            {NEXT_STEPS.map((s, i) => (
              <li key={i} className="flex gap-3 text-[12.5px] leading-snug">
                <span
                  className="mt-[2px] grid h-4 w-4 shrink-0 place-items-center rounded-full font-num text-[10px] tabular-nums"
                  style={{ backgroundColor: "rgba(51,182,166,0.15)", color: TEAL }}
                >
                  {i + 1}
                </span>
                <span className="text-muted">{s}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] italic text-muted/80">
            Not yet done — these are the natural next steps.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-border bg-panel/60 p-5 pl-6">
          <div
            className="absolute inset-y-0 left-0 w-[3px]"
            style={{ backgroundColor: TEAL }}
          />
          <SectionLabel>THE HONEST TAKEAWAY</SectionLabel>
          <p className="mt-3 text-[13px] leading-relaxed text-fg">
            The negative result is not a failure — it is the project working
            correctly. A null result rigorously demonstrated is more credible
            than a positive one that ignores its confounds.
          </p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            The pipeline produced clean signals; the signals did not produce
            reliable returns. That is useful information about what behavioral
            clustering alone can and cannot do.
          </p>
        </div>
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
        <div className="text-[13.5px] font-semibold text-fg">{strat.name}</div>
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
            className="w-full rounded-lg border border-borderSoft bg-white"
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
