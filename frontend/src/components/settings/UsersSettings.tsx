import { useState } from "react";
import {
  useAdminUsers,
  useCreateInvite,
  useDeleteAdminUser,
  useInvites,
  useRevokeInvite,
  useUpdateAdminUser,
} from "@/lib/api/hooks";
import { formatBytes, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export function UsersSettings() {
  const { data: users = [], isLoading } = useAdminUsers();
  const { data: invites = [] } = useInvites();
  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();
  const [lastInvite, setLastInvite] = useState<string | null>(null);

  const handleCreateInvite = async () => {
    const invite = await createInvite.mutateAsync({});
    if (invite.invite_url_token) {
      const url = `${window.location.origin}/register?invite=${invite.invite_url_token}`;
      setLastInvite(url);
      await navigator.clipboard.writeText(url).catch(() => undefined);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Users</h2>
        <p className="text-sm text-text-secondary mt-1">
          Invite people, set quotas, and manage admin access. Document libraries stay private.
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-text-primary">Invite links</h3>
          <Button size="sm" onClick={() => void handleCreateInvite()} disabled={createInvite.isPending}>
            Create invite
          </Button>
        </div>
        {lastInvite && (
          <p className="text-xs text-text-secondary break-all rounded bg-surface-muted px-2 py-1.5">
            Invite copied: {lastInvite}
          </p>
        )}
        <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
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
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-text-primary">Accounts</h3>
        {isLoading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : (
          <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
            {users.map((user) => (
              <li key={user.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">
                    {user.display_name}{" "}
                    <span className="font-normal text-text-secondary">@{user.username}</span>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void updateUser.mutateAsync({
                        id: user.id,
                        data: { is_admin: !user.is_admin },
                      })
                    }
                  >
                    {user.is_admin ? "Remove admin" : "Make admin"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void updateUser.mutateAsync({
                        id: user.id,
                        data: { is_active: !user.is_active },
                      })
                    }
                  >
                    {user.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <QuotaEditor
                    label="Storage bytes"
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
                    onClick={() => {
                      if (confirm(`Delete ${user.username} and all their documents?`)) {
                        void deleteUser.mutateAsync(user.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
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
