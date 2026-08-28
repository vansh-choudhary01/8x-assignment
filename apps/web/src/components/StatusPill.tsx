import { cn } from "@/lib/cn";

function tone(value: string) {
  const key = value.toUpperCase();
  if (["QUEUED", "RUNNING"].includes(key) || key === "EMBEDDED") {
    return "border-primary/20 bg-primary-soft text-primary";
  }
  if (["SUCCEEDED", "COMPLETED", "ACCEPTED", "APPROVED", "PUBLISHED", "OPEN"].includes(key)) {
    return "border-emerald-200 bg-success-soft text-success";
  }
  if (["FAILED", "REJECTED", "CANCELLED"].includes(key)) {
    return "border-red-200 bg-danger-soft text-danger";
  }
  if (["BLOCKED", "INVITED", "SUBMITTED", "CONTENT_SUBMITTED"].includes(key)) {
    return "border-amber-200 bg-warning-soft text-warning";
  }
  return "border-border bg-background text-ink-muted";
}

export function StatusPill({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        tone(value),
      )}
    >
      {value.toLowerCase().replaceAll("_", " ")}
    </span>
  );
}
