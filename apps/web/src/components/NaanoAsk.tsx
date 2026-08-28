import { Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import type { AiActionStatus } from "@naano/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { askNaano, pageContextFromPath } from "@/lib/naano";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string; createdAt: string };
type PendingAction = {
  id: string;
  toolName: string;
  summary: string;
  status: AiActionStatus;
};

export function AskNaanoButton({ prompt, label }: { prompt: string; label?: string }) {
  return (
    <Button variant="soft" size="sm" onClick={() => askNaano(prompt)}>
      <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
      {label ?? "Ask Naano"}
    </Button>
  );
}

export function NaanoAsk() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const publicPage =
    location.pathname === "/" ||
    location.pathname === "/login" ||
    location.pathname === "/signup" ||
    location.pathname === "/choose-role";

  useEffect(() => {
    if (!user || publicPage) return;
    void api<{ available: boolean }>("/api/ai/status").then((d) => setAvailable(d.available));
    void api<{ messages: ChatMessage[]; pendingActions: PendingAction[] }>("/api/ai/conversation")
      .then((d) => {
        setMessages(d.messages);
        setPending(d.pendingActions);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load conversation"),
      );
  }, [user, publicPage]);

  useEffect(() => {
    if (open && bottom.current) {
      bottom.current.scrollIntoView({ block: "end" });
    }
  }, [open, messages, pending]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setBusy(true);
      setError(null);
      setDraft("");
      setMessages((current) => [
        ...current,
        { id: `local-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() },
      ]);
      try {
        const result = await api<{
          reply: string;
          pendingActions: PendingAction[];
        }>("/api/ai/turn", {
          method: "POST",
          body: JSON.stringify({ message, context: pageContextFromPath(location.pathname) }),
        });
        setMessages((current) => [
          ...current,
          { id: `asst-${Date.now()}`, role: "assistant", content: result.reply, createdAt: new Date().toISOString() },
        ]);
        setPending(result.pendingActions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Naano could not reply");
      } finally {
        setBusy(false);
      }
    },
    [busy, location.pathname],
  );

  useEffect(() => {
    function onAsk(event: Event) {
      const detail = (event as CustomEvent<{ prompt: string; autoSend?: boolean }>).detail;
      if (!detail?.prompt) return;
      setOpen(true);
      if (detail.autoSend === false) {
        setDraft(detail.prompt);
        return;
      }
      void send(detail.prompt);
    }
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("naano:ask", onAsk);
    window.addEventListener("naano:open", onOpen);
    return () => {
      window.removeEventListener("naano:ask", onAsk);
      window.removeEventListener("naano:open", onOpen);
    };
  }, [send]);

  async function confirm(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/ai/actions/${id}/confirm`, { method: "POST" });
      setPending((current) => current.filter((item) => item.id !== id));
      setMessages((current) => [
        ...current,
        { id: `done-${id}`, role: "assistant", content: "That action is saved.", createdAt: new Date().toISOString() },
      ]);
      window.dispatchEvent(new Event("naano:action-saved"));
      window.setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await api(`/api/ai/actions/${id}/cancel`, { method: "POST" });
    setPending((current) => current.filter((item) => item.id !== id));
  }

  if (!user || publicPage) return null;

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
      />
      <div
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full max-w-[26rem] flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Sparkles className="h-4 w-4" strokeWidth={2} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Ask Naano</p>
              <p className="text-xs text-ink-subtle">Tell it what you want done</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {available === false ? (
          <p className="border-b border-amber-100 bg-warning-soft px-5 py-3 text-xs text-warning">
            OPENAI_API_KEY is not set. Naano cannot reason yet. Stored data in the rest of the product is
            unchanged.
          </p>
        ) : null}
        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
          {!messages.length ? (
            <p className="text-ink-subtle">
              {user.role === "BRAND"
                ? "Try: find technical creators, draft a campaign, or explain the funnel."
                : "Try: should I apply, draft a pitch, or summarize earnings."}
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-6 rounded-lg bg-primary-soft px-3 py-2 text-ink"
                    : "mr-6 rounded-lg border border-border bg-background px-3 py-2 text-ink"
                }
              >
                <span className="text-xs font-medium text-ink-subtle">
                  {message.role === "user" ? "You" : "Naano"}
                </span>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            ))
          )}
          {pending.map((action) => (
            <div key={action.id} className="panel p-3">
              <p className="text-sm text-ink">{action.summary}</p>
              <p className="mt-1 text-xs text-ink-subtle">Nothing is saved until you confirm.</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={busy} onClick={() => void confirm(action.id)}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void cancel(action.id)}>
                  Cancel
                </Button>
              </div>
            </div>
          ))}
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {busy ? <p className="text-xs text-ink-subtle">Working…</p> : null}
          <div ref={bottom} />
        </div>
        <form
          className="flex gap-2 border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
        >
          <Textarea
            className="min-h-[2.75rem] resize-none"
            value={draft}
            placeholder="Tell Naano what you want done"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send(draft);
              }
            }}
          />
          <Button type="submit" size="icon" disabled={busy || !draft.trim() || available === false}>
            <Sparkles className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
