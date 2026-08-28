import { BarChart3, IdCard, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { homePath, useAuth } from "@/lib/auth";

type Providers = {
  google: { configured: boolean };
};

const highlights = [
  { icon: Sparkles, text: "AI turns a real website or profile into intelligence you review before anything goes live." },
  { icon: IdCard, text: "Creator Cards and campaign briefs, always grounded in real, stored data." },
  { icon: BarChart3, text: "Clicks, leads, pipeline, and revenue — attributed back to the post that drove them." },
];

export function LoginPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const [providers, setProviders] = useState<Providers | null>(null);
  const [error, setError] = useState<string | null>(params.get("error"));

  useEffect(() => {
    void api<{ providers: Providers }>("/api/auth/providers")
      .then((data) => setProviders(data.providers))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load sign-in options"),
      );
  }, []);

  if (!loading && user) {
    return <Navigate to={homePath(user)} replace />;
  }

  const googleReady = Boolean(providers?.google.configured);

  return (
    <div className="flex min-h-svh bg-background text-ink">
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-to-br from-sky via-sky to-sky-strong lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
          <Logo />
          Naano
        </Link>
        <div className="max-w-sm">
          <p className="text-2xl font-semibold leading-snug tracking-tight text-ink">
            The creator marketplace built on real profiles, real intelligence, and real pipeline.
          </p>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/70 text-primary">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="text-sm leading-relaxed text-ink/80">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-ink/50">© {new Date().getFullYear()} Naano</p>
      </div>

      <div className="flex flex-1 flex-col justify-center px-4 py-16 sm:px-6 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-10 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink lg:hidden">
            <Logo />
            Naano
          </Link>
          <p className="page-kicker">Sign in</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Continue to Naano</h1>
          <p className="page-lead">One sign-in option, kept simple — no passwords to manage.</p>
          {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}

          <div className="card mt-8 space-y-3 p-6">
            <Button
              className="w-full rounded-full"
              size="lg"
              disabled={!googleReady}
              onClick={() => {
                window.location.href = "/api/auth/google";
              }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4">
                <path
                  fill="#4285F4"
                  d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.48c-.28 1.5-1.13 2.77-2.41 3.62v3.01h3.86c2.26-2.08 3.59-5.15 3.59-8.82Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.86-3.01c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.24v3.11C3.22 21.3 7.28 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.27 14.27a7.2 7.2 0 0 1-.38-2.27c0-.79.14-1.55.38-2.27V6.62H1.24A11.98 11.98 0 0 0 0 12c0 1.94.47 3.77 1.24 5.38l4.03-3.11Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.28 0 3.22 2.7 1.24 6.62l4.03 3.11c.95-2.85 3.6-4.98 6.73-4.98Z"
                />
              </svg>
              Continue with Google
            </Button>
            {providers && !googleReady ? (
              <p className="text-sm text-ink-muted">
                Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.
              </p>
            ) : null}
          </div>
          <p className="mt-6 text-xs leading-relaxed text-ink-subtle">
            New here? Signing in with Google creates your account — you&apos;ll choose brand or creator next.
          </p>
        </div>
      </div>
    </div>
  );
}
