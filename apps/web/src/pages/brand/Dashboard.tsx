import { Megaphone, Search, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState, StatCard, WorkspaceShell } from "@/components/WorkspaceShell";
import { AskNaanoButton } from "@/components/NaanoAsk";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { BrandProfile, Campaign, Collaboration } from "@/lib/types";

export function BrandDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<BrandProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ profile: BrandProfile | null }>("/api/brands/me"),
      api<{ campaigns: Campaign[] }>("/api/campaigns"),
      api<{ collaborations: Collaboration[] }>("/api/collaborations"),
    ])
      .then(([p, c, col]) => {
        setProfile(p.profile);
        setCampaigns(c.campaigns);
        setCollabs(col.collaborations);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load workspace"));
  }, []);

  const intel = profile?.intelligence;
  const openCollabs = collabs.filter((c) => !["COMPLETED", "CANCELLED"].includes(c.status));

  return (
    <WorkspaceShell>
      <PageHeader
        kicker="Workspace"
        title={profile?.companyName || user?.name}
        description={intel?.whatTheyDo || "Company intelligence from your website ingest will sit on this home once it exists."}
        actions={
          <>
            <Link to="/brand/creators">
              <Button variant="outline">
                <Search className="h-4 w-4" strokeWidth={2} />
                Find creators
              </Button>
            </Link>
            <Link to="/brand/campaigns/new">
              <Button>
                <Megaphone className="h-4 w-4" strokeWidth={2} />
                Create campaign
              </Button>
            </Link>
          </>
        }
      />
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pages stored" value={profile?.pageCount ?? 0} />
        <StatCard label="Campaigns" value={campaigns.length} />
        <StatCard label="Open collaborations" value={openCollabs.length} />
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Campaigns"
            action={
              <Link to="/brand/campaigns" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            }
            padded={!campaigns.length}
          >
            {!campaigns.length ? (
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                body="Create a campaign from your real brief, then match against creators who onboarded."
                action={
                  <Link to="/brand/campaigns/new">
                    <Button>Create campaign</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {campaigns.slice(0, 6).map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      to={`/brand/campaigns/${campaign.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{campaign.title}</p>
                        <p className="truncate text-xs text-ink-muted">{campaign.industry || "No industry set"}</p>
                      </div>
                      <StatusPill value={campaign.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Collaborations"
            action={
              <Link to="/brand/collaborations" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            }
            padded={!collabs.length}
          >
            {!collabs.length ? (
              <EmptyState
                icon={Users}
                title="No collaborations yet"
                body="Accept an application, or invite a creator from the directory, to start one."
                action={
                  <Link to="/brand/creators">
                    <Button variant="outline">Browse creators</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {collabs.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/brand/collaborations/${item.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.campaignTitle}</p>
                        <p className="truncate text-xs text-ink-muted">{item.creatorName}</p>
                      </div>
                      <StatusPill value={item.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <div className="panel p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
              <p className="text-sm font-semibold text-ink">Ask Naano</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Get help drafting a brief, finding creators, or understanding your funnel.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <AskNaanoButton prompt="Suggest a campaign we should run next based on our company intelligence." label="Suggest a campaign" />
              <AskNaanoButton prompt="Which creators in our marketplace best fit our company? Explain why." label="Recommend creators" />
            </div>
          </div>

          <Section title="Company intelligence" action={<Link to="/brand/onboarding" className="text-sm font-medium text-primary hover:underline">Edit</Link>}>
            {intel ? (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-ink-muted">Industry</p>
                  <p className="mt-0.5 text-ink">{intel.industry || "Not available"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted">ICP</p>
                  <p className="mt-0.5 text-ink">{intel.idealCustomerProfile || "Not available"}</p>
                </div>
                {intel.creatorCategories.length ? (
                  <div>
                    <p className="text-xs font-medium text-ink-muted">Creator types</p>
                    <p className="mt-0.5 text-ink">{intel.creatorCategories.join(", ")}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Add your website in onboarding so Naano can understand your company.
              </p>
            )}
          </Section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
