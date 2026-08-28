import type { UserRole } from "@naano/shared";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { homePath, useAuth } from "@/lib/auth";

export function RequireAuth({
  role,
  pendingRoleOk,
  children,
}: {
  role?: UserRole;
  pendingRoleOk?: boolean;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background text-sm text-ink-muted">
        Loading…
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.role && !pendingRoleOk) {
    return <Navigate to="/choose-role" replace />;
  }

  if (role && user.role && user.role !== role) {
    return <Navigate to={homePath(user)} replace />;
  }

  return <>{children}</>;
}
