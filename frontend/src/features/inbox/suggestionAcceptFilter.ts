import type { Document, Suggestion } from "@/lib/api/types";
import { isSystemInboxPath } from "./formatMeta";

/** True when the user has chosen a filing destination (existing folder or new path). */
export function hasManualDestination(doc: Document): boolean {
  if (doc.pending_folder_path) return true;
  if (doc.folder_path && !isSystemInboxPath(doc.folder_path)) return true;
  return false;
}

/** Whether a pending suggestion should be applied on accept-all / bulk accept. */
export function shouldAcceptSuggestion(doc: Document, suggestion: Suggestion): boolean {
  if (suggestion.field === "folder" && hasManualDestination(doc)) {
    return false;
  }
  return true;
}
