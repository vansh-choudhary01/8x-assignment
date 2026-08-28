import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const CREATOR_STAGES = ["queued", "fetching", "extracting", "analyzing", "writing", "ready"] as const;
const BRAND_STAGES = ["queued", "fetching", "extracting", "analyzing", "writing", "ready"] as const;

const CREATOR_COPY = {
  queued: "Queued. Starting with public LinkedIn and X…",
  fetching: "Reading public LinkedIn and X pages…",
  extracting: "Extracting what those pages actually returned…",
  analyzing: "Running AI on that source text…",
  writing: "Building your Creator Card…",
  ready: "Your card is ready to review.",
  blocked: "Neither public source returned enough data from this server.",
} as const;

const BRAND_COPY = {
  queued: "Queued. Starting with your website…",
  fetching: "Reading your public pages…",
  extracting: "Extracting company copy…",
  analyzing: "Understanding the company, ICP, and campaign fit…",
  writing: "Building company intelligence…",
  ready: "Company profile is ready to review.",
} as const;

export function AnalyzingStatus({
  stage,
  kind,
}: {
  stage?: string;
  kind: "creator" | "brand";
}) {
  const map = kind === "creator" ? CREATOR_COPY : BRAND_COPY;
  const stages = kind === "creator" ? CREATOR_STAGES : BRAND_STAGES;
  const primary = stage && stage in map ? map[stage as keyof typeof map] : map.queued;
  const stepIndex = Math.max(0, stages.indexOf((stage as (typeof stages)[number]) ?? "queued"));

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border bg-primary-soft/60 px-6 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft-strong text-primary">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        </div>
        <div>
          <p className="page-kicker">Naano is working</p>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">{primary}</h2>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-6 py-4">
        {stages.map((step, index) => (
          <div
            key={step}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              index <= stepIndex ? "bg-primary" : "bg-border"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export function StuckContinue({
  onContinue,
  completing,
}: {
  onContinue: () => void;
  completing: boolean;
}) {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWaited(true), 90_000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!waited) return null;
  return (
    <div className="panel flex items-center justify-between gap-4 p-4">
      <p className="text-sm text-ink-muted">
        This is taking longer than expected. You can continue into the workspace.
      </p>
      <button
        type="button"
        className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        disabled={completing}
        onClick={onContinue}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {completing ? "Opening…" : "Continue anyway"}
      </button>
    </div>
  );
}
