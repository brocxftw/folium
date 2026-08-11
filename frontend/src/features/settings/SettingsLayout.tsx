import { NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePasswordResetRequests, useSession } from "@/lib/api/hooks";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";

const SETTINGS_NAV = [
  { to: "/settings/profile", label: "Profile", adminOnly: false },
  { to: "/settings/artificial-intelligence", label: "Artificial Intelligence", adminOnly: true },
  { to: "/settings/library", label: "Library", adminOnly: false },
  { to: "/settings/system", label: "System", adminOnly: true },
  { to: "/settings/logs", label: "Logs", adminOnly: true },
  { to: "/settings/about", label: "About", adminOnly: false },
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
        <h1 className="text-base font-semibold text-text-primary mb-4">Settings</h1>
        <nav className="flex gap-1 overflow-x-auto md:block md:space-y-0.5" aria-label="Settings sections">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center justify-between gap-2 rounded-md px-3 py-2 text-[13px]",
                  isActive
                    ? "bg-accent-muted text-accent font-medium"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                )
              }
            >
              <span>{label}</span>
              {to === "/settings/profile" && pendingResets > 0 && (
                <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-medium text-accent">
                  {pendingResets}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </div>
    </div>
  );
}

export function ProfileSettingsPage() {
  return <ProfileSettings />;
}

export function UsersSettingsPage() {
  return <AdminSettingsGuard><UsersSettings /></AdminSettingsGuard>;
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
