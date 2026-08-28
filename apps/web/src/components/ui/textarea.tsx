import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "focus-ring min-h-24 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink transition-colors placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-background disabled:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}
