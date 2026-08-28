import { Megaphone, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, ReasonList, WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { ApplicationStatus } from "@naano/shared";
import type { Campaign } from "@/lib/types";
import { AskNaanoButton } from "@/components/NaanoAsk";

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api<{ campaigns: Campaign[] }>("/api/campaigns")
      .then((d) => setCampaigns(d.campaigns))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load campaigns"));
  }, []);
  return (
    <WorkspaceShell>
      <PageHeader
        kicker="Campaigns"
        title="All campaigns"
        actions={
          <Link to="/brand/campaigns/new">
            <Button>New campaign</Button>
          </Link>
        }
      />
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      <div className="mt-6">
        {!campaigns.length ? (
          <EmptyState
            icon={Megaphone}
            title="None yet"
            body="A campaign is a stored brief with budget and status. Create one to start matching creators."
            action={
              <Link to="/brand/campaigns/new">
                <Button>New campaign</Button>
              </Link>
            }
          />
        ) : (
          <div className="card">
            <ul className="divide-y divide-border">
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <Link
                    to={`/brand/campaigns/${campaign.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{campaign.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">{campaign.industry || "No industry set"}</p>
                    </div>
                    <StatusPill value={campaign.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export function CampaignNewPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [intent, setIntent] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [industry, setIndustry] = useState("");
  const [pricePerPost, setPricePerPost] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [requirements, setRequirements] = useState("");
  const [landingUrl, setLandingUrl] = useState("");

  async function draftBrief() {
    setError(null);
    setDrafting(true);
    try {
      const data = await api<{
        draft: {
          title: string;
          description: string;
          goal: string;
          targetAudience: string;
          industry: string;
          pricePerPost?: number;
          deliverables?: string[] | string;
          requirements?: string;
        };
      }>("/api/ai/drafts/campaign", {
        method: "POST",
        body: JSON.stringify({ intent }),
      });
      const draft = data.draft;
      setTitle(draft.title ?? "");
      setDescription(draft.description ?? "");
      setGoal(draft.goal ?? "");
      setTargetAudience(draft.targetAudience ?? "");
      setIndustry(draft.industry ?? "");
      setPricePerPost(draft.pricePerPost ? String(draft.pricePerPost) : "");
      setDeliverables(Array.isArray(draft.deliverables) ? draft.deliverables.join(", ") : draft.deliverables ?? "");
      setRequirements(draft.requirements ?? "");
      setDrafted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft");
    } finally {
      setDrafting(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const data = await api<{ campaign: Campaign }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          goal,
          targetAudience,
          industry,
          pricePerPost,
          deliverables,
          requirements,
          landingUrl,
        }),
      });
      navigate(`/brand/campaigns/${data.campaign.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create");
    }
  }

  return (
    <WorkspaceShell>
      <Link to="/brand/campaigns" className="text-sm text-ink-muted hover:text-ink">
        ← Campaigns
      </Link>
      <PageHeader
        className="mt-4"
        kicker="New campaign"
        title="Create a campaign"
        description="Tell Naano the goal and it drafts the full brief from your company intelligence. You review everything before it publishes."
      />

      <div className="panel mt-6 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
          <p className="text-sm font-semibold text-ink">Start with your intent</p>
        </div>
        <p className="mt-1.5 text-sm text-ink-muted">
          Describe the campaign in a sentence. Naano fills the brief below — you still publish.
        </p>
        <Textarea
          className="mt-3 bg-surface"
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="Create a campaign for our new developer API. We want technical creators."
        />
        <Button className="mt-3" disabled={drafting || intent.trim().length < 8} onClick={() => void draftBrief()}>
          <Sparkles className="h-4 w-4" strokeWidth={2} />
          {drafting ? "Drafting…" : "Draft the brief"}
        </Button>
      </div>

      <form className="mt-6 grid gap-6 lg:grid-cols-3" onSubmit={onSubmit}>
        <div className="space-y-6 lg:col-span-2">
          <Section title="The brief" description={drafted ? "Drafted by Naano — edit anything that looks off." : undefined}>
            <div className="space-y-4">
              <Field id="title" label="Title">
                <Input id="title" name="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field id="description" label="Description">
                <Textarea id="description" name="description" required value={description} onChange={(e) => setDescription(e.target.value)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="goal" label="Goal">
                  <Input id="goal" name="goal" required value={goal} onChange={(e) => setGoal(e.target.value)} />
                </Field>
                <Field id="industry" label="Industry">
                  <Input id="industry" name="industry" required value={industry} onChange={(e) => setIndustry(e.target.value)} />
                </Field>
              </div>
              <Field id="targetAudience" label="Target audience">
                <Input id="targetAudience" name="targetAudience" required value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section title="Requirements & deliverables">
            <div className="space-y-4">
              <Field id="deliverables" label="Deliverables" optional hint={<p className="text-xs text-ink-subtle">Comma-separated, e.g. "1 LinkedIn post, 1 story"</p>}>
                <Input id="deliverables" name="deliverables" value={deliverables} onChange={(e) => setDeliverables(e.target.value)} />
              </Field>
              <Field id="requirements" label="Requirements" optional>
                <Textarea id="requirements" name="requirements" value={requirements} onChange={(e) => setRequirements(e.target.value)} />
              </Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Commercial">
            <div className="space-y-4">
              <Field id="pricePerPost" label="Price per post" optional>
                <Input id="pricePerPost" name="pricePerPost" type="number" value={pricePerPost} onChange={(e) => setPricePerPost(e.target.value)} />
              </Field>
              <Field
                id="landingUrl"
                label="Landing page for tracking clicks"
                optional
                hint={<p className="text-xs text-ink-subtle">Clicks on the creator's tracking link go here. If empty, we use your company website.</p>}
              >
                <Input
                  id="landingUrl"
                  name="landingUrl"
                  type="url"
                  placeholder="https://yourcompany.com/offer"
                  value={landingUrl}
                  onChange={(e) => setLandingUrl(e.target.value)}
                />
              </Field>
            </div>
          </Section>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full" size="lg">
            Publish campaign
          </Button>
        </div>
      </form>
    </WorkspaceShell>
  );
}

type Match = {
  creatorId: string;
  userId: string;
  name: string;
  headline: string;
  score: number;
  reasons: string[];
};

type Application = {
  id: string;
  creatorUserId: string;
  creatorName: string;
  pitch: string;
  status: ApplicationStatus;
  collaborationId?: string | null;
};

export function CampaignDetailPage() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function load() {
    if (!id) return;
    const c = await api<{ campaign: Campaign }>(`/api/campaigns/${id}`);
    setCampaign(c.campaign);
    const m = await api<{ matches: Match[] }>(`/api/campaigns/${id}/matches`);
    setMatches(m.matches);
    const a = await api<{ applications: Application[] }>(`/api/applications/campaign/${id}`);
    setApps(a.applications);
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load campaign"));
  }, [id]);

  if (error && !campaign) {
    return (
      <WorkspaceShell>
        <Link to="/brand/campaigns" className="text-sm text-ink-muted hover:text-ink">
          ← Campaigns
        </Link>
        <p className="mt-6 text-sm text-danger">{error}</p>
      </WorkspaceShell>
    );
  }

  if (!campaign) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-ink-muted">Loading…</p>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <Link to="/brand/campaigns" className="text-sm text-ink-muted hover:text-ink">
        ← Campaigns
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="page-title text-2xl">{campaign.title}</h1>
        <StatusPill value={campaign.status} />
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">{campaign.description}</p>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Applications"
            action={<AskNaanoButton prompt="Review the applications on this campaign. Suggest who to accept or reject using only the stored pitches and creator cards, and explain why." label="Review" />}
            padded={!apps.length}
          >
            {!apps.length ? (
              <p className="p-5 text-sm text-ink-muted">No applications yet. Invite a matched creator to the right.</p>
            ) : (
              <ul className="divide-y divide-border">
                {apps.map((application) => (
                  <li key={application.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Avatar name={application.creatorName} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-ink">{application.creatorName}</p>
                          <p className="mt-1 text-sm text-ink-muted">{application.pitch}</p>
                        </div>
                      </div>
                      <StatusPill value={application.status} />
                    </div>
                    {application.status === "SUBMITTED" ? (
                      <div className="mt-3 flex gap-2 pl-11">
                        <Button
                          size="sm"
                          onClick={() => {
                            setError(null);
                            void api<{ collaboration: { id: string } }>(`/api/applications/${application.id}/accept`, {
                              method: "POST",
                            })
                              .then((data) => navigate(`/brand/collaborations/${data.collaboration.id}`))
                              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not accept"));
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void api(`/api/applications/${application.id}/reject`, { method: "POST" }).then(load)}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                    {application.status === "INVITED" ? (
                      <p className="mt-2 pl-11 text-sm text-ink-muted">Waiting for the creator to accept this invite.</p>
                    ) : null}
                    {application.status === "ACCEPTED" ? (
                      <Link
                        to={application.collaborationId ? `/brand/collaborations/${application.collaborationId}` : "/brand/collaborations"}
                        className="mt-2 inline-block pl-11 text-sm font-medium text-primary hover:underline"
                      >
                        Open collaboration →
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title="Matched creators"
            description="Ranked from stored profiles. Reasons listed, not a black box."
            action={<AskNaanoButton prompt="Who should we invite for this campaign, and why? Use stored matches and cards only." label="Ask" />}
            padded={!matches.length}
          >
            {!matches.length ? (
              <EmptyState
                title="No creators in the marketplace yet"
                body="When creators finish onboarding, they appear here."
                action={
                  <Link to="/brand/creators">
                    <Button variant="outline">Open creator directory</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {matches.map((match) => (
                  <li key={match.creatorId} className="p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={match.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <Link to={`/brand/creators/${match.creatorId}`} className="truncate text-sm font-semibold text-ink hover:text-primary">
                            {match.name}
                          </Link>
                          <span className="shrink-0 text-xs font-medium text-ink-subtle">{(match.score * 100).toFixed(0)}%</span>
                        </div>
                        <p className="mt-0.5 text-sm text-ink-muted">{match.headline}</p>
                        <ReasonList reasons={match.reasons} />
                        <Button
                          className="mt-3"
                          size="sm"
                          variant="outline"
                          disabled={apps.some((item) => item.creatorUserId === match.userId && item.status !== "REJECTED")}
                          onClick={() => {
                            setError(null);
                            void api(`/api/applications/campaign/${id}/invite`, {
                              method: "POST",
                              body: JSON.stringify({ creatorUserId: match.userId }),
                            })
                              .then(() => load())
                              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not invite"));
                          }}
                        >
                          {apps.some((item) => item.creatorUserId === match.userId && item.status === "INVITED")
                            ? "Invited"
                            : apps.some((item) => item.creatorUserId === match.userId)
                              ? "Already in play"
                              : "Invite"}
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
