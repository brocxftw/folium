import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAsk, useFolders } from "@/lib/api/hooks";
import type { AskScope, AskResponse, Citation } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

export function AskWorkspace() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState("");
  const [scope, setScope] = useState<AskScope>("library");
  const [folderId, setFolderId] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);

  const ask = useAsk();
  const { data: folders = [] } = useFolders();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    try {
      const result = await ask.mutateAsync({
        question: question.trim(),
        scope,
        folder_id: scope === "folder" || scope === "folder_tree" ? folderId : undefined,
      });
      setResponse(result);
    } catch {
      setResponse({
        answer: "Unable to get an answer. Check that AI providers are configured in Settings.",
        citations: [],
        passages: [],
        provider: null,
        model: null,
        privacy_mode: "local_only",
        is_local: true,
        insufficient_evidence: true,
      });
    }
  };

  const openCitation = (citation: Citation) => {
    const params = citation.page_number ? `?page=${citation.page_number}` : "";
    navigate(`/documents/${citation.document_id}${params}`);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <div className="border-b border-surface-border bg-surface px-6 py-4">
        <h1 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-text-muted" />
          Ask
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Ask questions across your document library with evidence-backed answers.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {response ? (
          <div className="space-y-4">
            <div className="rounded-md border border-surface-border bg-surface p-4">
              <p className="text-[13px] text-text-primary whitespace-pre-wrap leading-relaxed">
                {response.answer}
              </p>
              {response.insufficient_evidence && (
                <p className="mt-2 text-xs text-warning">
                  Insufficient evidence found in the selected scope.
                </p>
              )}
              {(response.provider || response.model) && (
                <p className="mt-3 text-[11px] text-text-muted">
                  {response.provider}
                  {response.model && ` · ${response.model}`}
                  {response.is_local ? " · local" : " · remote"}
                </p>
              )}
            </div>

            {response.citations.length > 0 && (
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">
                  Sources
                </h3>
                <ul className="space-y-2">
                  {response.citations.map((c, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => openCitation(c)}
                        className={cn(
                          "w-full rounded-md border border-surface-border bg-surface p-3 text-left",
                          "hover:border-accent/30 hover:bg-surface-hover",
                        )}
                      >
                        <span className="text-[13px] font-medium text-accent">
                          {c.title}
                          {c.page_number ? ` — page ${c.page_number}` : ""}
                        </span>
                        {c.quote && (
                          <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                            &ldquo;{c.quote}&rdquo;
                          </p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="ghost" onClick={() => setResponse(null)}>
              Ask another question
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Sparkles className="h-10 w-10 text-text-muted/40 mb-3" />
            <p className="text-sm text-text-secondary">
              Ask a question about your documents
            </p>
            <p className="text-xs text-text-muted mt-1 max-w-sm">
              Answers include citations you can click to open the source document.
            </p>
          </div>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-surface-border bg-surface p-4 space-y-3"
      >
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What would you like to know?"
          className="min-h-[80px] resize-none"
          disabled={ask.isPending}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={scope} onValueChange={(v) => setScope(v as AskScope)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="library">Entire library</SelectItem>
              <SelectItem value="folder">Single folder</SelectItem>
              <SelectItem value="folder_tree">Folder & subfolders</SelectItem>
              <SelectItem value="search">Search results</SelectItem>
            </SelectContent>
          </Select>
          {(scope === "folder" || scope === "folder_tree") && (
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="w-[200px]">
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
          <Button
            type="submit"
            className="ml-auto gap-1"
            disabled={!question.trim() || ask.isPending}
          >
            <Send className="h-3.5 w-3.5" />
            {ask.isPending ? "Thinking…" : "Ask"}
          </Button>
        </div>
        <p className="text-[11px] text-text-muted">
          AI responses can be inaccurate. Please verify important information.
        </p>
      </form>
    </div>
  );
}
