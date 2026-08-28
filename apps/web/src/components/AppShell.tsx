import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { homePath, useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const home = user ? homePath(user) : "/";
  const onOnboarding = location.pathname.includes("/onboarding");

  return (
    <div className="min-h-svh bg-background text-ink">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Link
            to={user ? (onOnboarding ? location.pathname : home) : "/"}
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"
          >
            <Logo />
            Naano
          </Link>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-ink-muted sm:inline">{user.name}</span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  void logout().then(() => navigate("/"));
                }}
              >
                Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/login" className="text-sm text-ink-muted hover:text-ink">
                Sign in
              </Link>
              <Link to="/login">
                <Button size="sm" className="rounded-full px-4">
                  Get started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
