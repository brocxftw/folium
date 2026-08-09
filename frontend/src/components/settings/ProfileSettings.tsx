import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useChangePassword,
  useMyUsage,
  useSession,
  useUpdateProfile,
} from "@/lib/api/hooks";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function ProfileSettings() {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const { data: usage } = useMyUsage();
  const updateProfile = useUpdateProfile();
  const changePassword = useChangePassword();

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

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

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Profile</h2>
        <p className="text-sm text-text-secondary mt-1">
          Manage your account details. Your documents stay private to you.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Account</h3>
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
