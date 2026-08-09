import { useEffect, useState } from "react";
import { FolderUp, Search, Sparkles, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface DocumentsHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchCommit: (q: string) => void;
  onUploadFiles: () => void;
  onUploadFolder: () => void;
  uploadBusy?: boolean;
}

export function DocumentsHeader({
  title,
  subtitle,
  searchQuery,
  onSearchCommit,
  onUploadFiles,
  onUploadFolder,
  uploadBusy,
}: DocumentsHeaderProps) {
  const [draft, setDraft] = useState(searchQuery);

  useEffect(() => {
    setDraft(searchQuery);
  }, [searchQuery]);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-border bg-surface px-4 py-3">
      <div className="min-w-0">
        <h1 className="text-base font-semibold text-text-primary">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-xs text-text-secondary">{subtitle}</p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
        <form
          className="relative min-w-[200px] max-w-md flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchCommit(draft);
          }}
        >
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Filter by title or filename…"
            className="h-8 pl-8"
            aria-label="Filter documents"
          />
        </form>

        <Link
          to="/ask"
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-surface-border bg-surface-muted px-2 text-xs font-medium text-text-primary hover:bg-surface-hover"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Ask Folium
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={uploadBusy}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onUploadFiles}>
              <Upload className="h-3.5 w-3.5" />
              Upload files…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onUploadFolder}>
              <FolderUp className="h-3.5 w-3.5" />
              Upload folder…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
