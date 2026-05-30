type Accent = "blue" | "green" | "purple" | "amber" | "cyan" | "red";

const accentMap: Record<Accent, { ring: string; bar: string }> = {
  blue:   { ring: "ring-sky-400/30",     bar: "bg-sky-400/80" },
  green:  { ring: "ring-emerald-400/30", bar: "bg-emerald-400/80" },
  purple: { ring: "ring-violet-400/30",  bar: "bg-violet-400/80" },
  amber:  { ring: "ring-amber-400/30",   bar: "bg-amber-400/80" },
  cyan:   { ring: "ring-cyan-400/30",    bar: "bg-cyan-400/80" },
  red:    { ring: "ring-rose-400/30",    bar: "bg-rose-400/80" },
};

export default function MetricTile({
  label,
  value,
  caption,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  caption: string;
  accent?: Accent;
}) {
  const a = accentMap[accent];
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-panel/70 px-5 py-4 ring-1 ${a.ring}`}
    >
      <div className={`absolute inset-y-0 left-0 w-[2px] ${a.bar}`} />
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
      <div className="mt-3 font-num text-[26px] font-semibold leading-none text-fg">
        {value}
      </div>
      <div className="mt-2 text-[11.5px] text-muted">{caption}</div>
    </div>
  );
}
