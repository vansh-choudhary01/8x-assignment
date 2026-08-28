import { Compass, Handshake, IdCard, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusPill } from "@/components/StatusPill";
import { EmptyState, WorkspaceShell } from "@/components/WorkspaceShell";
import { AskNaanoButton } from "@/components/NaanoAsk";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { ApplicationListItem, Collaboration, CreatorProfile } from "@/lib/types";

export function CreatorDashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [collabs, setCollabs] = useState<Collaboration[]>([]);
  const [invites, setInvites] = useState<{ id: string; campaignId: string; campaignTitle?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      api<{ profile: CreatorProfile | null }>("/api/creators/me"),
      api<{ collaborations: Collaboration[] }>("/api/collaborations"),
      api<{ applications: ApplicationListItem[] }>("/api/applications/mine"),
    ])
      .then(([p, c, a]) => {
        setProfile(p.profile);
        setCollabs(c.collaborations);
        setInvites(a.applications.filter((item) => item.status === "INVITED"));
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load workspace"));
  }, []);

  const openCollabs = collabs.filter((c) => !["COMPLETED", "CANCELLED"].includes(c.status));

  return (
    <WorkspaceShell>
      <PageHeader
        kicker="Workspace"
        title={`Hello, ${profile?.publicName || user?.name}`}
        description="Your card, applications, and collaborations."
        actions={
          <Link to="/creator/opportunities">
            <Button>
              <Compass className="h-4 w-4" strokeWidth={2} />
              Find campaigns
            </Button>
          </Link>
        }
      />
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      {invites.length ? (
        <div className="panel mt-6 p-5">
          <p className="text-sm font-semibold text-ink">Invites waiting on you</p>
          <ul className="mt-3 space-y-2">
            {invites.map((invite) => (
              <li key={invite.id}>
                <Link className="text-sm font-medium text-primary hover:underline" to={`/creator/opportunities/${invite.campaignId}`}>
                  {invite.campaignTitle || "Campaign"} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Link className="card-hover flex flex-col p-4" to="/creator/card">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <IdCard className="h-4 w-4" strokeWidth={2} />
          </div>
          <p className="mt-3 text-xs font-medium text-ink-muted">Your card</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-ink">{profile?.headline || "Finish your card"}</p>
          <p className="mt-1 text-xs text-ink-subtle">{profile?.ingestionStatus?.toLowerCase()}</p>
        </Link>
        <Link className="card-hover flex flex-col p-4" to="/creator/opportunities">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Compass className="h-4 w-4" strokeWidth={2} />
          </div>
          <p className="mt-3 text-xs font-medium text-ink-muted">Next</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-ink">Find campaigns</p>
          <p className="mt-1 text-xs text-ink-subtle">Apply to open campaigns.</p>
        </Link>
        <Link className="card-hover flex flex-col p-4" to="/creator/collaborations">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Handshake className="h-4 w-4" strokeWidth={2} />
          </div>
          <p className="mt-3 text-xs font-medium text-ink-muted">Active</p>
          <p className="mt-1 text-[15px] font-semibold tracking-tight text-ink">
            {openCollabs.length} collab{openCollabs.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-xs text-ink-subtle">{collabs.length} total</p>
        </Link>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Section
            title="Collaborations"
            action={
              <Link to="/creator/collaborations" className="text-sm font-medium text-primary hover:underline">
                View all
              </Link>
            }
            padded={!collabs.length}
          >
            {!collabs.length ? (
              <EmptyState
                icon={Handshake}
                title="No collaborations yet"
                body="When a brand accepts an application, the thread and status live here."
                action={
                  <Link to="/creator/opportunities">
                    <Button>Browse opportunities</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {collabs.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={`/creator/collaborations/${item.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-surface-hover"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">{item.campaignTitle}</p>
                        <p className="truncate text-xs text-ink-muted">{item.brandName}</p>
                      </div>
                      <StatusPill value={item.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <div className="panel p-5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} />
            <p className="text-sm font-semibold text-ink">Ask Naano</p>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Get help deciding what to apply to, or improving your card.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <AskNaanoButton prompt="Looking at my stored card, what should I improve to attract better campaigns?" label="Improve my card" />
            <AskNaanoButton prompt="Summarize my open collaborations and what I should do next on each." label="What should I do next?" />
          </div>
        </div>
      </div>
    </WorkspaceShell>
  );
}
