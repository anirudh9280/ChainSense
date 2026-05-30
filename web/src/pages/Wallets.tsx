import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { archColorHex } from "../lib/snapshot";
import type { SampleWallet, Snapshot } from "../lib/snapshot";
import PageHeader from "../components/PageHeader";
import InsightBanner from "../components/InsightBanner";

type Ctx = { snap: Snapshot | null };

export default function Wallets() {
  const { snap } = useOutletContext<Ctx>();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const wallets = snap?.sampleWallets.values ?? [];
  const filtered = useMemo(
    () =>
      wallets.filter((w) =>
        query ? w.addr.toLowerCase().includes(query.toLowerCase()) : true
      ),
    [wallets, query]
  );
  const sel = filtered[selectedIdx] ?? wallets[0];

  if (!snap) return null;

  return (
    <div className="mx-auto max-w-[1140px]">
      <PageHeader
        title="Wallet Inspector"
        subtitle="Per-address archetype assignment and the raw engineered features behind it"
      />

      <InsightBanner
        insight={{
          tone: "info",
          title: "Each wallet shown carries its real, raw feature vector",
          body: `K-Means assigned every address to one of ${snap.clustering.k} archetypes from the ${snap.metrics.featuresPerWallet}-feature space. The features shown below are the raw, unscaled values straight out of ${snap._dataSource.wallets.split("/").pop()}.`,
        }}
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-xl border border-border bg-panel/60 p-4">
          <input
            className="w-full rounded-lg border border-borderSoft bg-panel2 px-3 py-2 font-num text-[12.5px] text-fg placeholder:text-mutedSoft focus:outline-none focus:ring-1 focus:ring-sky-400/30"
            placeholder="0x… search address"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
          />

          <div className="mt-4 flex items-center justify-between">
            <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
              SAMPLE · top-tx per archetype
            </div>
            <span className="text-[10.5px] text-muted">{filtered.length}</span>
          </div>

          <ul className="mt-2 space-y-1.5">
            {filtered.map((w, i) => {
              const c = archColorHex(w.archetype, snap.archetypes);
              return (
                <li key={w.addr}>
                  <button
                    onClick={() => setSelectedIdx(i)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition ${
                      i === selectedIdx
                        ? "border-white/10 bg-panel2"
                        : "border-transparent hover:border-borderSoft hover:bg-panel2/60"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: c }} />
                      <span className="font-num text-[12px] text-fg">{w.short}</span>
                    </span>
                    <span className="font-num text-[11px] text-muted">
                      {w.txns.toLocaleString()} tx
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-borderSoft pt-3 font-num text-[10.5px] text-mutedSoft">
            {snap.sampleWallets._provenance}
          </div>
        </div>

        {sel && <Inspector w={sel} snap={snap} />}
      </div>
    </div>
  );
}

function Inspector({ w, snap }: { w: SampleWallet; snap: Snapshot }) {
  const color = archColorHex(w.archetype, snap.archetypes);
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
            SELECTED WALLET
          </div>
          <div className="mt-1 font-num text-[18px] font-semibold text-fg">
            {w.short}
          </div>
          <div className="mt-0.5 truncate font-num text-[10.5px] text-muted">
            {w.addr}
          </div>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color,
            background: `${color}1a`,
            boxShadow: `inset 0 0 0 1px ${color}33`,
          }}
        >
          {w.archetype}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-4">
        <Stat label="ETH SENT" v={w.totalSentEth.toLocaleString("en-US", { maximumFractionDigits: 4 })} unit="ETH" />
        <Stat label="ETH RECEIVED" v={w.totalReceivedEth.toLocaleString("en-US", { maximumFractionDigits: 4 })} unit="ETH" />
      </div>

      <div className="mt-5 border-t border-borderSoft pt-4">
        <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
          BEHAVIORAL FEATURES · raw
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 font-num text-[12.5px]">
          <Row k="tx_count" v={w.txns.toLocaleString()} />
          <Row k="tx_frequency" v={w.txFrequency.toFixed(4)} />
          <Row k="avg_gas" v={w.avgGas.toLocaleString()} />
          <Row k="contract_call_ratio" v={w.contractCallRatio.toFixed(3)} />
          <Row k="unique_recipients" v={w.uniqueRecipients.toLocaleString()} />
          <Row k="unique_senders" v={w.uniqueSenders.toLocaleString()} />
          <Row k="tokens_sent_count" v={w.tokensSent.toLocaleString()} />
          <Row k="tokens_received_count" v={w.tokensReceived.toLocaleString()} />
          <Row k="unique_tokens_sent" v={w.uniqueTokensSent.toLocaleString()} />
          <Row k="unique_tokens_received" v={w.uniqueTokensReceived.toLocaleString()} />
        </dl>
      </div>
    </div>
  );
}

function Stat({ label, v, unit }: { label: string; v: string; unit?: string }) {
  return (
    <div className="rounded-lg border border-borderSoft bg-panel2/60 px-3 py-2">
      <div className="text-[10px] font-semibold tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-1 font-num text-[15px] font-semibold text-fg">
        {v}
        {unit && <span className="ml-1 text-[11px] font-normal text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-borderSoft/40 pb-1">
      <dt className="text-muted">{k}</dt>
      <dd className="text-fg">{v}</dd>
    </div>
  );
}
