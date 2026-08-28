import { Briefcase, Sparkles, X as XIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AnalyzingStatus, StuckContinue } from "@/components/AnalyzingStatus";
import { AppShell } from "@/components/AppShell";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { StatusPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isIngesting, useCompleteOnboarding, useIngestPolling } from "@/lib/onboarding";
import type { CreatorProfile } from "@/lib/types";

function Origin({ value }: { value?: string }) {
  if (!value || value === "missing") {
    return <span className="text-[11px] text-ink-subtle">Not in the public source</span>;
  }
  return (
    <span className="text-[11px] text-primary">
      {value === "sourced" ? "From source" : "AI from that source"}
    </span>
  );
}

export function CreatorHomePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { completing, complete } = useCompleteOnboarding("/api/creators/me/complete", "/creator", setError);

  async function load() {
    const data = await api<{ profile: CreatorProfile | null }>("/api/creators/me");
    setProfile(data.profile);
    if (data.profile?.linkedInUrl) setLinkedInUrl(data.profile.linkedInUrl);
    if (data.profile?.xUrl) setXUrl(data.profile.xUrl);
    return data.profile;
  }

  useEffect(() => {
    void load()
      .catch((err: unknown) => setError(errorMessage(err, "Could not load profile")))
      .finally(() => setLoading(false));
  }, []);

  const ingesting = isIngesting(profile?.ingestionStatus);
  useIngestPolling(ingesting, () =>
    load().catch((err: unknown) => setError(errorMessage(err, "Could not load profile"))),
  );

  async function rebuild() {
    setError(null);
    setSaving(true);
    setEditing(false);
    try {
      const data = await api<{ profile: CreatorProfile }>("/api/creators/me", {
        method: "PUT",
        body: JSON.stringify({
          ...(linkedInUrl.trim() ? { linkedInUrl: linkedInUrl.trim() } : {}),
          ...(xUrl.trim() ? { xUrl: xUrl.trim() } : {}),
          refetch: true,
        }),
      });
      setProfile(data.profile);
    } catch (err) {
      setError(errorMessage(err, "Could not start analysis"));
    } finally {
      setSaving(false);
    }
  }

  async function analyze(event: FormEvent) {
    event.preventDefault();
    await rebuild();
  }

  const ready =
    profile &&
    !ingesting &&
    (profile.ingestionStatus === "SUCCEEDED" || profile.ingestionStatus === "BLOCKED" || profile.ingestionStatus === "FAILED");

  const step = ingesting ? 1 : ready ? 2 : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <OnboardingSteps steps={["Add sources", "Naano builds your card", "Review & confirm"]} current={step} />

        <div className="mt-8">
          <p className="page-kicker">Creator onboarding</p>
          <h1 className="mt-2 page-title text-3xl">Naano builds your card</h1>
          <p className="page-lead">
            Add a public LinkedIn URL and/or a public X URL. We fetch what those pages actually return,
            then AI writes one Creator Card. If one source is blocked, we continue with the other.
          </p>
        </div>

        {loading ? <p className="mt-10 text-sm text-ink-muted">Loading…</p> : null}
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <form className="card mt-8 space-y-4 p-6" onSubmit={analyze}>
          <Field id="linkedInUrl" label="Public LinkedIn URL" optional>
            <div className="relative">
              <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" strokeWidth={2} />
              <Input
                id="linkedInUrl"
                type="url"
                className="pl-9"
                placeholder="https://www.linkedin.com/in/you"
                value={linkedInUrl}
                onChange={(event) => setLinkedInUrl(event.target.value)}
                disabled={ingesting}
              />
            </div>
          </Field>
          <Field id="xUrl" label="Public X URL" optional>
            <div className="relative">
              <XIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" strokeWidth={2} />
              <Input
                id="xUrl"
                type="url"
                className="pl-9"
                placeholder="https://x.com/you"
                value={xUrl}
                onChange={(event) => setXUrl(event.target.value)}
                disabled={ingesting}
              />
            </div>
          </Field>
          <p className="text-xs text-ink-subtle">
            At least one URL is required. Guest LinkedIn /in/ pages are often blocked; a public post URL
            still works.
          </p>
          <Button type="submit" disabled={saving || ingesting || (!linkedInUrl.trim() && !xUrl.trim())}>
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            {ingesting ? "Working…" : saving ? "Starting…" : "Fetch public data"}
          </Button>
        </form>

        <div className="mt-6">
          {ingesting ? (
            <div className="space-y-4">
              <AnalyzingStatus kind="creator" stage={profile?.analysisStage} />
              <StuckContinue onContinue={complete} completing={completing} />
            </div>
          ) : null}
          {ready ? (
            <div className="space-y-6">
              <div className="panel flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <p className="text-sm text-ink">
                  {profile.ingestionStatus === "SUCCEEDED"
                    ? profile.enrichmentStatus === "SUCCEEDED"
                      ? "Your card is ready. Confirm it to enter the workspace."
                      : "We built a card from the public pages we could read. Review it and edit anything that looks off."
                    : profile.ingestionStatus === "BLOCKED"
                      ? "We could not read enough from the public pages you provided. Try another URL, or continue and fill in the card yourself."
                      : "We could not finish reading those public pages. Try again, or continue and fill in the card yourself."}
                </p>
              </div>
              <CreatorCard profile={profile} name={profile.publicName || user?.name || ""} />
              {editing ? (
                <ConfirmEdits
                  profile={profile}
                  onCancel={() => setEditing(false)}
                  onSaved={(next) => {
                    setProfile(next);
                    setEditing(false);
                  }}
                />
              ) : (
                <div className="flex flex-wrap gap-3">
                  <Button onClick={complete} disabled={completing}>
                    {completing
                      ? "Opening workspace…"
                      : profile.ingestionStatus === "SUCCEEDED"
                        ? "Looks right — go to dashboard"
                        : "Continue to dashboard"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Fix something
                  </Button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function ConfirmEdits({
  profile,
  onCancel,
  onSaved,
}: {
  profile: CreatorProfile;
  onCancel: () => void;
  onSaved: (profile: CreatorProfile) => void;
}) {
  const [headline, setHeadline] = useState(profile.headline);
  const [bio, setBio] = useState(profile.bio);
  const [positioning, setPositioning] = useState(profile.positioning);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="card space-y-4 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        void api<{ profile: CreatorProfile }>("/api/creators/me", {
          method: "PUT",
          body: JSON.stringify({
            ...(profile.linkedInUrl ? { linkedInUrl: profile.linkedInUrl } : {}),
            ...(profile.xUrl ? { xUrl: profile.xUrl } : {}),
            headline,
            bio,
            positioning,
            refetch: false,
          }),
        })
          .then((data) => onSaved(data.profile))
          .catch((err: unknown) => setError(errorMessage(err, "Could not save")))
          .finally(() => setSaving(false));
      }}
    >
      <p className="text-sm text-ink-muted">Only the fields you change are updated. We will not re-fetch public pages.</p>
      <Field id="headline" label="Headline">
        <Input id="headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </Field>
      <Field id="bio" label="Card copy">
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
      <Field id="positioning" label="Positioning">
        <Input id="positioning" value={positioning} onChange={(e) => setPositioning(e.target.value)} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function CreatorCard({ profile, name }: { profile: CreatorProfile | null; name: string }) {
  if (!profile) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong bg-surface/60 p-8 text-center">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Waiting for a public profile</h2>
        <p className="mt-2 text-sm text-ink-muted">Add a LinkedIn URL and/or an X URL to build the card.</p>
      </div>
    );
  }

  const insights = profile.insights;
  const origins = insights?.fieldOrigins ?? {};
  const displayName = profile.publicName || name;
  const copy = insights?.cardCopy || profile.bio || profile.publicDescription;
  const pricing = insights?.pricingRecommendation;

  return (
    <article className="card overflow-hidden">
      <div className="h-16 bg-gradient-to-r from-primary-soft to-transparent" />
      <div className="px-6 pb-6 sm:px-8 sm:pb-8">
        <div className="-mt-8 flex items-end gap-4">
          {profile.publicImageUrl ? (
            <img
              src={profile.publicImageUrl}
              alt=""
              className="h-16 w-16 rounded-xl border-4 border-surface object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border-4 border-surface bg-primary-soft text-lg font-semibold text-primary shadow-sm">
              {displayName.slice(0, 1)}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <StatusPill value={profile.ingestionStatus} />
            <StatusPill value={profile.enrichmentStatus} />
            {profile.socialSource ? <Badge>Source: {profile.socialSource}</Badge> : null}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-ink">{displayName}</h2>
            <Origin value={origins.name} />
          </div>
          {profile.xUsername ? (
            <p className="mt-1 text-sm text-ink-muted">
              @{profile.xUsername}
              {profile.xUrl ? (
                <>
                  {" · "}
                  <a className="text-primary hover:underline" href={profile.xUrl} target="_blank" rel="noreferrer">
                    {profile.xUrl}
                  </a>
                </>
              ) : null}
            </p>
          ) : profile.xUrl ? (
            <p className="mt-1 text-sm text-ink-muted">
              <a className="text-primary hover:underline" href={profile.xUrl} target="_blank" rel="noreferrer">
                {profile.xUrl}
              </a>
            </p>
          ) : null}
          <div className="mt-1 flex items-center gap-2">
            <p className="text-sm text-ink-muted">{profile.headline || "Headline not available on the public page"}</p>
            <Origin value={origins.headline} />
          </div>
          {profile.currentCompany ? (
            <p className="mt-1 text-sm text-ink-muted">
              {[profile.currentRole, profile.currentCompany].filter(Boolean).join(" · ")}
            </p>
          ) : null}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-ink">{copy || "No about text on the public page."}</p>
        <Origin value={origins.about} />

        <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-ink-muted">Location</dt>
            <dd className="mt-0.5 text-ink">{profile.publicLocation || "—"}</dd>
            <Origin value={origins.location} />
          </div>
          <div>
            <dt className="text-xs font-medium text-ink-muted">Public followers</dt>
            <dd className="mt-0.5 text-ink">{profile.followerCountRaw || "Not on the public page"}</dd>
            <Origin value={origins.followers} />
          </div>
          {profile.education ? (
            <div>
              <dt className="text-xs font-medium text-ink-muted">Education</dt>
              <dd className="mt-0.5 text-ink">{profile.education}</dd>
              <Origin value={origins.education} />
            </div>
          ) : null}
        </dl>

        {insights ? (
          <div className="mt-6 space-y-3 border-t border-border pt-5 text-sm">
            <p className="page-kicker flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              AI from the source
            </p>
            {insights.positioning ? <p className="text-ink">{insights.positioning}</p> : null}
            <div className="flex flex-wrap gap-1.5">
              {insights.creatorCategory ? <Badge tone="primary">{insights.creatorCategory}</Badge> : null}
              {insights.audienceType ? <Badge>{insights.audienceType}</Badge> : null}
              {insights.expertise.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
            {profile.industries.length ? (
              <p className="text-ink-muted">Industries: {profile.industries.join(" · ")}</p>
            ) : null}
            {(insights.contentThemes?.length || profile.topics.length) ? (
              <p className="text-ink-muted">
                Topics: {(insights.contentThemes?.length ? insights.contentThemes : profile.topics).join(" · ")}
              </p>
            ) : null}
            {insights.campaignRecommendations?.length ? (
              <p className="text-ink-muted">Campaign fit: {insights.campaignRecommendations.join(" · ")}</p>
            ) : null}
            {pricing && (pricing.suggestedPrice || pricing.basis) ? (
              <p className="text-ink-muted">
                Pricing {pricing.confidence}:{" "}
                {pricing.suggestedPrice
                  ? `${pricing.currency} ${pricing.suggestedPrice} — ${pricing.basis}`
                  : pricing.basis || "Not enough public data to recommend a rate."}
              </p>
            ) : null}
            {insights.missing?.length ? (
              <p className="text-ink-subtle">Not on the public pages: {insights.missing.join(", ")}</p>
            ) : null}
          </div>
        ) : profile.ingestionStatus === "BLOCKED" ? (
          <p className="mt-6 text-sm text-ink-muted">
            Nothing usable came back from those public pages. You can still edit the card and continue.
          </p>
        ) : profile.enrichmentStatus === "SKIPPED" ? (
          <p className="mt-6 text-sm text-ink-muted">
            The card uses the public fields we extracted. AI enrichment is not configured.
          </p>
        ) : null}
      </div>
    </article>
  );
}
