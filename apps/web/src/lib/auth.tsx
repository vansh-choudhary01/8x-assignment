import type { UserRole } from "@naano/shared";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
};

export function homePath(user: AuthUser) {
  if (!user.role) return "/choose-role";
  return user.role === "CREATOR" ? "/creator" : "/brand";
}

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await api<{ user: AuthUser }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      logout: async () => {
        await api("/api/auth/logout", { method: "POST" });
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
