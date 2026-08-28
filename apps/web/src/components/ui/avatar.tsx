import { cn } from "@/lib/cn";

export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const dims =
    size === "sm" ? "h-8 w-8 text-xs" : size === "md" ? "h-10 w-10 text-sm" : size === "lg" ? "h-14 w-14 text-lg" : "h-20 w-20 text-2xl";

  if (src) {
    return <img src={src} alt="" className={cn("shrink-0 rounded-full object-cover", dims, className)} />;
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary",
        dims,
        className,
      )}
    >
      {(name || "?").trim().slice(0, 1).toUpperCase()}
    </div>
  );
}
