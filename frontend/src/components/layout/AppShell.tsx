import { NavLink, useNavigate } from "react-router-dom";
import {
  FileText,
  Inbox,
  Search,
  Sparkles,
  Settings,
  LogOut,
  Leaf,
  ListTodo,
  ChevronLeft,
  ChevronRight,
  Trash2,
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
import { usePersistedState } from "@/lib/usePersistedState";
import { SidebarAiPipeline } from "@/components/layout/SidebarAiPipeline";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/Tooltip";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { to: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" as const },
  { to: "/documents", label: "Documents", icon: FileText },
  { to: "/search", label: "Search", icon: Search },
  { to: "/ask", label: "Ask", icon: Sparkles },
  { to: "/jobs", label: "Jobs", icon: ListTodo },
  { to: "/trash", label: "Trash", icon: Trash2, badge: "trash" as const },
];

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const logout = useLogout();
  const { data: inboxCount = 0 } = useInboxCount();
  const { data: trashCount } = useTrashCount();
  const { data: health } = useHealth();
  const [sidebarOpen, setSidebarOpen] = usePersistedState("folium.sidebarOpen", true);

  const appVersion = health?.version;

  const handleLogout = async () => {
    await logout.mutateAsync();
    navigate("/login");
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="flex h-screen overflow-hidden">
        <aside
          className={cn(
            "flex shrink-0 flex-col bg-sidebar text-sidebar-text border-r border-sidebar-border transition-[width] duration-200",
            sidebarOpen ? "w-[220px]" : "w-[56px]",
          )}
        >
          <div
            className={cn(
              "flex items-center border-b border-sidebar-border",
              sidebarOpen ? "gap-2 px-4 py-3" : "flex-col gap-2 px-2 py-3",
            )}
          >
            <div
              className={cn(
                "flex min-w-0 items-center gap-2",
                !sidebarOpen && "justify-center",
              )}
            >
              <Leaf className="h-5 w-5 shrink-0 text-accent" />
              {sidebarOpen && (
                <div className="min-w-0">
                  <span className="block font-semibold text-[15px] tracking-tight truncate">
                    Folium
                  </span>
                  {appVersion && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <p
                          className="mt-0.5 truncate font-mono text-[10px] text-sidebar-muted"
                          aria-label={`App version ${appVersion}`}
                        >
                          v{appVersion}
                        </p>
                      </TooltipTrigger>
                      <TooltipContent side="right">{appVersion}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSidebarOpen((v) => !v)}
                  className={cn(
                    "rounded p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text",
                    sidebarOpen ? "ml-auto self-start" : "",
                  )}
                  aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                >
                  {sidebarOpen ? (
                    <ChevronLeft className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              </TooltipContent>
            </Tooltip>
          </div>

          <nav className="px-2 py-3 space-y-0.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon, badge }) => {
              const badgeCount =
                badge === "inbox"
                  ? inboxCount
                  : badge === "trash"
                    ? (trashCount?.total ?? 0)
                    : 0;
              const link = (
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                      !sidebarOpen && "justify-center px-0",
                      isActive
                        ? "bg-sidebar-active text-white"
                        : "text-sidebar-text hover:bg-sidebar-hover",
                    )
                  }
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1">{label}</span>
                      {badgeCount > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent/20 px-1.5 text-[11px] font-medium text-accent">
                          {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                      )}
                    </>
                  )}
                  {!sidebarOpen && badgeCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
                  )}
                </NavLink>
              );

              if (sidebarOpen) return <div key={to}>{link}</div>;

              return (
                <Tooltip key={to}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </nav>

          <div className="flex-1" />

          {sidebarOpen && <SidebarAiPipeline />}

          <div className={cn("border-t border-sidebar-border", sidebarOpen ? "p-3" : "p-2")}>
            <div className={cn("flex items-center", sidebarOpen ? "gap-2" : "flex-col gap-2")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-hover text-xs font-medium">
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
              {sidebarOpen && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {session?.user.display_name ?? "User"}
                  </p>
                  <p className="truncate text-[11px] text-sidebar-muted">
                    {session?.user.is_admin ? "Admin" : "User"}
                  </p>
                </div>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <NavLink
                    to="/settings"
                    aria-label="Settings"
                    className="rounded p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
                  >
                    <Settings className="h-4 w-4" />
                  </NavLink>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Log out"
                    onClick={handleLogout}
                    className="rounded p-1.5 text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Log out</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden bg-surface-muted">
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
