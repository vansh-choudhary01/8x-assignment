import { Compass, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import type { ApplicationStatus } from "@naano/shared";
import type { ApplicationListItem, Campaign } from "@/lib/types";
import { AskNaanoButton } from "@/components/NaanoAsk";

export function OpportunitiesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ campaigns: Campaign[] }>("/api/campaigns"),
      api<{ applications: ApplicationListItem[] }>("/api/applications/mine"),
    ])
      .then(([c, a]) => {
        setCampaigns(c.campaigns);
        setApplications(a.applications);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load opportunities"));
  }, []);

  const invites = applications.filter((item) => item.status === "INVITED");

  return (
    <WorkspaceShell>
      <PageHeader kicker="Opportunities" title="Open campaigns" />
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
      {invites.length ? (
        <div className="panel mt-6 p-5">
          <p className="text-sm font-semibold text-ink">Invites waiting on you</p>
          <ul className="mt-3 space-y-2">
            {invites.map((invite) => (
              <li key={invite.id}>
                <Link className="text-sm font-medium text-primary hover:underline" to={`/creator/opportunities/${invite.campaignId}`}>
                  {invite.campaignTitle || "Campaign"} — accept invite →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-6 space-y-3">
        {!campaigns.length ? (
          <EmptyState
            icon={Compass}
            title="No open campaigns"
            body="When a brand publishes a campaign, you can apply from this list. Invites also show here."
            action={
              <Link to="/creator">
                <Button variant="outline">Back to workspace</Button>
              </Link>
            }
          />
        ) : (
          campaigns.map((campaign) => {
            const mine = applications.find((item) => item.campaignId === campaign.id);
            return (
              <Link key={campaign.id} to={`/creator/opportunities/${campaign.id}`} className="card-hover block p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-ink-muted">
                    {campaign.brandName} · {campaign.industry}
                  </p>
                  {mine ? <span className="text-xs font-medium text-primary">{mine.status}</span> : null}
                </div>
                <h2 className="mt-1 text-[15px] font-semibold tracking-tight text-ink">{campaign.title}</h2>
                <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{campaign.description}</p>
              </Link>
            );
          })
        )}
      </div>
    </WorkspaceShell>
  );
}

export function OpportunityDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pitch, setPitch] = useState("");
  const [status, setStatus] = useState<ApplicationStatus | null>(null);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [collaborationId, setCollaborationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api<{ campaign: Campaign }>(`/api/campaigns/${id}`)
      .then((d) => setCampaign(d.campaign))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load campaign"));
    void api<{ applications: ApplicationListItem[] }>("/api/applications/mine")
      .then((d) => {
        const mine = d.applications.find((item) => item.campaignId === id);
        setStatus(mine?.status ?? null);
        setApplicationId(mine?.id ?? null);
        setCollaborationId(mine?.collaborationId ?? null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load applications"));
  }, [id]);

  const [drafting, setDrafting] = useState(false);

  async function draftPitch() {
    if (!id) return;
    setError(null);
    setDrafting(true);
    try {
      const data = await api<{ draft: { pitch: string; fitSummary?: string; applyRecommendation?: string; reasons?: string[] } }>(
        "/api/ai/drafts/application",
        { method: "POST", body: JSON.stringify({ campaignId: id }) },
      );
      setPitch(data.draft.pitch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft");
    } finally {
      setDrafting(false);
    }
  }

  async function apply() {
    setError(null);
    try {
      await api(`/api/applications/campaign/${id}`, {
        method: "POST",
        body: JSON.stringify({ pitch }),
      });
      setStatus("SUBMITTED");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply");
    }
  }

  if (error && !campaign) {
    return (
      <WorkspaceShell>
        <Link to="/creator/opportunities" className="text-sm text-ink-muted hover:text-ink">
          ← Opportunities
        </Link>
        <p className="mt-6 text-sm text-danger">{error}</p>
      </WorkspaceShell>
    );
  }

  if (!campaign) {
    return (
      <WorkspaceShell>
        <Link to="/creator/opportunities" className="text-sm text-ink-muted hover:text-ink">
          ← Opportunities
        </Link>
        <p className="mt-6 text-sm text-ink-muted">Loading campaign…</p>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <Link to="/creator/opportunities" className="text-sm text-ink-muted hover:text-ink">
        ← Opportunities
      </Link>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <h1 className="page-title text-2xl">{campaign.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {campaign.brandName} · {campaign.industry} · {campaign.platform}
            </p>
          </div>
          <p className="text-sm leading-relaxed text-ink">{campaign.description}</p>
        </div>
        <div className="card p-5">
          <p className="page-kicker">Brief</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-medium text-ink-muted">Goal</dt>
              <dd className="mt-0.5 text-ink">{campaign.goal || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-muted">Audience</dt>
              <dd className="mt-0.5 text-ink">{campaign.targetAudience || "—"}</dd>
            </div>
            {campaign.pricePerPost ? (
              <div>
                <dt className="text-xs font-medium text-ink-muted">Rate</dt>
                <dd className="mt-0.5 text-ink">
                  {campaign.currency} {campaign.pricePerPost}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      <div className="mt-6">
        {status === "INVITED" ? (
          <Section title="This brand invited you">
            <p className="text-sm text-ink-muted">Accept to open a collaboration and message thread.</p>
            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
            <Button
              className="mt-4"
              onClick={() => {
                if (!applicationId) return;
                setError(null);
                void api<{ collaboration: { id: string } }>(`/api/applications/${applicationId}/accept-invite`, {
                  method: "POST",
                })
                  .then((data) => navigate(`/creator/collaborations/${data.collaboration.id}`))
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not accept"));
              }}
            >
              Accept invitation
            </Button>
          </Section>
        ) : status ? (
          <Section title={`Application ${status.toLowerCase()}`}>
            {status === "ACCEPTED" ? (
              <Link
                to={collaborationId ? `/creator/collaborations/${collaborationId}` : "/creator/collaborations"}
                className="text-sm font-medium text-primary hover:underline"
              >
                Open collaboration →
              </Link>
            ) : (
              <p className="text-sm text-ink-muted">If the brand accepts, the work moves to Collaborations.</p>
            )}
          </Section>
        ) : (
          <Section title="Apply to this campaign">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={drafting} onClick={() => void draftPitch()}>
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                {drafting ? "Drafting…" : "Draft my application"}
              </Button>
              <AskNaanoButton prompt="Should I apply to this campaign? Use my stored card and this brief only, and explain the overlap." label="Should I apply?" />
            </div>
            <Textarea
              className="mt-3"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              placeholder="Why you fit this brief (at least 10 characters)"
            />
            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
            <Button className="mt-3" onClick={() => void apply()} disabled={pitch.trim().length < 10}>
              Apply
            </Button>
          </Section>
        )}
      </div>
    </WorkspaceShell>
  );
}
