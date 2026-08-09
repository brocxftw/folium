import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  useChangePassword,
  useDeleteAvatar,
  useMyUsage,
  useMySessions,
  useRevokeSession,
  useSignOutOtherSessions,
  useSession,
  useUpdateProfile,
  useUploadAvatar,
} from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { formatBytes, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ProfileSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const { data: usage } = useMyUsage();
  const { data: sessions = [], isLoading: sessionsLoading } = useMySessions();
  const revokeSession = useRevokeSession();
  const signOutOthers = useSignOutOtherSessions();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [avatarBust, setAvatarBust] = useState(() => Date.now());

  useEffect(() => {
    if (session?.user) {
      setUsername(session.user.username);
      setDisplayName(session.user.display_name);
    }
  }, [session?.user]);

  const saveProfile = async () => {
    setProfileMsg(null);
    try {
      await updateProfile.mutateAsync({
        username: username.trim(),
        display_name: displayName.trim(),
      });
      setProfileMsg("Profile updated");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Update failed");
    }
  };

  const savePassword = async () => {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg("New password must be at least 8 characters");
      return;
    }
    try {
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      });
      navigate("/login", {
        replace: true,
        state: { notice: "Password updated. Sign in with your new password." },
      });
    } catch (err) {
      setPasswordMsg(err instanceof Error ? err.message : "Password change failed");
    }
  };

  const onAvatarSelected = async (file: File | undefined) => {
    if (!file) return;
    setProfileMsg(null);
    try {
      await uploadAvatar.mutateAsync(file);
      setAvatarBust(Date.now());
      setProfileMsg("Profile picture updated");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Avatar upload failed");
    }
  };

  const removeAvatar = async () => {
    setProfileMsg(null);
    try {
      await deleteAvatar.mutateAsync();
      setAvatarBust(Date.now());
      setProfileMsg("Profile picture removed");
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : "Could not remove avatar");
    }
  };

  const user = session?.user;
  const hasAvatar = !!user?.has_avatar;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Profile</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage your account details. Your documents stay private to you.
        </p>
      </div>
      {(location.state as { notice?: string } | null)?.notice && (
        <p role="status" className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {(location.state as { notice?: string }).notice}
        </p>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Account</h3>
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-lg font-medium text-text-primary ring-offset-2 hover:ring-2 hover:ring-accent"
            onClick={() => fileRef.current?.click()}
            title="Change profile picture"
          >
            {hasAvatar ? (
              <img
                src={api.avatarUrl(avatarBust)}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(user?.display_name || user?.username || "?")
            )}
          </button>
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={
                  user?.is_admin
                    ? "rounded bg-accent-muted px-2 py-0.5 text-xs font-medium text-accent"
                    : "rounded bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary"
                }
              >
                {user?.is_admin ? "Admin" : "User"}
              </span>
              <span className="text-xs text-text-muted">Account type</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploadAvatar.isPending}
              >
                Change picture
              </Button>
              {hasAvatar && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void removeAvatar()}
                  disabled={deleteAvatar.isPending}
                >
                  Use initials
                </Button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onAvatarSelected(e.target.files?.[0])}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-text-secondary">Username</label>
          <Input
            className="mt-1"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary">Display name</label>
          <Input
            className="mt-1"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        {profileMsg && <p className="text-xs text-text-secondary">{profileMsg}</p>}
        <Button
          type="button"
          size="sm"
          onClick={() => void saveProfile()}
          disabled={updateProfile.isPending}
        >
          Save profile
        </Button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Password</h3>
        <p className="text-xs text-text-muted">
          After changing your password you will be signed out and must sign in again.
        </p>
        <div>
          <label className="text-xs text-text-secondary">Current password</label>
          <Input
            type="password"
            className="mt-1"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary">New password</label>
          <Input
            type="password"
            className="mt-1"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-text-secondary">Confirm new password</label>
          <Input
            type="password"
            className="mt-1"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        {passwordMsg && <p className="text-xs text-danger">{passwordMsg}</p>}
        <Button
          type="button"
          size="sm"
          onClick={() => void savePassword()}
          disabled={
            changePassword.isPending ||
            !currentPassword ||
            newPassword.length < 8 ||
            !confirmPassword
          }
        >
          Change password
        </Button>
      </section>

      <section className="space-y-3 border-t border-surface-border pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-text-primary">Active sessions</h3>
            <p className="text-xs text-text-muted">Review and revoke devices signed in to your account.</p>
          </div>
          {sessions.filter((item) => !item.current).length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => signOutOthers.mutate()}
              disabled={signOutOthers.isPending}
            >
              Sign out other sessions
            </Button>
          )}
        </div>
        {sessionsLoading ? (
          <p className="text-sm text-text-muted">Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-text-muted">No active sessions found.</p>
        ) : (
          <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
            {sessions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-text-primary">
                    {item.user_agent || "Unknown device"} {item.current && <strong>(current)</strong>}
                  </p>
                  <p className="text-xs text-text-muted">
                    Last active {new Date(item.last_seen_at).toLocaleString()}
                    {item.ip_address ? ` · ${item.ip_address}` : ""}
                  </p>
                </div>
                {!item.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => revokeSession.mutate(item.id)}
                    disabled={revokeSession.isPending}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {user?.is_admin && (
        <section className="border-t border-surface-border pt-6">
          <Link
            to="/settings/profile/users"
            className="flex items-center justify-between rounded-md border border-surface-border p-4 text-sm hover:bg-surface-hover"
          >
            <span>
              <strong className="block text-text-primary">User administration</strong>
              <span className="text-text-muted">Manage invitations, roles, quotas, and password resets.</span>
            </span>
            <span aria-hidden="true">→</span>
          </Link>
        </section>
      )}

      {usage && (
        <section className="space-y-2">
          <h3 className="text-sm font-medium text-text-primary">Usage</h3>
          <p className="text-sm text-text-secondary">
            Storage: {formatBytes(usage.storage_used_bytes)}
            {usage.storage_quota_bytes != null
              ? ` / ${formatBytes(usage.storage_quota_bytes)}`
              : " (unlimited)"}
          </p>
          <p className="text-sm text-text-secondary">
            AI requests this month: {usage.ai_requests_this_month}
            {usage.ai_monthly_request_quota != null
              ? ` / ${usage.ai_monthly_request_quota}`
              : " (unlimited)"}
          </p>
        </section>
      )}
    </div>
  );
}
