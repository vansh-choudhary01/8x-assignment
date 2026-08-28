import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function OnboardingSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors",
                  done && "bg-primary text-white",
                  active && !done && "bg-primary-soft text-primary ring-2 ring-primary/25",
                  !active && !done && "bg-background text-ink-subtle",
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={2.5} /> : index + 1}
              </span>
              <span className={cn("text-sm font-medium", active || done ? "text-ink" : "text-ink-subtle")}>
                {step}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <span className={cn("h-px flex-1", done ? "bg-primary/40" : "bg-border")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
