import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreatorCard } from "@/pages/CreatorHome";
import { PageHeader } from "@/components/PageHeader";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { CreatorProfile } from "@/lib/types";

export function CreatorCardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ profile: CreatorProfile | null }>("/api/creators/me")
      .then((d) => setProfile(d.profile))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load card"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <WorkspaceShell>
      <PageHeader
        kicker="My card"
        title="How brands see you"
        actions={
          <Link to="/creator/onboarding">
            <Button variant="outline">
              <Pencil className="h-4 w-4" strokeWidth={2} />
              Edit profile
            </Button>
          </Link>
        }
      />
      <div className="mt-7 max-w-2xl">
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {loading ? <p className="text-sm text-ink-muted">Loading card…</p> : <CreatorCard profile={profile} name={user?.name ?? ""} />}
      </div>
    </WorkspaceShell>
  );
}
