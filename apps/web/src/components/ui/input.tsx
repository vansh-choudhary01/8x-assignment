import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "focus-ring h-9 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink transition-colors placeholder:text-ink-subtle disabled:cursor-not-allowed disabled:bg-background disabled:text-ink-subtle",
        className,
      )}
      {...props}
    />
  );
}
