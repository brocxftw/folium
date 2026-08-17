import { NavLink, useNavigate } from "react-router-dom";
import {
  FileText,
  Inbox,
  Settings,
  LogOut,
  Leaf,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import { api } from "@/lib/api/client";
import {
  useSession,
  useLogout,
  useInboxCount,
  useTrashCount,
  useHealth,
} from "@/lib/api/hooks";
import { AiStatusPill } from "@/components/layout/AiStatusPill";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
  { to: "/documents", label: "Library", icon: FileText },
  { to: "/trash", label: "Trash", icon: Trash2, badge: "trash" as const },
];

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const logout = useLogout();
  const { data: inboxCount = 0 } = useInboxCount();
  const { data: trashCount } = useTrashCount();
  const { data: health } = useHealth();

  const appVersion = health?.version;

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen flex-col overflow-hidden">
        <header className="grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center overflow-x-auto border-b border-navbar-border bg-navbar px-5 text-navbar-text">
          <div className="flex items-center gap-2.5 justify-self-start">
            <Leaf className="h-5 w-5 shrink-0 text-navbar-accent" />
            <div className="min-w-0">
              <span className="block truncate text-lg font-semibold leading-tight tracking-tight text-navbar-text">
                Folium
              </span>
              {appVersion && (
                <p
                  className="truncate text-xs font-medium text-navbar-muted"
                  aria-label={`App version ${appVersion}`}
                >
                  v{appVersion}
                </p>
              )}
            </div>
          </div>

          <nav className="flex h-full items-stretch gap-7" aria-label="Primary">
            {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => {
              const badgeCount =
                badge === "inbox"
                  ? inboxCount
                  : badge === "trash"
                    ? (trashCount?.total ?? 0)
                    : 0;
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "relative flex h-full items-center text-navbar-text",
                      isActive &&
                        "after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:bg-navbar-accent",
                    )
                  }
                >
                  <span className="flex h-10 items-center gap-2 rounded-lg px-1.5 py-2 text-sm font-semibold hover:bg-navbar-hover">
                    <Icon className="h-4 w-4 shrink-0 opacity-90" />
                    <span>{label}</span>
                    {badgeCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-navbar-accent/20 px-1.5 text-[11px] font-medium text-navbar-accent">
                        {badgeCount > 99 ? "99+" : badgeCount}
                      </span>
                    )}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          <div className="flex items-center gap-3.5 justify-self-end">
            <AiStatusPill />

            <Tooltip>
              <TooltipTrigger asChild>
                <NavLink
                  to="/settings"
                  aria-label="Settings"
                  className="flex h-9 w-9 items-center justify-center rounded-[10px] text-navbar-text hover:bg-navbar-hover"
                >
                  <Settings className="h-[18px] w-[18px]" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="bottom">Settings</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-11 items-center gap-2.5 rounded-lg px-1 text-left hover:bg-navbar-hover"
                  aria-label="Account menu"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-navbar-hover text-xs font-medium">
                    {session?.user?.has_avatar ? (
                      <img
                        src={api.avatarUrl(session.user.id)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : session?.user ? (
                      getInitials(session.user.display_name)
                    ) : (
                      "?"
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navbar-text">
                      {session?.user.display_name ?? "User"}
                    </p>
                    <p className="truncate text-xs text-navbar-muted">
                      {session?.user.is_admin ? "Admin" : "User"}
                    </p>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-navbar-muted" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void handleLogout()}>
                  <LogOut className="h-3.5 w-3.5" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
