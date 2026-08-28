import { ArrowRight } from "lucide-react";

type Stage = { label: string; value: number };

export function Funnel({ stages }: { stages: Stage[] }) {
  // The last stage is typically a different unit (e.g. revenue in currency,
  // not a count), so it is excluded from the shared width scale.
  const countStages = stages.slice(0, -1);
  const max = Math.max(1, ...countStages.map((s) => s.value));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      {stages.map((stage, index) => {
        const isLast = index === stages.length - 1;
        const prev = index > 0 ? stages[index - 1].value : null;
        const rate = prev && prev > 0 ? Math.round((stage.value / prev) * 100) : null;
        const width = isLast
          ? stage.value > 0
            ? 100
            : 0
          : stage.value > 0
            ? Math.max(8, Math.round((stage.value / max) * 100))
            : 0;
        return (
          <div key={stage.label} className="relative">
            <div className="card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-ink-muted">{stage.label}</p>
                {rate !== null ? (
                  <span className="text-[11px] font-medium text-ink-subtle">{rate}% of {stages[index - 1].label.toLowerCase()}</span>
                ) : null}
              </div>
              <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{stage.value}</p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
            {index < stages.length - 1 ? (
              <div className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 sm:block">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-ink-subtle">
                  <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
