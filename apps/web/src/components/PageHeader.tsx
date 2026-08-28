import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {kicker ? <p className="page-kicker">{kicker}</p> : null}
        <h1 className={cn("page-title", kicker && "mt-1.5")}>{title}</h1>
        {description ? <p className="page-lead">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
