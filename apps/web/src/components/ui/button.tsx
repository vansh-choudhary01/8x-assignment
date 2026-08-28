import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "soft" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "focus-ring inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-8 px-3 text-[13px]",
        size === "md" && "h-9 px-4",
        size === "lg" && "h-11 px-5 text-[15px]",
        size === "icon" && "h-9 w-9",
        variant === "primary" && "bg-primary text-white shadow-sm hover:bg-primary-hover",
        variant === "outline" &&
          "border border-border bg-surface text-ink shadow-sm hover:border-border-strong hover:bg-surface-hover",
        variant === "ghost" && "text-ink-muted hover:bg-black/[0.04] hover:text-ink",
        variant === "soft" &&
          "border border-primary/20 bg-primary-soft text-primary hover:border-primary/35 hover:bg-primary-soft-strong",
        variant === "danger" && "border border-danger/20 bg-danger-soft text-danger hover:bg-red-100",
        className,
      )}
      {...props}
    />
  );
}
