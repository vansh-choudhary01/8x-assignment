import { Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, ReasonList, WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Avatar } from "@/components/ui/avatar";
import { CreatorCard } from "@/pages/CreatorHome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Campaign, CreatorProfile } from "@/lib/types";

export function BrandCreatorsPage() {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<
    { creatorId: string; name: string; headline: string; score: number; reasons: string[] }[] | null
  >(null);

  useEffect(() => {
    void api<{ creators: CreatorProfile[] }>("/api/marketplace/creators")
      .then((d) => setCreators(d.creators))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load creators"));
  }, []);

  async function search() {
    setError(null);
    setSearching(true);
    try {
      const data = await api<{
        matches: { creatorId: string; name: string; headline: string; score: number; reasons: string[] }[];
        note?: string;
      }>("/api/ai/search/creators", {
        method: "POST",
        body: JSON.stringify({ query }),
      });
      setMatches(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not search");
    } finally {
      setSearching(false);
    }
  }

  return (
    <WorkspaceShell>
      <PageHeader kicker="Discovery" title="Creators" description="Creators who have saved a profile." />

      <form
        className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <div className="relative flex-1">
          <Sparkles className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" strokeWidth={2} />
          <Input
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask Naano: find developers who talk about AI infrastructure"
          />
        </div>
        <Button type="submit" disabled={searching || query.trim().length < 3}>
          {searching ? "Searching…" : "Search"}
        </Button>
        {matches ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setMatches(null);
              setQuery("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {matches ? (
        <div className="mt-6">
          <p className="page-kicker">AI search results</p>
          <div className="mt-3 space-y-3">
            {!matches.length ? (
              <p className="text-sm text-ink-muted">No stored cards overlapped this query.</p>
            ) : (
              matches.map((match) => (
                <Link key={match.creatorId} to={`/brand/creators/${match.creatorId}`} className="card-hover flex items-start gap-3 p-4">
                  <Avatar name={match.name} size="md" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-semibold tracking-tight text-ink">{match.name}</p>
                      <span className="text-xs font-medium text-ink-subtle">match {(match.score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-sm text-ink-muted">{match.headline}</p>
                    <ReasonList reasons={match.reasons} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="page-kicker">All creators</p>
        {!creators.length ? (
          <div className="mt-3">
            <EmptyState
              icon={Users}
              title="Marketplace is empty"
              body="Creators appear after they save a profile. You can still create a campaign while you wait."
              action={
                <Link to="/brand/campaigns/new">
                  <Button>Create campaign</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((creator) => (
              <Link key={creator.id} to={`/brand/creators/${creator.id}`} className="card-hover flex items-start gap-3 p-4">
                <Avatar name={creator.name} src={creator.publicImageUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-ink">{creator.name}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-ink-muted">{creator.headline || creator.publicTitle}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export function BrandCreatorDetailPage() {
  const { id } = useParams();
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void Promise.all([
      api<{ creator: CreatorProfile }>(`/api/marketplace/creators/${id}`),
      api<{ campaigns: Campaign[] }>("/api/campaigns"),
    ])
      .then(([c, camp]) => {
        setCreator(c.creator);
        setCampaigns(camp.campaigns);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load creator"))
      .finally(() => setLoading(false));
  }, [id]);

  if (error && !creator) {
    return (
      <WorkspaceShell>
        <Link to="/brand/creators" className="text-sm text-ink-muted hover:text-ink">
          ← Creators
        </Link>
        <p className="mt-6 text-sm text-danger">{error}</p>
      </WorkspaceShell>
    );
  }

  if (loading || !creator) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-ink-muted">Loading…</p>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <Link to="/brand/creators" className="text-sm text-ink-muted hover:text-ink">
        ← Creators
      </Link>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CreatorCard profile={creator} name={creator?.name ?? ""} />
        </div>
        <div>
          <Section title="Invite to a campaign">
            {!campaigns.length ? (
              <EmptyState
                title="No campaigns yet"
                body="Create a campaign first, then invite this creator from here or from the campaign page."
                action={
                  <Link to="/brand/campaigns/new">
                    <Button>Create campaign</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-2">
                {campaigns.map((campaign) => (
                  <li key={campaign.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-ink">{campaign.title}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!creator?.userId) return;
                        setError(null);
                        setMessage(null);
                        void api(`/api/applications/campaign/${campaign.id}/invite`, {
                          method: "POST",
                          body: JSON.stringify({ creatorUserId: creator.userId }),
                        })
                          .then(() => setMessage(`Invite sent for ${campaign.title}. The creator must accept it.`))
                          .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not invite"));
                      }}
                    >
                      Invite
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}
            {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
          </Section>
        </div>
      </div>
    </WorkspaceShell>
  );
}
