import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({
  title,
  description,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("card", className)}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </div>
  );
}
