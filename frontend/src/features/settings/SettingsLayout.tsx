import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Archive,
  Info,
  Library,
  ScrollText,
  Server,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePasswordResetRequests, useSession } from "@/lib/api/hooks";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";

const SETTINGS_NAV: Array<{ to: string; label: string; adminOnly: boolean; icon: LucideIcon }> = [
  { to: "/settings/profile", label: "Profile", adminOnly: false, icon: User },
  { to: "/settings/library", label: "Library", adminOnly: false, icon: Library },
  { to: "/settings/artificial-intelligence", label: "Artificial Intelligence", adminOnly: true, icon: Sparkles },
  { to: "/settings/backup", label: "Backup & Restore", adminOnly: true, icon: Archive },
  { to: "/settings/system", label: "System", adminOnly: true, icon: Server },
  { to: "/settings/logs", label: "Logs", adminOnly: true, icon: ScrollText },
  { to: "/settings/about", label: "About", adminOnly: false, icon: Info },
];

export function SettingsLayout() {
  const { data: session } = useSession();
  const isAdmin = !!session?.user.is_admin;
  const { data: resetRequests = [] } = usePasswordResetRequests(isAdmin);
  const pendingResets = isAdmin ? resetRequests.length : 0;
  const nav = SETTINGS_NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-full min-w-0 flex-col md:flex-row">
      <aside className="shrink-0 border-b border-surface-border bg-surface p-3 md:w-56 md:border-b-0 md:border-r md:p-4">
        <h1 className="mb-4 text-base font-semibold text-text-primary">Settings</h1>
        <nav className="flex gap-1 overflow-x-auto md:block md:space-y-0.5" aria-label="Settings sections">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[13px]",
                  isActive
                    ? "bg-accent-muted font-medium text-accent"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn("h-4 w-4 shrink-0", isActive ? "text-accent" : "text-text-muted")}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {to === "/settings/profile" && pendingResets > 0 && (
                    <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      {pendingResets}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto bg-surface-muted p-4 sm:p-6 lg:p-8">
        <Outlet />
      </div>
    </div>
  );
}

export function ProfileSettingsPage() {
  return <ProfileSettings />;
}

export function UsersSettingsPage() {
  return (
    <AdminSettingsGuard>
      <UsersSettings />
    </AdminSettingsGuard>
  );
}

export function AdminSettingsGuard({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const location = useLocation();
  if (session && !session.user.is_admin) {
    return (
      <Navigate
        to="/settings/profile"
        replace
        state={{ notice: `Administrator access is required for ${location.pathname}.` }}
      />
    );
  }
  return <>{children}</>;
}
