import type { Snapshot } from "../lib/snapshot";

const dotColors: Record<string, string> = {
  bronze: "#C38B5F",
  silver: "#B7C2D0",
  gold: "#E6C76A",
  model: "#7CC5E0",
};

export default function MedallionStrip({ m }: { m: Snapshot["medallion"] }) {
  return (
    <div className="rounded-xl border border-border bg-panel/60 px-6 py-5">
      <div className="grid grid-cols-1 gap-y-5 md:grid-cols-3 md:gap-x-10">
        <Stage
          icon={<DbIcon />}
          color="bronze"
          name="Bronze"
          desc={m.bronze.label}
          stat={m.bronze.rows}
          arrow
        />
        <Stage
          icon={<HexIcon />}
          color="gold"
          name="Gold"
          desc={m.gold.label}
          stat={m.gold.rows}
          arrow
        />
        <Stage
          icon={<ChipIcon />}
          color="model"
          name="Model"
          desc={m.model.algo}
          stat={`silhouette ${m.model.silhouette.toFixed(3)}`}
        />
      </div>
    </div>
  );
}

function Stage({
  icon,
  color,
  name,
  desc,
  stat,
  arrow,
}: {
  icon: React.ReactNode;
  color: keyof typeof dotColors;
  name: string;
  desc: string;
  stat: string;
  arrow?: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-borderSoft bg-panel2 text-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-fg">{name}</span>
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: dotColors[color],
              boxShadow: `0 0 8px ${dotColors[color]}88`,
            }}
          />
        </div>
        <div className="mt-0.5 truncate text-[12.5px] text-muted">
          {desc} {arrow && <span className="text-mutedSoft">→</span>}
        </div>
        <div className="mt-1 font-num text-[12.5px] text-fg/85">{stat}</div>
      </div>
    </div>
  );
}

function DbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <ellipse cx="12" cy="6" rx="7" ry="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path d="M12 3l9 5-9 5-9-5 9-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
function HexIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <path
        d="M12 3l3 1.7v3.5L12 10l-3-1.8V4.7L12 3zM6 8.5l3 1.7v3.5L6 15.5l-3-1.8v-3.5L6 8.5zM18 8.5l3 1.7v3.5l-3 1.8-3-1.8v-3.5L18 8.5zM12 14l3 1.7v3.5L12 21l-3-1.8v-3.5L12 14z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
      <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
