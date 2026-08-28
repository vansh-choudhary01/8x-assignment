import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";

function GateLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background text-sm text-ink-muted">
      Loading…
    </div>
  );
}

function ProfileGate({
  endpoint,
  redirect,
  children,
}: {
  endpoint: string;
  redirect: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void api<{ profile: { onboardingCompletedAt?: string | null } | null }>(endpoint)
      .then((data) => {
        setOnboarded(Boolean(data.profile?.onboardingCompletedAt));
        setFailed(false);
      })
      .catch(() => {
        setFailed(true);
      })
      .finally(() => setReady(true));
  }, [endpoint]);

  if (!ready) return <GateLoading />;
  if (failed) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-4 text-center">
        <p className="text-sm text-ink-muted">Could not load your workspace. Check that the API is running.</p>
        <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }
  if (!onboarded) return <Navigate to={redirect} replace />;
  return <>{children}</>;
}

export function CreatorGate({ children }: { children: ReactNode }) {
  return (
    <ProfileGate endpoint="/api/creators/me" redirect="/creator/onboarding">
      {children}
    </ProfileGate>
  );
}

export function BrandGate({ children }: { children: ReactNode }) {
  return (
    <ProfileGate endpoint="/api/brands/me" redirect="/brand/onboarding">
      {children}
    </ProfileGate>
  );
}
