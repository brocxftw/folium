import { useEffect, useState } from "react";
import {
  useAdminSetPassword,
  useAdminUsers,
  useApprovePasswordReset,
  useCreateInvite,
  useDeleteAdminUser,
  useInvites,
  usePasswordResetRequests,
  useRejectPasswordReset,
  useRevokeInvite,
  useSession,
  useUpdateAdminUser,
} from "@/lib/api/hooks";
import {
  bytesFromStorageAmount,
  formatBytes,
  formatDate,
  storageAmountFromBytes,
  type StorageUnit,
} from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  SettingsContent,
  SettingsPageHeader,
  SettingsSection,
  SettingsStatusBadge,
} from "@/features/settings/components";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import type { UserAdmin } from "@/lib/api/types";

type ConfirmAction =
  | { type: "delete"; user: UserAdmin }
  | { type: "deactivate"; user: UserAdmin }
  | { type: "activate"; user: UserAdmin }
  | { type: "make_admin"; user: UserAdmin }
  | { type: "remove_admin"; user: UserAdmin }
  | { type: "set_password"; user: UserAdmin }
  | { type: "approve_reset"; id: string; username: string }
  | { type: "reject_reset"; id: string; username: string }
  | null;

export function UsersSettings() {
  const { data: session } = useSession();
  const { data: users = [], isLoading } = useAdminUsers();
  const { data: invites = [] } = useInvites();
  const { data: resetRequests = [] } = usePasswordResetRequests();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const setPassword = useAdminSetPassword();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const approveReset = useApprovePasswordReset();
  const rejectReset = useRejectPasswordReset();
  const [lastInvite, setLastInvite] = useState<string | null>(null);
  const [copiedResetLink, setCopiedResetLink] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction>(null);
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const selfId = session?.user.id;

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleCreateInvite = async () => {
    const invite = await createInvite.mutateAsync({});
    if (invite.invite_url_token) {
      const url = `${window.location.origin}/register?invite=${invite.invite_url_token}`;
      setLastInvite(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    setPasswordError(null);
    try {
      if (confirm.type === "delete") {
        await deleteUser.mutateAsync(confirm.user.id);
      } else if (confirm.type === "deactivate" || confirm.type === "activate") {
        await updateUser.mutateAsync({
          id: confirm.user.id,
          data: { is_active: confirm.type === "activate" },
        });
      } else if (confirm.type === "make_admin" || confirm.type === "remove_admin") {
        await updateUser.mutateAsync({
          id: confirm.user.id,
          data: { is_admin: confirm.type === "make_admin" },
        });
      } else if (confirm.type === "set_password") {
        if (newPassword.length < 8) {
          setPasswordError("Password must be at least 8 characters");
          return;
        }
        if (newPassword !== confirmPassword) {
          setPasswordError("Passwords do not match");
          return;
        }
        await setPassword.mutateAsync({ id: confirm.user.id, password: newPassword });
        setNewPassword("");
        setConfirmPassword("");
      } else if (confirm.type === "approve_reset") {
        const result = await approveReset.mutateAsync(confirm.id);
        if (result.reset_url_token) {
          const url = `${window.location.origin}/reset-password?token=${result.reset_url_token}`;
          setCopiedResetLink(url);
          await navigator.clipboard.writeText(url).catch(() => undefined);
        }
      } else if (confirm.type === "reject_reset") {
        await rejectReset.mutateAsync(confirm.id);
      }
      setConfirm(null);
    } catch (err) {
      if (confirm.type === "set_password") {
        setPasswordError(err instanceof Error ? err.message : "Failed to set password");
        return;
      }
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsContent>
      <SettingsPageHeader
        title="Users"
        description="Invite people, set quotas, and manage admin access."
      />

      <SettingsSection
        id="password-resets"
        title="Password reset requests"
        description="Approve a request, then share the one-time link with the user. Links expire after one hour."
        badge={
          resetRequests.length > 0 ? (
            <SettingsStatusBadge tone="info">{resetRequests.length} pending</SettingsStatusBadge>
          ) : undefined
        }
        className="scroll-mt-4"
      >
        {copiedResetLink && (
          <p className="text-xs text-text-secondary break-all rounded bg-surface-muted px-2 py-1.5">
            Reset link copied: {copiedResetLink}
          </p>
        )}
        <ul className="divide-y divide-surface-border rounded-lg border border-surface-border bg-surface">
          {resetRequests.length === 0 && (
            <li className="px-3 py-4 text-sm text-text-muted">No pending requests</li>
          )}
          {resetRequests.map((req) => (
            <li key={req.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-text-primary">
                  {req.display_name}{" "}
                  <span className="text-text-secondary">@{req.username}</span>
                </p>
                <p className="text-xs text-text-muted">Requested {formatDate(req.created_at)}</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setConfirm({ type: "approve_reset", id: req.id, username: req.username })
                }
              >
                Approve
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                onClick={() =>
                  setConfirm({ type: "reject_reset", id: req.id, username: req.username })
                }
              >
                Reject
              </Button>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        id="invitations"
        title="Invitations"
        description="Create a link to invite someone to this deployment."
        className="scroll-mt-4"
        actions={
          <Button size="sm" onClick={() => void handleCreateInvite()} disabled={createInvite.isPending}>
            Create invite
          </Button>
        }
      >
        {lastInvite && (
          <p className="text-xs text-text-secondary break-all rounded bg-surface-muted px-2 py-1.5">
            Invite copied: {lastInvite}
          </p>
        )}
        <ul className="divide-y divide-surface-border rounded-lg border border-surface-border bg-surface">
          {invites.length === 0 && (
            <li className="px-3 py-4 text-sm text-text-muted">No invites yet</li>
          )}
          {invites.map((invite) => (
            <li key={invite.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="text-text-primary">
                  {invite.used_at ? "Used" : "Open"} · expires {formatDate(invite.expires_at)}
                </p>
              </div>
              {!invite.used_at && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => void revokeInvite.mutateAsync(invite.id)}
                >
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        id="users"
        title="Users"
        description="Roles, status, and per-account limits."
        className="scroll-mt-4"
      >
        <div id="quotas" className="scroll-mt-4">
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-surface-border rounded-lg border border-surface-border bg-surface">
            {users.map((user) => {
              const isSelf = user.id === selfId;
              return (
                <li key={user.id} className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">
                      {user.display_name}{" "}
                      <span className="font-normal text-text-secondary">@{user.username}</span>
                      {isSelf && (
                        <span className="ml-1 text-xs font-normal text-text-muted">(you)</span>
                      )}
                    </p>
                    {user.is_admin && (
                      <span className="rounded bg-accent-muted px-1.5 py-0.5 text-[10px] font-medium text-accent">
                        Admin
                      </span>
                    )}
                    {!user.is_active && (
                      <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted">
                    Storage {formatBytes(user.storage_used_bytes)}
                    {user.storage_quota_bytes != null
                      ? ` / ${formatBytes(user.storage_quota_bytes)}`
                      : " / unlimited"}{" "}
                    · AI {user.ai_requests_this_month}
                    {user.ai_monthly_request_quota != null
                      ? ` / ${user.ai_monthly_request_quota}`
                      : " / unlimited"}
                  </p>
                  {!isSelf && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setConfirm({
                            type: user.is_admin ? "remove_admin" : "make_admin",
                            user,
                          })
                        }
                      >
                        {user.is_admin ? "Remove admin" : "Make admin"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setConfirm({
                            type: user.is_active ? "deactivate" : "activate",
                            user,
                          })
                        }
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setNewPassword("");
                          setConfirmPassword("");
                          setPasswordError(null);
                          setConfirm({ type: "set_password", user });
                        }}
                      >
                        Set password
                      </Button>
                      <StorageQuotaEditor
                        value={user.storage_quota_bytes}
                        onSave={(value, clear) =>
                          void updateUser.mutateAsync({
                            id: user.id,
                            data: clear
                              ? { clear_storage_quota: true }
                              : { storage_quota_bytes: value },
                          })
                        }
                      />
                      <QuotaEditor
                        label="AI req/mo"
                        value={user.ai_monthly_request_quota}
                        onSave={(value, clear) =>
                          void updateUser.mutateAsync({
                            id: user.id,
                            data: clear
                              ? { clear_ai_quota: true }
                              : { ai_monthly_request_quota: value },
                          })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        onClick={() => setConfirm({ type: "delete", user })}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                  {isSelf && (
                    <p className="text-xs text-text-muted">
                      You cannot delete, deactivate, demote, or change quotas on your own account.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </SettingsSection>

      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setNewPassword("");
            setConfirmPassword("");
            setPasswordError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle(confirm)}</DialogTitle>
          </DialogHeader>
          {confirm?.type === "set_password" ? (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Set a new password for @{confirm.user.username}. They will be signed out of all
                sessions.
              </p>
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
                <label className="text-xs text-text-secondary">Confirm password</label>
                <Input
                  type="password"
                  className="mt-1"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              {passwordError && <p className="text-xs text-danger">{passwordError}</p>}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">{confirmBody(confirm)}</p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirm(null);
                setNewPassword("");
                setConfirmPassword("");
                setPasswordError(null);
              }}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              variant={
                confirm?.type === "delete" || confirm?.type === "reject_reset" ? "danger" : "default"
              }
              onClick={() => void runConfirm()}
              disabled={
                busy ||
                (confirm?.type === "set_password" &&
                  (newPassword.length < 8 || !confirmPassword))
              }
            >
              {confirmPrimary(confirm)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsContent>
  );
}

function confirmTitle(action: ConfirmAction): string {
  if (!action) return "";
  switch (action.type) {
    case "delete":
      return "Delete user";
    case "deactivate":
      return "Deactivate user";
    case "activate":
      return "Activate user";
    case "make_admin":
      return "Make admin";
    case "remove_admin":
      return "Remove admin";
    case "set_password":
      return "Set password";
    case "approve_reset":
      return "Approve password reset";
    case "reject_reset":
      return "Reject password reset";
  }
}

function confirmBody(action: ConfirmAction): string {
  if (!action) return "";
  switch (action.type) {
    case "delete":
      return `Permanently delete ${action.user.username} and all of their documents? This cannot be undone.`;
    case "deactivate":
      return `Deactivate ${action.user.username}? They will be signed out and cannot sign in until reactivated.`;
    case "activate":
      return `Reactivate ${action.user.username}?`;
    case "make_admin":
      return `Grant admin access to ${action.user.username}? Admins can manage users and AI settings.`;
    case "remove_admin":
      return `Remove admin access from ${action.user.username}?`;
    case "set_password":
      return "";
    case "approve_reset":
      return `Approve a password reset for @${action.username}? You will get a one-time link to share with them.`;
    case "reject_reset":
      return `Reject the password reset request for @${action.username}?`;
  }
}

function confirmPrimary(action: ConfirmAction): string {
  if (!action) return "Confirm";
  switch (action.type) {
    case "delete":
      return "Delete";
    case "deactivate":
      return "Deactivate";
    case "activate":
      return "Activate";
    case "make_admin":
      return "Make admin";
    case "remove_admin":
      return "Remove admin";
    case "set_password":
      return "Set password";
    case "approve_reset":
      return "Approve & copy link";
    case "reject_reset":
      return "Reject";
  }
}

function StorageQuotaEditor({
  value,
  onSave,
}: {
  value: number | null | undefined;
  onSave: (value: number | null, clear: boolean) => void;
}) {
  const initial = value != null ? storageAmountFromBytes(value) : { amount: 1, unit: "GB" as StorageUnit };
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(initial.amount));
  const [unit, setUnit] = useState<StorageUnit>(initial.unit);

  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          const next = value != null ? storageAmountFromBytes(value) : { amount: 1, unit: "GB" as StorageUnit };
          setAmount(String(next.amount));
          setUnit(next.unit);
          setOpen(true);
        }}
      >
        Set storage
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Input
        className="h-7 w-20"
        value={amount}
        placeholder="unlimited"
        onChange={(e) => setAmount(e.target.value)}
      />
      <Select value={unit} onValueChange={(v) => setUnit(v as StorageUnit)}>
        <SelectTrigger className="h-7 w-[72px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MB">MB</SelectItem>
          <SelectItem value="GB">GB</SelectItem>
          <SelectItem value="TB">TB</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={() => {
          if (!amount.trim()) onSave(null, true);
          else {
            const n = Number(amount);
            if (!Number.isFinite(n) || n <= 0) return;
            onSave(bytesFromStorageAmount(n, unit), false);
          }
          setOpen(false);
        }}
      >
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

function QuotaEditor({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null | undefined;
  onSave: (value: number | null, clear: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : "");
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Set {label}
      </Button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input
        className="h-7 w-28"
        value={draft}
        placeholder="unlimited"
        onChange={(e) => setDraft(e.target.value)}
      />
      <Button
        size="sm"
        onClick={() => {
          if (!draft.trim()) onSave(null, true);
          else onSave(Number(draft), false);
          setOpen(false);
        }}
      >
        Save
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}
