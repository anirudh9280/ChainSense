import type { Selector } from "../lib/data";

const BUCKET_LABEL: Record<string, string> = {
  transfer_share: "transfer",
  approve_share: "approve",
  swap_general_share: "swap",
  swap_meme_share: "meme swap",
  swap_agg_share: "agg swap",
  mint_share: "mint",
  automation_share: "automation",
  flag_has_mev: "MEV",
  flag_has_aa: "AA",
  dropped: "dropped",
};

export default function SelectorTable({ selectors }: { selectors: Selector[] }) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 p-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        TOP FUNCTION SELECTORS
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        the 4-byte signatures behind the selector-share features · ranked by frequency, hand-verified
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className="text-[9.5px] uppercase tracking-[0.12em] text-muted">
              <th className="pb-2 pr-3 font-semibold">#</th>
              <th className="pb-2 pr-3 font-semibold">Selector</th>
              <th className="pb-2 pr-3 font-semibold">Meaning</th>
              <th className="pb-2 pr-3 font-semibold">Bucket</th>
              <th className="pb-2 text-right font-semibold">Verified</th>
            </tr>
          </thead>
          <tbody className="text-[11px]">
            {selectors.map((s) => {
              const dropped = s.bucket === "dropped";
              return (
                <tr key={s.rank} className={`border-t border-borderSoft ${dropped ? "opacity-45" : ""}`}>
                  <td className="py-1.5 pr-3 align-top font-num text-mutedSoft">{s.rank}</td>
                  <td className="py-1.5 pr-3 align-top">
                    <div className="font-num text-sky-300">{s.selector}</div>
                    <div className="max-w-[200px] truncate font-num text-[10px] text-mutedSoft" title={s.signature}>
                      {s.signature}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 align-top text-fg/80">{s.meaning}</td>
                  <td className="py-1.5 pr-3 align-top">
                    <span className="rounded-full border border-borderSoft bg-panel2 px-1.5 py-px font-num text-[10px] text-muted">
                      {BUCKET_LABEL[s.bucket] ?? s.bucket}
                    </span>
                  </td>
                  <td className="py-1.5 text-right align-top">
                    {s.verified ? (
                      <span className="text-emerald-300">✓</span>
                    ) : (
                      <span className="text-mutedSoft">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
