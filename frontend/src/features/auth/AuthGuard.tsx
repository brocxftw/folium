import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "@/lib/api/hooks";
import { AppShell } from "@/components/layout/AppShell";

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface-muted text-text-muted text-sm">
      Loading…
    </div>
  );
}

export function AuthGuard() {
  const { data: session, isLoading } = useSession();
  const location = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export function GuestGuard() {
  const { data: session, isLoading } = useSession();

  if (isLoading) return <LoadingScreen />;

  if (session) {
    return <Navigate to="/documents" replace />;
  }

  return <Outlet />;
}
