import { NavLink, Navigate, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/api/hooks";
import { StorageSettings } from "@/components/settings/StorageSettings";
import { AIProvidersSettings } from "@/components/settings/AIProvidersSettings";
import { AIPolicySettings } from "@/components/settings/AIPolicySettings";
import { AIProfilesSettings } from "@/components/settings/AIProfilesSettings";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { UsersSettings } from "@/components/settings/UsersSettings";

const SETTINGS_NAV = [
  { to: "/settings/profile", label: "Profile", adminOnly: false },
  { to: "/settings/users", label: "Users", adminOnly: true },
  { to: "/settings/storage", label: "Storage", adminOnly: true },
  { to: "/settings/ai-providers", label: "AI Providers", adminOnly: true },
  { to: "/settings/ai-policy", label: "AI Policy", adminOnly: true },
  { to: "/settings/ai-profiles", label: "AI Profiles", adminOnly: true },
  { to: "/settings/system", label: "System", adminOnly: true },
];

export function SettingsLayout() {
  const { data: session } = useSession();
  const isAdmin = !!session?.user.is_admin;
  const nav = SETTINGS_NAV.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className="flex h-full">
      <aside className="w-48 shrink-0 border-r border-surface-border bg-surface p-4">
        <h1 className="text-base font-semibold text-text-primary mb-4">Settings</h1>
        <nav className="space-y-0.5">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "block rounded-md px-3 py-2 text-[13px]",
                  isActive
                    ? "bg-accent-muted text-accent font-medium"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 overflow-auto p-6">
        <Outlet />
      </div>
    </div>
  );
}

export function ProfileSettingsPage() {
  return <ProfileSettings />;
}

export function UsersSettingsPage() {
  const { data: session } = useSession();
  if (session && !session.user.is_admin) {
    return <Navigate to="/settings/profile" replace />;
  }
  return <UsersSettings />;
}

export function StorageSettingsPage() {
  const { data: session } = useSession();
  if (session && !session.user.is_admin) {
    return <Navigate to="/settings/profile" replace />;
  }
  return <StorageSettings />;
}

export function AIProvidersSettingsPage() {
  const { data: session } = useSession();
  if (session && !session.user.is_admin) {
    return <Navigate to="/settings/profile" replace />;
  }
  return <AIProvidersSettings />;
}

export function AIPolicySettingsPage() {
  const { data: session } = useSession();
  if (session && !session.user.is_admin) {
    return <Navigate to="/settings/profile" replace />;
  }
  return <AIPolicySettings />;
}

export function AIProfilesSettingsPage() {
  const { data: session } = useSession();
  if (session && !session.user.is_admin) {
    return <Navigate to="/settings/profile" replace />;
  }
  return <AIProfilesSettings />;
}

export function SystemSettingsPage() {
  const { data: session } = useSession();
  if (session && !session.user.is_admin) {
    return <Navigate to="/settings/profile" replace />;
  }
  return <SystemSettings />;
}
