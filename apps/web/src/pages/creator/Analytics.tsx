import { Activity, Link2, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, StatCard, WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { Funnel } from "@/components/Funnel";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { AnalyticsEventType, LedgerEntryType } from "@naano/shared";
import { AskNaanoButton } from "@/components/NaanoAsk";

type Payload = {
  summary: {
    totals: Partial<Record<AnalyticsEventType, number>>;
    recent: {
      id: string;
      type: AnalyticsEventType;
      createdAt: string;
      campaignId: string | null;
      creatorUserId: string | null;
      collaborationId: string | null;
      trackingLinkId: string | null;
      metadata: {
        postLabel?: string;
        source?: string;
        amount?: number;
        note?: string;
        applicationId?: string;
        title?: string;
        publishedUrl?: string;
        token?: string;
        destinationUrl?: string;
        userAgent?: string;
        messageId?: string;
        creatorProfileId?: string;
      };
    }[];
    trackingLinks: {
      id: string;
      clickUrl: string;
      destinationUrl: string;
      postLabel?: string;
      campaignId: string;
      creatorUserId: string;
    }[];
  };
  funnel: { clicks: number; leads: number; pipeline: number; revenue: number; linkCount: number };
  breakdown?: {
    byCreator: { creatorUserId: string; name?: string; clicks: number; leads: number; pipeline: number; revenue: number }[];
    byCampaign: { campaignId: string; title?: string; clicks: number; leads: number; pipeline: number; revenue: number }[];
    byCollaboration: {
      collaborationId: string;
      title?: string;
      postLabel?: string;
      clicks: number;
      leads: number;
      pipeline: number;
      revenue: number;
    }[];
  };
};

type FunnelRow = {
  key: string;
  label: string;
  clicks: number;
  leads: number;
  pipeline: number;
  revenue: number;
};

function BreakdownTable({ title, rows }: { title: string; rows: FunnelRow[] }) {
  if (!rows.length) return null;
  return (
    <Section title={title} padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-background/60">
              <th className="px-5 py-2.5 text-left text-xs font-medium text-ink-muted">Name</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-muted">Clicks</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-muted">Leads</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-ink-muted">Pipeline</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium text-ink-muted">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="px-5 py-2.5 text-ink">{row.label}</td>
                <td className="px-4 py-2.5 text-right text-ink-muted">{row.clicks}</td>
                <td className="px-4 py-2.5 text-right text-ink-muted">{row.leads}</td>
                <td className="px-4 py-2.5 text-right text-ink-muted">{row.pipeline}</td>
                <td className="px-5 py-2.5 text-right font-medium text-ink">{row.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void api<Payload>("/api/workspace/analytics")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load analytics"));
  }, []);

  if (error) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-danger">{error}</p>
      </WorkspaceShell>
    );
  }

  if (!data) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-ink-muted">Loading recorded events…</p>
      </WorkspaceShell>
    );
  }

  const empty = !data.summary.recent.length && data.funnel.clicks === 0 && data.funnel.leads === 0;

  return (
    <WorkspaceShell>
      <PageHeader
        kicker="Analytics"
        title="Performance"
        description="Click → lead → pipeline → revenue counts only events we stored, attributed to a creator, campaign, and post when those IDs exist."
        actions={
          <AskNaanoButton prompt="Explain my stored funnel. Which creators or campaigns produced clicks, leads, pipeline, or revenue? Where does it drop off? Use only recorded events — do not invent numbers." label="Explain my funnel" />
        }
      />

      {empty ? (
        <div className="mt-8">
          <EmptyState
            icon={Activity}
            title="No events yet"
            body="Profile views, applications, messages, tracking-link clicks, and funnel records appear here after they happen. Funnel numbers stay at zero until a tracking link is clicked or a lead is recorded."
            action={
              <Link to={user?.role === "BRAND" ? "/brand/collaborations" : "/creator/collaborations"}>
                <Button>Open collaborations</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-7">
            <Funnel
              stages={[
                { label: "Clicks", value: data.funnel.clicks },
                { label: "Leads", value: data.funnel.leads },
                { label: "Pipeline", value: data.funnel.pipeline },
                { label: "Revenue", value: data.funnel.revenue },
              ]}
            />
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <BreakdownTable
                title="By creator"
                rows={(data.breakdown?.byCreator ?? []).map((row) => ({
                  key: row.creatorUserId,
                  label: row.name || row.creatorUserId,
                  ...row,
                }))}
              />
              <BreakdownTable
                title="By campaign"
                rows={(data.breakdown?.byCampaign ?? []).map((row) => ({
                  key: row.campaignId,
                  label: row.title || row.campaignId,
                  ...row,
                }))}
              />
              <BreakdownTable
                title="By collaboration / post"
                rows={(data.breakdown?.byCollaboration ?? []).map((row) => ({
                  key: row.collaborationId,
                  label: `${row.title || row.collaborationId}${row.postLabel ? ` · ${row.postLabel}` : ""}`,
                  ...row,
                }))}
              />
              {!data.breakdown?.byCreator.length && !data.breakdown?.byCampaign.length && !data.breakdown?.byCollaboration.length ? (
                <div className="card p-5">
                  <p className="text-sm text-ink-muted">No attributed breakdown yet — clicks and funnel events will group here once recorded.</p>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              {data.summary.trackingLinks?.length ? (
                <Section title="Tracking links" padded={false}>
                  <ul className="divide-y divide-border">
                    {data.summary.trackingLinks.map((link) => (
                      <li key={link.id} className="p-4">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Link2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                          <a className="truncate text-xs font-medium" href={link.clickUrl}>
                            {link.clickUrl}
                          </a>
                        </div>
                        <p className="mt-1 truncate text-xs text-ink-muted">
                          → {link.destinationUrl}
                          {link.postLabel ? ` · ${link.postLabel}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Section>
              ) : null}

              <Section title="Recent activity" padded={false}>
                <ul className="max-h-96 divide-y divide-border overflow-y-auto">
                  {data.summary.recent.map((event) => (
                    <li key={event.id} className="flex items-start gap-2.5 px-4 py-3">
                      <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-subtle" strokeWidth={2} />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink">{event.type.toLowerCase().replaceAll("_", " ")}</p>
                        <p className="mt-0.5 text-[11px] text-ink-subtle">
                          {new Date(event.createdAt).toLocaleString()}
                          {typeof event.metadata.postLabel === "string" ? ` · ${event.metadata.postLabel}` : ""}
                          {typeof event.metadata.source === "string" ? ` · ${event.metadata.source}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Section>

              {Object.keys(data.summary.totals).length ? (
                <div className="card p-4">
                  <p className="text-xs font-medium text-ink-muted">Recorded types</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-subtle">
                    {Object.entries(data.summary.totals)
                      .map(([type, count]) => `${type} (${count})`)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </WorkspaceShell>
  );
}

type EarningsPayload = {
  pending: number;
  earned: number;
  voided: number;
  currency: string;
  entries: { id: string; type: LedgerEntryType; amount: number; note: string; createdAt: string }[];
};

export function EarningsPage() {
  const [data, setData] = useState<EarningsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<EarningsPayload>("/api/workspace/earnings")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load earnings"));
  }, []);

  if (error) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-danger">{error}</p>
      </WorkspaceShell>
    );
  }

  if (!data) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-ink-muted">Loading ledger…</p>
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell>
      <PageHeader
        kicker="Workspace"
        title="Earnings"
        description="Internal ledger from collaborations. No payment provider."
        actions={<AskNaanoButton prompt="Summarize my stored earnings and collaborations. Do not invent payouts." label="Summarize earnings" />}
      />
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Pending" value={`${data.currency} ${data.pending}`} />
        <StatCard icon={Wallet} label="Earned" value={`${data.currency} ${data.earned}`} />
        <StatCard icon={Wallet} label="Voided" value={`${data.currency} ${data.voided}`} />
      </div>
      <div className="mt-7">
        {!data.entries.length ? (
          <EmptyState
            icon={Wallet}
            title="No ledger entries"
            body="Accepting a collaboration writes a pending amount. Completing it writes earned."
            action={
              <Link to="/creator/opportunities">
                <Button>Find a campaign</Button>
              </Link>
            }
          />
        ) : (
          <div className="card">
            <ul className="divide-y divide-border">
              {data.entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{entry.type.toLowerCase().replaceAll("_", " ")}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">{entry.note}</p>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {data.currency} {entry.amount}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}
