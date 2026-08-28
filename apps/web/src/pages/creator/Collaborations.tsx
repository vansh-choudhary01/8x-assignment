import { Handshake, Link2, MessageSquare, Send, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, WorkspaceShell } from "@/components/WorkspaceShell";
import { PageHeader } from "@/components/PageHeader";
import { Section } from "@/components/Section";
import { StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CollaborationStatus, FunnelEventType } from "@naano/shared";
import type { Collaboration } from "@/lib/types";

export function CollaborationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Collaboration[]>([]);
  useEffect(() => {
    void api<{ collaborations: Collaboration[] }>("/api/collaborations").then((d) => setItems(d.collaborations));
  }, []);
  const isCreator = user?.role === "CREATOR";
  return (
    <WorkspaceShell>
      <PageHeader kicker="Workspace" title="Collaborations" />
      <div className="mt-6">
        {!items.length ? (
          <EmptyState
            icon={Handshake}
            title="None yet"
            body={
              isCreator
                ? "Accepted applications and invites become collaborations with a status flow and messages."
                : "Accept an application or wait for a creator to accept your invite."
            }
            action={
              <Link to={isCreator ? "/creator/opportunities" : "/brand/campaigns"}>
                <Button>{isCreator ? "Browse opportunities" : "Open campaigns"}</Button>
              </Link>
            }
          />
        ) : (
          <div className="card">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={isCreator ? `/creator/collaborations/${item.id}` : `/brand/collaborations/${item.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-surface-hover"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{item.campaignTitle}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {item.brandName} · {item.creatorName} · {item.currency} {item.amount}
                      </p>
                    </div>
                    <StatusPill value={item.status} />
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

export function MessagesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Collaboration[]>([]);
  useEffect(() => {
    void api<{ collaborations: Collaboration[] }>("/api/collaborations").then((d) => setItems(d.collaborations));
  }, []);
  const base = user?.role === "CREATOR" ? "/creator/collaborations" : "/brand/collaborations";
  return (
    <WorkspaceShell>
      <PageHeader kicker="Workspace" title="Messages" description="Threads live on collaborations." />
      <div className="mt-6">
        {!items.length ? (
          <EmptyState
            icon={MessageSquare}
            title="No threads yet"
            body="A conversation is created when a collaboration starts."
            action={
              <Link to={user?.role === "CREATOR" ? "/creator/collaborations" : "/brand/collaborations"}>
                <Button variant="outline">View collaborations</Button>
              </Link>
            }
          />
        ) : (
          <div className="card">
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.id}>
                  <Link to={`${base}/${item.id}`} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-surface-hover">
                    <Avatar name={item.creatorName || item.brandName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{item.campaignTitle}</p>
                      <p className="truncate text-xs text-ink-muted">
                        {item.brandName} ↔ {item.creatorName} · {item.status.toLowerCase()}
                      </p>
                    </div>
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

type Message = { id: string; senderUserId: string; body: string; createdAt: string };

export function CollaborationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [item, setItem] = useState<Collaboration | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [contentUrl, setContentUrl] = useState("");
  const [contentNotes, setContentNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  async function load() {
    if (!id) return;
    const data = await api<{ collaboration: Collaboration }>(`/api/collaborations/${id}`);
    setItem(data.collaboration);
    const msgs = await api<{ messages: Message[] }>(`/api/collaborations/${id}/messages`);
    setMessages(msgs.messages);
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load collaboration"));
  }, [id]);

  async function send() {
    if (!body.trim()) return;
    try {
      await api(`/api/collaborations/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send");
    }
  }

  async function draftReply() {
    setError(null);
    setDrafting(true);
    try {
      const data = await api<{ draft: { body: string } }>("/api/ai/drafts/reply", {
        method: "POST",
        body: JSON.stringify({ collaborationId: id }),
      });
      setBody(data.draft.body);
    } catch (err) {
      setError(errorMessage(err, "Naano could not draft a reply"));
    } finally {
      setDrafting(false);
    }
  }

  async function transition(status: CollaborationStatus, extra: Record<string, string> = {}) {
    setError(null);
    try {
      await api(`/api/collaborations/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ status, ...extra }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update");
    }
  }

  const [revenueAmount, setRevenueAmount] = useState("");

  async function recordFunnel(type: FunnelEventType) {
    setError(null);
    try {
      const amount = type === "REVENUE" ? Number(revenueAmount) : undefined;
      if (type === "REVENUE" && (!revenueAmount || Number.isNaN(amount))) {
        setError("Enter the revenue amount that actually closed");
        return;
      }
      await api(`/api/collaborations/${id}/funnel`, {
        method: "POST",
        body: JSON.stringify({ type, amount }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record event");
    }
  }

  const isCreator = user?.role === "CREATOR";
  const back = isCreator ? "/creator/collaborations" : "/brand/collaborations";

  if (error && !item) {
    return (
      <WorkspaceShell>
        <Link to={back} className="text-sm text-ink-muted hover:text-ink">
          ← Back
        </Link>
        <p className="mt-6 text-sm text-danger">{error}</p>
      </WorkspaceShell>
    );
  }

  if (!item) {
    return (
      <WorkspaceShell>
        <p className="text-sm text-ink-muted">Loading…</p>
      </WorkspaceShell>
    );
  }

  const hasActions =
    (isCreator && (item.status === "ACCEPTED" || item.status === "APPROVED")) ||
    (!isCreator && (item.status === "CONTENT_SUBMITTED" || item.status === "ACCEPTED" || Boolean(item.trackingUrl)));

  return (
    <WorkspaceShell>
      <Link to={back} className="text-sm text-ink-muted hover:text-ink">
        ← Back
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="page-title text-2xl">{item.campaignTitle}</h1>
        <StatusPill value={item.status} />
      </div>
      <p className="mt-2 text-sm text-ink-muted">
        {item.brandName} · {item.creatorName} · {item.currency} {item.amount}
      </p>
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {item.contentUrl || item.publishedUrl || item.contentNotes || item.status === "CONTENT_SUBMITTED" ? (
            <Section title={item.status === "CONTENT_SUBMITTED" ? "Content waiting for review" : "Submitted content"}>
              <div className="space-y-3">
                {item.contentUrl ? (
                  <p className="text-sm">
                    <span className="text-ink-muted">Draft / content: </span>
                    <a className="break-all font-medium text-primary hover:underline" href={item.contentUrl} target="_blank" rel="noreferrer">
                      {item.contentUrl}
                    </a>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">No content URL was stored.</p>
                )}
                {item.contentNotes ? (
                  <p className="whitespace-pre-wrap rounded-lg bg-background px-3 py-2.5 text-sm leading-relaxed text-ink">{item.contentNotes}</p>
                ) : null}
                {item.publishedUrl ? (
                  <p className="text-sm">
                    <span className="text-ink-muted">Published post: </span>
                    <a className="break-all font-medium text-primary hover:underline" href={item.publishedUrl} target="_blank" rel="noreferrer">
                      {item.publishedUrl}
                    </a>
                  </p>
                ) : null}
              </div>
            </Section>
          ) : null}

          {hasActions ? (
            <Section title="Actions">
              <div className="flex flex-wrap gap-3">
                {isCreator && item.status === "ACCEPTED" ? (
                  <div className="flex w-full flex-col gap-2">
                    <Input
                      type="url"
                      required
                      placeholder="https://draft-or-content.example"
                      value={contentUrl}
                      onChange={(e) => setContentUrl(e.target.value)}
                    />
                    <Textarea
                      placeholder="Optional note for the brand (what to review, password, timestamp)"
                      value={contentNotes}
                      onChange={(e) => setContentNotes(e.target.value)}
                    />
                    <Button
                      className="self-start"
                      disabled={!contentUrl.startsWith("http")}
                      onClick={() =>
                        void transition("CONTENT_SUBMITTED", {
                          contentUrl,
                          ...(contentNotes.trim() ? { contentNotes: contentNotes.trim() } : {}),
                        })
                      }
                    >
                      Submit content
                    </Button>
                  </div>
                ) : null}
                {isCreator && item.status === "APPROVED" ? (
                  <div className="flex w-full flex-col gap-2">
                    <Input
                      type="url"
                      required
                      placeholder="https://www.linkedin.com/posts/…"
                      value={contentUrl}
                      onChange={(e) => setContentUrl(e.target.value)}
                    />
                    <Button className="self-start" disabled={!contentUrl.startsWith("http")} onClick={() => void transition("PUBLISHED", { publishedUrl: contentUrl })}>
                      Mark published
                    </Button>
                  </div>
                ) : null}
                {!isCreator && item.status === "CONTENT_SUBMITTED" ? (
                  <>
                    <Button onClick={() => void transition("APPROVED")}>Approve content</Button>
                    <Button variant="outline" onClick={() => void transition("CANCELLED")}>
                      Cancel
                    </Button>
                  </>
                ) : null}
                {!isCreator && item.status === "ACCEPTED" ? (
                  <Button variant="outline" onClick={() => void transition("CANCELLED")}>
                    Cancel
                  </Button>
                ) : null}
                {!isCreator && item.trackingUrl ? (
                  <>
                    {item.status === "PUBLISHED" ? <Button onClick={() => void transition("COMPLETED")}>Mark complete</Button> : null}
                    <Button variant="outline" onClick={() => void recordFunnel("LEAD")}>
                      Record lead
                    </Button>
                    <Button variant="outline" onClick={() => void recordFunnel("PIPELINE")}>
                      Record pipeline
                    </Button>
                    <div className="flex items-center gap-2">
                      <Input
                        className="w-28"
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Amount"
                        value={revenueAmount}
                        onChange={(e) => setRevenueAmount(e.target.value)}
                      />
                      <Button variant="outline" onClick={() => void recordFunnel("REVENUE")}>
                        Record revenue
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            </Section>
          ) : null}

          <Section
            title="Messages"
            action={
              <Button variant="soft" size="sm" disabled={drafting} onClick={() => void draftReply()}>
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                {drafting ? "Drafting…" : "Draft a reply"}
              </Button>
            }
            padded={false}
          >
            <div className="max-h-80 space-y-3 overflow-y-auto p-5">
              {!messages.length ? (
                <p className="text-sm text-ink-muted">No messages yet. Send the first one.</p>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={message.senderUserId === user?.id ? "ml-8" : "mr-8"}>
                    <div
                      className={
                        message.senderUserId === user?.id
                          ? "rounded-lg bg-primary-soft px-3 py-2 text-sm text-ink"
                          : "rounded-lg border border-border bg-background px-3 py-2 text-sm text-ink"
                      }
                    >
                      <span className="text-xs font-medium text-ink-subtle">{message.senderUserId === user?.id ? "You" : "Them"}</span>
                      <p className="mt-0.5">{message.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-border p-4">
              {body ? (
                <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  Drafted by Naano — edit before sending
                </p>
              ) : null}
              <div className="flex gap-2">
                <Textarea
                  className="min-h-[2.75rem] resize-none"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                />
                <Button size="icon" disabled={!body.trim()} onClick={() => void send()}>
                  <Send className="h-4 w-4" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          {item.trackingUrl ? (
            <div className="panel p-5">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" strokeWidth={2} />
                <p className="text-sm font-semibold text-ink">Tracking link</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                Put this in the LinkedIn post. Clicks are recorded and attributed to this creator, post, and
                campaign. It resolves to the campaign landing page — not back to the post itself.
              </p>
              <a className="mt-3 block break-all rounded-lg bg-surface px-3 py-2 text-xs font-medium text-primary" href={item.trackingUrl}>
                {item.trackingUrl}
              </a>
              {item.pixelUrl ? (
                <p className="mt-2 text-xs text-ink-subtle">
                  Optional pixel: <code className="break-all">{item.pixelUrl}</code>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="card p-5">
              <p className="text-sm text-ink-muted">
                A tracking link is issued when this collaboration opens, as soon as the campaign has a landing
                URL or the brand has a website. If you do not see one, add a landing URL on the campaign.
              </p>
            </div>
          )}
        </div>
      </div>
    </WorkspaceShell>
  );
}
