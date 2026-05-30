export default function PageHeader({
  title,
  subtitle,
  status = "snapshot · indexed",
}: {
  title: string;
  subtitle: string;
  status?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-6 pb-6">
      <div className="flex-1 text-center">
        <h1 className="text-[15px] font-semibold tracking-tight text-fg">
          {title}
        </h1>
        <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>
      </div>
      <div className="shrink-0">
        <span className="inline-flex items-center gap-2 rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-[11.5px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/90 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          {status}
        </span>
      </div>
    </div>
  );
}
