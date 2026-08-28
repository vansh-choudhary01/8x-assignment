import { LogOut, Menu, Sparkles, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Compass,
  Handshake,
  IdCard,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Users,
  Wallet,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";

const creatorLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/creator", label: "Home", icon: LayoutDashboard },
  { to: "/creator/card", label: "My card", icon: IdCard },
  { to: "/creator/opportunities", label: "Opportunities", icon: Compass },
  { to: "/creator/collaborations", label: "Collaborations", icon: Handshake },
  { to: "/creator/messages", label: "Messages", icon: MessageSquare },
  { to: "/creator/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/creator/earnings", label: "Earnings", icon: Wallet },
];

const brandLinks: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/brand", label: "Home", icon: LayoutDashboard },
  { to: "/brand/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/brand/creators", label: "Creators", icon: Users },
  { to: "/brand/collaborations", label: "Collaborations", icon: Handshake },
  { to: "/brand/messages", label: "Messages", icon: MessageSquare },
  { to: "/brand/analytics", label: "Analytics", icon: BarChart3 },
];

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();
  const links = user?.role === "CREATOR" ? creatorLinks : brandLinks;
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/creator" || to === "/brand"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-muted transition-colors hover:bg-black/[0.03] hover:text-ink",
              isActive && "bg-primary-soft font-medium text-primary hover:bg-primary-soft",
            )
          }
        >
          <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2.5 border-t border-border px-3 py-3">
      <Avatar name={user?.name ?? "?"} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{user?.name}</p>
        <p className="truncate text-xs text-ink-subtle">{user?.role === "CREATOR" ? "Creator" : "Brand"}</p>
      </div>
      <button
        type="button"
        title="Log out"
        aria-label="Log out"
        onClick={() => {
          void logout().then(() => navigate("/"));
        }}
        className="focus-ring flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-black/[0.04] hover:text-ink"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const home = user?.role === "CREATOR" ? "/creator" : "/brand";

  return (
    <div className="flex min-h-svh bg-background text-ink">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface lg:sticky lg:top-0 lg:flex lg:h-svh">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <Link to={home} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
            <Logo />
            Naano
          </Link>
        </div>
        <SidebarNav />
        <SidebarFooter />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-border px-5">
              <Link
                to={home}
                className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"
                onClick={() => setMobileOpen(false)}
              >
                <Logo />
                Naano
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link to={home} className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink lg:hidden">
            <Logo />
            Naano
          </Link>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("naano:open"))}
            className="focus-ring flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft px-3 py-1.5 text-[13px] font-medium text-primary transition-colors hover:border-primary/35 hover:bg-primary-soft-strong"
          >
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
            Ask Naano
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-7 sm:px-6 sm:py-8 lg:px-8 lg:py-9">
          {children}
        </main>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon: Icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong bg-surface/60 px-8 py-10 text-center">
      {Icon ? (
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </div>
      ) : null}
      <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-ink-subtle" strokeWidth={2} /> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
    </div>
  );
}

export function ReasonList({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm text-ink-muted">
      {reasons.map((reason) => (
        <li key={reason} className="flex gap-2">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
          <span>{reason}</span>
        </li>
      ))}
    </ul>
  );
}
