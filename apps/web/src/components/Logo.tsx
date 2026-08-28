import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-primary",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="9" cy="12" r="6.5" fill="white" />
        <circle cx="15" cy="12" r="6.5" fill="white" fillOpacity="0.55" />
      </svg>
    </span>
  );
}
