import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

export function Field({
  id,
  label,
  hint,
  optional,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between">
        <Label htmlFor={id}>{label}</Label>
        {optional ? <span className="text-xs text-ink-subtle">Optional</span> : null}
      </div>
      {children}
      {hint}
    </div>
  );
}
