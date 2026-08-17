import { useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  useBackupRestoreStatus,
  useBackupSettings,
  useBackups,
  useCreateBackup,
  useDeleteBackup,
  useInspectBackup,
  useRestoreBackup,
  useUpdateBackupSettings,
  useVerifyBackup,
} from "@/lib/api/hooks";
import type { BackupRecord, BackupSettingsUpdate } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { formatBytes, formatDateTime } from "@/lib/utils";

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function BackupRestorePage() {
  const settings = useBackupSettings();
  const backups = useBackups({
    refetchInterval: 5000,
  });
  const restoreStatus = useBackupRestoreStatus(true);
  const update = useUpdateBackupSettings();
  const createBackup = useCreateBackup();
  const verify = useVerifyBackup();
  const inspect = useInspectBackup();
  const restore = useRestoreBackup();
  const remove = useDeleteBackup();
  const [confirm, setConfirm] = useState<{ type: "delete" | "restore"; record: BackupRecord } | null>(null);
  const [inspectText, setInspectText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const data = settings.data;
  const running = (backups.data || []).some((item) => item.status === "queued" || item.status === "running")
    || restoreStatus.data?.active;
  const repoUnavailable = data ? !data.repository.writable : false;

  const apply = async (patch: BackupSettingsUpdate) => {
    setError(null);
    try {
      await update.mutateAsync(patch);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save backup settings");
    }
  };

  const lastSuccessful = useMemo(
    () => (backups.data || []).find((item) => item.status === "completed"),
    [backups.data],
  );

  if (settings.isLoading) return <p className="p-6 text-text-muted">Loading backup settings…</p>;
  if (settings.error || !data) return <p role="alert" className="p-6 text-danger">Backup settings are unavailable.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <header>
        <h1 className="text-xl font-semibold">Backup &amp; Restore</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create versioned Folium backups of canonical library data. Derived artefacts such as thumbnails may rebuild after restore.
        </p>
      </header>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {restoreStatus.data?.active && (
        <p className="rounded-md bg-accent-muted px-3 py-2 text-sm text-accent">
          Restore in progress: {restoreStatus.data.stage}
        </p>
      )}
      {restoreStatus.data?.error && (
        <p role="alert" className="text-sm text-danger">Restore failed: {restoreStatus.data.error}</p>
      )}

      <section className="space-y-4" aria-labelledby="automatic-heading">
        <h2 id="automatic-heading" className="text-lg font-semibold">Automatic backups</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(event) => void apply({ enabled: event.target.checked })}
            disabled={update.isPending || !!running}
          />
          Enable automatic backups
        </label>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="text-xs text-text-muted">Schedule</label>
            <Select
              value={data.schedule_type}
              onValueChange={(value) => void apply({ schedule_type: value as BackupSettingsUpdate["schedule_type"] })}
              disabled={!data.enabled || update.isPending}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="interval_hours">Every N hours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {data.schedule_type !== "interval_hours" && (
            <div>
              <label className="text-xs text-text-muted">Time (UTC)</label>
              <Input
                className="mt-1"
                type="time"
                value={data.backup_time}
                onChange={(event) => void apply({ backup_time: event.target.value })}
                disabled={!data.enabled || update.isPending}
              />
            </div>
          )}
          {data.schedule_type === "weekly" && (
            <div>
              <label className="text-xs text-text-muted">Weekday</label>
              <Select
                value={String(data.weekday ?? 0)}
                onValueChange={(value) => void apply({ weekday: Number(value) })}
                disabled={!data.enabled || update.isPending}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WEEKDAYS.map((label, index) => (
                    <SelectItem key={label} value={String(index)}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {data.schedule_type === "interval_hours" && (
            <div>
              <label className="text-xs text-text-muted">Interval hours</label>
              <Input
                className="mt-1"
                type="number"
                min={1}
                value={data.interval_hours ?? 24}
                onChange={(event) => void apply({ interval_hours: Number(event.target.value) })}
                disabled={!data.enabled || update.isPending}
              />
            </div>
          )}
          <div>
            <label className="text-xs text-text-muted">Backups to keep</label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={365}
              value={data.retention_count}
              onChange={(event) => void apply({ retention_count: Number(event.target.value) })}
              disabled={update.isPending}
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Repository subdirectory</label>
            <Input
              className="mt-1"
              value={data.repository_subdir}
              placeholder="optional, inside /backups"
              onBlur={(event) => void apply({ repository_subdir: event.target.value })}
              disabled={update.isPending}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.verify_after_backup}
            onChange={(event) => void apply({ verify_after_backup: event.target.checked })}
            disabled={update.isPending}
          />
          Verify after creation
        </label>
      </section>

      <section className="space-y-4" aria-labelledby="status-heading">
        <h2 id="status-heading" className="text-lg font-semibold">Status</h2>
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Last successful backup", formatDateTime(data.last_success_at)],
            ["Last status", lastSuccessful?.status ?? "—"],
            ["Last backup size", lastSuccessful?.size_bytes == null ? "—" : formatBytes(lastSuccessful.size_bytes)],
            ["Next scheduled backup", formatDateTime(data.next_run_at)],
            ["Repository", data.repository.writable ? "writable" : data.repository.message],
            ["Free space", data.repository.free_bytes == null ? "Unavailable" : formatBytes(data.repository.free_bytes)],
          ].map(([label, value]) => (
            <div key={label} className="border-b border-surface-border pb-3">
              <dt className="text-xs text-text-muted">{label}</dt>
              <dd className="mt-1 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {repoUnavailable && (
          <p role="alert" className="text-sm text-danger">
            Backup repository is unavailable. Folium remains usable; backups will not run until `/backups` is writable.
          </p>
        )}
        <Button
          onClick={() => void Promise.resolve(createBackup.mutateAsync()).catch((err) => setError(err instanceof ApiError ? err.message : "Backup failed"))}
          disabled={createBackup.isPending || !!running || repoUnavailable}
        >
          {createBackup.isPending ? "Queuing…" : "Back up now"}
        </Button>
      </section>

      <section className="space-y-4" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">Backup history</h2>
        {(backups.data || []).length === 0 ? (
          <p className="text-sm text-text-muted">No backups yet.</p>
        ) : (
          <ul className="divide-y divide-surface-border rounded-md border border-surface-border">
            {(backups.data || []).map((item) => (
              <li key={item.filename} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="font-medium">{formatDateTime(item.created_at)}</p>
                  <p className="text-xs text-text-muted">
                    {item.size_bytes == null ? "—" : formatBytes(item.size_bytes)} · {item.folium_version || "unknown"} · {statusLabel(item.status)} · {statusLabel(item.verification_status)}
                    {item.progress_stage && item.status === "running" ? ` · ${item.progress_stage}` : ""}
                  </p>
                  {item.error_message && <p className="text-xs text-danger">{item.error_message}</p>}
                </div>
                {item.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Actions for ${item.filename}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={!!running}
                        onSelect={() => void inspect.mutateAsync(item.id!).then((result) => setInspectText(result.messages.join("\n") || "Backup is ready to restore"))}
                      >
                        Inspect
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!!running} onSelect={() => void verify.mutateAsync(item.id!)}>
                        Verify
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!!running} onSelect={() => setConfirm({ type: "restore", record: item })}>
                        Restore
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={!!running} onSelect={() => setConfirm({ type: "delete", record: item })}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.type === "restore" ? "Restore this backup?" : "Delete this backup?"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            {confirm?.type === "restore"
              ? "This replaces the current Folium library with the selected backup. This cannot be undone from the UI."
              : "The backup file will be removed from the repository."}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!confirm?.record.id) return;
                const action = confirm.type === "restore" ? restore.mutateAsync(confirm.record.id) : remove.mutateAsync(confirm.record.id);
                void action.catch((err) => setError(err instanceof ApiError ? err.message : "Action failed"));
                setConfirm(null);
              }}
            >
              {confirm?.type === "restore" ? "Restore Folium" : "Delete backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={inspectText != null} onOpenChange={(open) => !open && setInspectText(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Backup inspection</DialogTitle></DialogHeader>
          <p className="whitespace-pre-wrap text-sm text-text-secondary">{inspectText}</p>
          <DialogFooter>
            <Button onClick={() => setInspectText(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
