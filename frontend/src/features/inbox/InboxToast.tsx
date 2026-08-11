import { Button } from "@/components/ui/Button";

interface InboxToastProps {
  message: string | null;
  onDismiss: () => void;
}

export function InboxToast({ message, onDismiss }: InboxToastProps) {
  if (!message) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md border border-surface-border bg-surface px-4 py-2 text-sm shadow-lg">
      <div className="flex items-center gap-3">
        <span>{message}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-text-muted"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
