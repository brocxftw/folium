import { useState } from "react";
import {
  useAIProviders,
  useProviderModels,
  useUpdateAIAssignment,
} from "@/lib/api/hooks";
import type { AIAssignment } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
import { WORKLOAD_COPY } from "./workloadCopy";

export function AssignmentDialog({
  assignment,
  onClose,
}: {
  assignment: AIAssignment;
  onClose: () => void;
}) {
  const { data: providers = [] } = useAIProviders();
  const mutation = useUpdateAIAssignment();
  const [providerId, setProviderId] = useState(assignment.provider_id || "");
  const [model, setModel] = useState(assignment.model || "");
  const { data: discovery, isFetching } = useProviderModels(providerId || null);
  const copy = WORKLOAD_COPY[assignment.role];
  const compatible = providers.filter((provider) =>
    assignment.role === "embedding"
      ? provider.enabled && provider.supports_embeddings
      : provider.enabled,
  );

  const save = async () => {
    await mutation.mutateAsync({
      role: assignment.role,
      provider_id: providerId || null,
      model: providerId ? model.trim() || null : null,
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change model — {copy.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-text-secondary">Provider</label>
            <Select
              value={providerId || "none"}
              onValueChange={(value) => {
                setProviderId(value === "none" ? "" : value);
                setModel("");
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unconfigured</SelectItem>
                {compatible.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {providerId && (
            <div>
              <label htmlFor="assignment-model" className="text-xs text-text-secondary">
                Model ID
              </label>
              {discovery?.models.length ? (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {discovery.models.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="assignment-model"
                  className="mt-1"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder={isFetching ? "Discovering models…" : "Enter provider model ID"}
                />
              )}
              {assignment.role === "embedding" && (
                <p className="mt-2 text-xs text-warning">
                  Changing this assignment may require re-embedding existing documents.
                </p>
              )}
            </div>
          )}
          {mutation.error && (
            <p role="alert" className="text-sm text-danger">
              {mutation.error.message}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            disabled={mutation.isPending || Boolean(providerId && !model.trim())}
          >
            Save assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
