import PageHeader from "./PageHeader";

export default function StubPage({
  title,
  subtitle,
  description,
}: {
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid place-items-center rounded-xl border border-dashed border-borderSoft bg-panel/40 px-8 py-20 text-center">
        <div className="max-w-md">
          <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted">
            Coming next
          </div>
          <div className="mt-3 text-[14.5px] text-fg/90">{description}</div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-borderSoft bg-panel px-3 py-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300/90 shadow-[0_0_8px_rgba(252,211,77,0.7)]" />
            stub · wire to gold layer
          </div>
        </div>
      </div>
    </div>
  );
}
