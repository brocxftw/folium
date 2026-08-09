import { useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAskDocument } from "@/lib/api/hooks";
import type { AskResponse } from "@/lib/api/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";

interface DocumentAskInputProps {
  documentId: string | undefined;
  onCitationClick?: (documentId: string, page: number | null) => void;
  className?: string;
}

export function DocumentAskInput({
  documentId,
  onCitationClick,
  className,
}: DocumentAskInputProps) {
  const [question, setQuestion] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const ask = useAskDocument();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId || !question.trim()) return;

    try {
      const result = await ask.mutateAsync({
        documentId,
        question: question.trim(),
        scope: "document",
      });
      setResponse(result);
    } catch {
      setResponse({
        answer: "Unable to get an answer. AI may not be configured.",
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

  return (
    <div className={cn("border-t border-surface-border bg-surface", className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="h-4 w-4 shrink-0 text-text-muted" />
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask this document…"
          className="flex-1 h-8"
          disabled={!documentId || ask.isPending}
        />
        <Select defaultValue="document">
          <SelectTrigger className="w-[130px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="document">This document</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="icon"
          disabled={!documentId || !question.trim() || ask.isPending}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>

      {response && (
        <div className="border-t border-surface-border px-3 py-2 max-h-40 overflow-auto">
          <p className="text-[13px] text-text-primary whitespace-pre-wrap">{response.answer}</p>
          {response.citations.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {response.citations.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onCitationClick?.(c.document_id, c.page_number)}
                  className="rounded border border-surface-border px-2 py-0.5 text-[11px] text-accent hover:bg-accent-muted"
                >
                  {c.title}
                  {c.page_number ? ` p.${c.page_number}` : ""}
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 text-[11px] text-text-muted">
            AI responses can be inaccurate. Please verify important information.
          </p>
        </div>
      )}
    </div>
  );
}
