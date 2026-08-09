import { useEffect, useMemo, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useAICapabilities, useAsk, useFolders } from "@/lib/api/hooks";
import type {
  AskRequest,
  AskResponse,
  AskScope,
  Citation,
  Document,
  SearchScopeSnapshot,
} from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet";
import { CitationList } from "./CitationList";
import {
  summarizeScopeReadiness,
  type ScopeReadinessSummary,
} from "@/features/documents/scopeReadiness";

export type AIDrawerScopeKind =
  | "library"
  | "folder"
  | "folder_tree"
  | "documents"
  | "document"
  | "search";

export interface AIDrawerScope {
  kind: AIDrawerScopeKind;
  documentId?: string;
  documentIds?: string[];
  folderId?: string;
  search?: SearchScopeSnapshot;
  /** Documents used only for readiness preview (not sent if empty for library). */
  previewDocuments?: Document[];
  label?: string;
}

interface AIChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScope?: AIDrawerScope;
  onCitationClick: (citation: Citation) => void;
}

function scopeToRequest(
  scope: AIDrawerScope,
  question: string,
  confirmRemote: boolean,
): AskRequest {
  const base: AskRequest = {
    question,
    confirm_remote: confirmRemote,
    scope: scope.kind as AskScope,
  };
  switch (scope.kind) {
    case "document":
      return { ...base, document_id: scope.documentId };
    case "documents":
      return { ...base, document_ids: scope.documentIds };
    case "folder":
    case "folder_tree":
      return { ...base, folder_id: scope.folderId };
    case "search":
      return {
        ...base,
        search: scope.search,
        search_query: scope.search?.query,
      };
    default:
      return base;
  }
}

function defaultLabel(scope: AIDrawerScope): string {
  if (scope.label) return scope.label;
  switch (scope.kind) {
    case "library":
      return "Entire library";
    case "folder":
      return "Current folder";
    case "folder_tree":
      return "Folder & subfolders";
    case "documents":
      return `${scope.documentIds?.length ?? 0} selected`;
    case "document":
      return "Current document";
    case "search":
      return `Search: ${scope.search?.query ?? ""}`;
    default:
      return "Scope";
  }
}

