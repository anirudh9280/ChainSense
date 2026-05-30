export function DataSourceBanner({
  walletsPath,
  txnsPath,
  generatedAt,
}: {
  walletsPath: string;
  txnsPath: string;
  generatedAt: string;
}) {
  const when = new Date(generatedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <div className="rounded-xl border border-borderSoft bg-panel/40 px-4 py-2.5 text-[11px] text-muted">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <span className="font-num">
          <span className="text-muted">wallets:</span>{" "}
          <span className="text-fg/80">{walletsPath}</span>
        </span>
        <span className="font-num">
          <span className="text-muted">txns:</span>{" "}
          <span className="text-fg/80">{txnsPath}</span>
        </span>
        <span className="ml-auto font-num text-mutedSoft">
          snapshot built {when}
        </span>
      </div>
    </div>
  );
}
