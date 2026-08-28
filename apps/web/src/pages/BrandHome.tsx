import { Globe, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AnalyzingStatus, StuckContinue } from "@/components/AnalyzingStatus";
import { AppShell } from "@/components/AppShell";
import { OnboardingSteps } from "@/components/OnboardingSteps";
import { StatusPill } from "@/components/StatusPill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import { isIngesting, useCompleteOnboarding, useIngestPolling } from "@/lib/onboarding";
import type { BrandProfile } from "@/lib/types";

export function BrandHomePage() {
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const { completing, complete } = useCompleteOnboarding("/api/brands/me/complete", "/brand", setError);

  async function load() {
    const data = await api<{ profile: BrandProfile | null }>("/api/brands/me");
    setProfile(data.profile);
    if (data.profile?.websiteUrl && !url) setUrl(data.profile.websiteUrl);
    if (data.profile?.companyName) setNameDraft(data.profile.companyName);
    return data.profile;
  }

  useEffect(() => {
    void load()
      .catch((err: unknown) => setError(errorMessage(err, "Could not load company profile")))
      .finally(() => setLoading(false));
  }, []);

  const ingesting = isIngesting(profile?.ingestionStatus);
  useIngestPolling(ingesting, () =>
    load().catch((err: unknown) => setError(errorMessage(err, "Could not load company profile"))),
  );

  async function analyze(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    setEditing(false);
    try {
      const data = await api<{ profile: BrandProfile }>("/api/brands/me", {
        method: "PUT",
        body: JSON.stringify({ websiteUrl: url, refetch: true }),
      });
      setProfile(data.profile);
    } catch (err) {
      setError(errorMessage(err, "Could not start analysis"));
    } finally {
      setSaving(false);
    }
  }

  const intel = profile?.intelligence;
  const ready = profile && !ingesting && (profile.ingestionStatus === "SUCCEEDED" || profile.ingestionStatus === "FAILED");
  const step = ingesting ? 1 : ready ? 2 : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <OnboardingSteps steps={["Add your website", "Naano reads your company", "Review & confirm"]} current={step} />

        <div className="mt-8">
          <p className="page-kicker">Brand onboarding</p>
          <h1 className="mt-2 page-title text-3xl">Naano reads your company</h1>
          <p className="page-lead">
            Paste the website. We crawl public pages and AI drafts ICP, products, value, and campaign
            ideas. You confirm — you do not fill a brief first.
          </p>
        </div>

        {loading ? <p className="mt-10 text-sm text-ink-muted">Loading…</p> : null}
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

        <form className="card mt-8 space-y-4 p-6" onSubmit={analyze}>
          <Field id="websiteUrl" label="Company website">
            <div className="relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" strokeWidth={2} />
              <Input
                id="websiteUrl"
                type="url"
                required
                className="pl-9"
                placeholder="https://yourcompany.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={ingesting}
              />
            </div>
          </Field>
          <Button type="submit" disabled={saving || ingesting}>
            <Sparkles className="h-4 w-4" strokeWidth={2} />
            {ingesting ? "Working…" : saving ? "Starting…" : profile ? "Analyze again" : "Understand my company"}
          </Button>
        </form>

        <div className="mt-6">
          {ingesting ? (
            <div className="space-y-4">
              <AnalyzingStatus kind="brand" stage={profile?.analysisStage} />
              <StuckContinue onContinue={complete} completing={completing} />
            </div>
          ) : null}
          {ready ? (
            <section className="card overflow-hidden">
              <div className="panel flex flex-wrap items-center justify-between gap-3 px-6 py-4">
                <p className="text-sm text-ink">Company pages were processed. Confirm to enter the workspace.</p>
                {!editing ? (
                  <Button size="sm" disabled={completing} onClick={complete}>
                    {completing ? "Opening workspace…" : profile.onboardingCompletedAt ? "Back to workspace" : "Looks right — go to workspace"}
                  </Button>
                ) : null}
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill value={profile.ingestionStatus} />
                  {profile.hasEmbedding ? <StatusPill value="embedded" /> : null}
                </div>
                <p className="mt-3 text-xs font-medium text-ink-subtle">
                  {profile.pageCount} page(s) stored from the public site
                </p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight text-ink">
                  {profile.companyName || intel?.industry || "Company"}
                </h2>
                <a className="mt-1 inline-block text-sm text-primary hover:underline" href={profile.websiteUrl}>
                  {profile.websiteUrl}
                </a>
                {intel ? (
                  <div className="mt-6 space-y-4 border-t border-border pt-5 text-sm leading-relaxed">
                    <p className="text-ink">{intel.whatTheyDo}</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-ink-muted">Industry</p>
                        <p className="mt-0.5 text-ink">{intel.industry || "Not supported by the pages we fetched."}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-muted">Audience</p>
                        <p className="mt-0.5 text-ink">{intel.targetAudience || "Not supported by the pages we fetched."}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-muted">ICP</p>
                        <p className="mt-0.5 text-ink">{intel.idealCustomerProfile || "Not supported by the pages we fetched."}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-ink-muted">Value proposition</p>
                        <p className="mt-0.5 text-ink">{intel.valueProposition || "Not supported by the pages we fetched."}</p>
                      </div>
                    </div>
                    {intel.productsServices.length ? (
                      <div>
                        <p className="text-xs font-medium text-ink-muted">Products</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {intel.productsServices.map((item) => (
                            <Badge key={item}>{item}</Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {(intel.campaignIdeas?.length || intel.campaignThemes.length) ? (
                      <div>
                        <p className="text-xs font-medium text-ink-muted">Campaign ideas</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(intel.campaignIdeas?.length ? intel.campaignIdeas : intel.campaignThemes).map((item) => (
                            <Badge key={item} tone="primary">
                              {item}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {intel.creatorCategories.length ? (
                      <p>
                        <span className="text-ink-muted">Creator types · </span>
                        {intel.creatorCategories.join(", ")}
                      </p>
                    ) : null}
                    {intel.creatorRequirements?.length ? (
                      <p>
                        <span className="text-ink-muted">Creator requirements · </span>
                        {intel.creatorRequirements.join(" · ")}
                      </p>
                    ) : null}
                    {intel.missing?.length ? (
                      <p className="text-warning">Not on the site: {intel.missing.join(", ")}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-ink-muted">
                    {profile.ingestionStatus === "FAILED"
                      ? profile.ingestionError || "The website could not be analyzed."
                      : "Pages were stored but AI intelligence is not available."}
                  </p>
                )}
                {profile.ingestionError && intel ? (
                  <p className="mt-4 text-sm text-warning">{profile.ingestionError}</p>
                ) : null}

                {editing ? (
                  <form
                    className="mt-8 space-y-3 border-t border-border pt-6"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void api<{ profile: BrandProfile }>("/api/brands/me", {
                        method: "PUT",
                        body: JSON.stringify({ websiteUrl: profile.websiteUrl, companyName: nameDraft, refetch: false }),
                      })
                        .then((data) => {
                          setProfile(data.profile);
                          setEditing(false);
                        })
                        .catch((err: unknown) => setError(errorMessage(err, "Could not save the company name")));
                    }}
                  >
                    <Field id="companyName" label="Company name">
                      <Input id="companyName" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} />
                    </Field>
                    <div className="flex gap-3">
                      <Button type="submit">Save</Button>
                      <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mt-8 flex flex-wrap gap-3 border-t border-border pt-6">
                    <Button disabled={completing} onClick={complete}>
                      {completing ? "Opening workspace…" : "Looks right — go to workspace"}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(true)}>
                      Fix the name
                    </Button>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
