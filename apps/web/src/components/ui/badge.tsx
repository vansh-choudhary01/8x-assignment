import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        tone === "neutral" && "border-border bg-background text-ink-muted",
        tone === "primary" && "border-primary/20 bg-primary-soft text-primary",
        tone === "success" && "border-emerald-200 bg-success-soft text-success",
        tone === "warning" && "border-amber-200 bg-warning-soft text-warning",
        tone === "danger" && "border-red-200 bg-danger-soft text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}
