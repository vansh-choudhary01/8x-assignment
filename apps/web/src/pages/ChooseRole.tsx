import type { UserRole } from "@naano/shared";
import { Megaphone, Users } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { homePath, useAuth, type AuthUser } from "@/lib/auth";
import { cn } from "@/lib/cn";

export function ChooseRolePage() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<UserRole | null>(null);

  if (user?.role) {
    return <Navigate to={homePath(user)} replace />;
  }

  async function choose(role: UserRole) {
    setError(null);
    setPending(role);
    try {
      await api<{ user: AuthUser }>("/api/auth/role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      await refresh();
      navigate(role === "CREATOR" ? "/creator/onboarding" : "/brand/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save role");
    } finally {
      setPending(null);
    }
  }

  const options: {
    role: UserRole;
    icon: typeof Users;
    tag: string;
    title: string;
    body: string;
  }[] = [
    {
      role: "CREATOR",
      icon: Users,
      tag: "Creator",
      title: "I publish as a creator",
      body: "Next we fetch public LinkedIn and/or X pages and draft a Creator Card for you to confirm.",
    },
    {
      role: "BRAND",
      icon: Megaphone,
      tag: "Brand",
      title: "I hire creators",
      body: "Next we read your public website and draft company intelligence for you to confirm.",
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
        <p className="page-kicker">Account</p>
        <h1 className="mt-2 page-title text-3xl">How are you joining?</h1>
        <p className="page-lead">
          This cannot be changed later.
          {user?.name ? ` Signed in as ${user.name}.` : ""}
        </p>
        {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {options.map(({ role, icon: Icon, tag, title, body }) => (
            <button
              key={role}
              type="button"
              disabled={Boolean(pending)}
              onClick={() => void choose(role)}
              className={cn(
                "card-hover flex flex-col items-start p-6 text-left disabled:opacity-50",
              )}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-primary">{tag}</p>
              <p className="mt-1.5 text-[15px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              <p className="mt-4 text-sm font-medium text-primary">
                {pending === role ? "Saving…" : `Continue as ${tag}`}
              </p>
            </button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
