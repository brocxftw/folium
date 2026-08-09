import { Link } from "react-router-dom";
import { FileQuestion } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <FileQuestion className="h-12 w-12 text-text-muted/40" />
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Page not found</h1>
        <p className="text-sm text-text-secondary mt-1">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
      </div>
      <Link
        to="/documents"
        className="inline-flex h-8 items-center rounded-md border border-surface-border bg-surface-muted px-3 text-[13px] font-medium hover:bg-surface-hover"
      >
        Go to Documents
      </Link>
    </div>
  );
}