export function AIChatDrawer({
  open,
  onOpenChange,
  initialScope,
  onCitationClick,
}: AIChatDrawerProps) {
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<AIDrawerScope>(
    initialScope ?? { kind: "library" },
  );
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [pendingRemote, setPendingRemote] = useState<AskRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = useAsk();
  const { data: policy } = useAICapabilities();
  const { data: folders = [] } = useFolders();

  useEffect(() => {
    if (open && initialScope) {
      setScope(initialScope);
      setResponse(null);
      setError(null);
      setPendingRemote(null);
    }
  }, [open, initialScope]);

  const readiness: ScopeReadinessSummary | null = useMemo(() => {
    const docs = scope.previewDocuments ?? [];
    if (docs.length === 0) return null;
    return summarizeScopeReadiness(docs, defaultLabel(scope));
  }, [scope]);

  const submit = async (confirmRemote = false) => {
    if (!question.trim()) return;
    setError(null);
    const body = scopeToRequest(scope, question.trim(), confirmRemote);
    if (
      (scope.kind === "folder" || scope.kind === "folder_tree") &&
      !body.folder_id
    ) {
      setError("Select a folder for this scope.");
      return;
    }
    if (scope.kind === "documents" && !body.document_ids?.length) {
      setError("Select at least one document.");
      return;
    }
    if (scope.kind === "document" && !body.document_id) {
      setError("Open a document to ask about it.");
      return;
    }
    if (scope.kind === "search" && !body.search?.query && !body.search_query) {
      setError("Run a search first to ask about results.");
      return;
    }

    try {
      const result = await ask.mutateAsync(body);
      setPendingRemote(null);
      setResponse(result);
    } catch (err) {
      if (err instanceof ApiError && err.isForbidden) {
        setPendingRemote(body);
        setError(
          err.message ||
            "This provider is remote. Confirm to send the question outside your host.",
        );
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : "Unable to get an answer. Check AI providers in Settings.",
      );
      setResponse(null);
    }
  };

  const scopeKind = scope.kind;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-text-muted" />
            Ask Folium
          </SheetTitle>
          <SheetDescription>
            Single-turn answers with citations from the selected scope.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 border-b border-surface-border px-4 py-3">
            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-muted">
                Scope
              </p>
              <Select
                value={scopeKind}
                onValueChange={(v) => {
                  const kind = v as AIDrawerScopeKind;
                  if (kind === "library") setScope({ kind: "library" });
                  else if (kind === "folder" || kind === "folder_tree") {
                    setScope({
                      kind,
                      folderId: scope.folderId ?? initialScope?.folderId,
                    });
                  } else if (kind === "search") {
                    setScope({
                      kind: "search",
                      search: scope.search ?? initialScope?.search,
                      previewDocuments:
                        scope.previewDocuments ?? initialScope?.previewDocuments,
                    });
                  } else if (kind === "documents") {
                    setScope({
                      kind: "documents",
                      documentIds:
                        scope.documentIds ?? initialScope?.documentIds ?? [],
                      previewDocuments:
                        scope.previewDocuments ?? initialScope?.previewDocuments,
                    });
                  } else {
                    setScope({
                      kind: "document",
                      documentId: scope.documentId ?? initialScope?.documentId,
                      previewDocuments:
                        scope.previewDocuments ?? initialScope?.previewDocuments,
                    });
                  }
                  setResponse(null);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="library">Entire library</SelectItem>
                  <SelectItem value="folder">Single folder</SelectItem>
                  <SelectItem value="folder_tree">Folder & subfolders</SelectItem>
                  <SelectItem value="documents">Selected documents</SelectItem>
                  <SelectItem value="document">Current document</SelectItem>
                  <SelectItem value="search">Search results</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(scopeKind === "folder" || scopeKind === "folder_tree") && (
              <Select
                value={scope.folderId ?? ""}
                onValueChange={(folderId) =>
                  setScope((s) => ({ ...s, folderId }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders
                    .filter((f) => f.kind === "normal")
                    .map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.path_cache}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            <div className="rounded-md bg-surface-muted px-2.5 py-2 text-[12px] text-text-secondary">
              <p className="font-medium text-text-primary">{defaultLabel(scope)}</p>
              {scopeKind === "search" && scope.search && (
                <p className="mt-0.5 text-[11px] text-text-muted">
                  {scope.search.mode ?? "hybrid"}
                  {scope.search.folder_id ? " · folder scoped" : ""}
                  {scope.search.tag_ids?.length
                    ? ` · ${scope.search.tag_ids.length} tag(s)`
                    : ""}
                </p>
              )}
              {readiness ? (
                <p className="mt-1 text-[11px] text-text-muted">
                  {readiness.askReady}/{readiness.total} ready for Ask
                  {readiness.semanticReady
                    ? ` · ${readiness.semanticReady} semantic`
                    : ""}
                  {readiness.unavailable
                    ? ` · ${readiness.unavailable} not indexed`
                    : ""}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-text-muted">
                  Scope readiness is estimated from visible documents when available.
                </p>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-3 scrollbar-thin">
            {response ? (
              <div className="space-y-4">
                <div className="rounded-md border border-surface-border bg-surface p-3">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-primary">
                    {response.answer}
                  </p>
                  {response.insufficient_evidence && (
                    <p className="mt-2 text-xs text-warning">
                      Insufficient evidence found in the selected scope.
                    </p>
                  )}
                  {(response.provider || response.model) && (
                    <p className="mt-2 text-[11px] text-text-muted">
                      {response.provider}
                      {response.model && ` · ${response.model}`}
                      {response.is_local ? " · local" : " · remote"}
                    </p>
                  )}
                </div>
                <CitationList
                  citations={response.citations}
                  onOpen={onCitationClick}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setResponse(null);
                    setQuestion("");
                  }}
                >
                  Ask another question
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Sparkles className="mb-3 h-8 w-8 text-text-muted/40" />
                <p className="text-sm text-text-secondary">
                  Ask a question about this scope
                </p>
                <p className="mt-1 max-w-xs text-xs text-text-muted">
                  Answers cite passages you can open in the document viewer.
                </p>
              </div>
            )}
          </div>

          <form
            className="space-y-2 border-t border-surface-border p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(false);
            }}
          >
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What would you like to know?"
              className="min-h-[72px] resize-none"
              disabled={ask.isPending}
            />
            {error && <p className="text-xs text-danger">{error}</p>}
            {pendingRemote && policy?.warn_before_remote_chat && (
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={ask.isPending}
                onClick={() => void submit(true)}
              >
                Confirm remote AI and ask
              </Button>
            )}
            <Button
              type="submit"
              className="w-full gap-1"
              disabled={!question.trim() || ask.isPending}
            >
              <Send className="h-3.5 w-3.5" />
              {ask.isPending ? "Thinking…" : "Ask"}
            </Button>
            <p className="text-[11px] text-text-muted">
              AI responses can be inaccurate. Verify important information.
            </p>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
