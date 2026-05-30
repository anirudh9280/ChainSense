export default function DailyActiveChart({
  data,
  title,
  bucketLabel,
}: {
  data: number[];
  title: string;
  bucketLabel: string;
}) {
  const max = Math.max(...data, 1);
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="text-[10.5px] font-semibold tracking-[0.18em] text-muted">
        {title}
      </div>
      <div className="mt-1 text-[11.5px] text-muted">per {bucketLabel} bucket</div>

      <div className="mt-4 flex h-[88px] items-end gap-[2.5px]">
        {data.map((v, i) => {
          const h = Math.max(2, (v / max) * 100);
          return (
            <div
              key={i}
              className="flex-1 rounded-sm bg-sky-400/70"
              style={{ height: `${h}%` }}
            />
          );
        })}
      </div>
    </div>
  );
}
