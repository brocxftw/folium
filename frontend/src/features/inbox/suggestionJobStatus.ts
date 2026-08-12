import type { Job } from "@/lib/api/types";

export type SuggestionJobStatus = "none" | "running" | "failed" | "empty";

function latestMetadataSuggestionJob(jobs: Job[], documentId: string): Job | undefined {
  return jobs
    .filter((j) => j.document_id === documentId && j.job_type === "metadata_suggestion")
    .sort((a, b) => {
      const aAt = a.completed_at ?? a.started_at ?? a.created_at;
      const bAt = b.completed_at ?? b.started_at ?? b.created_at;
      return bAt.localeCompare(aAt);
    })[0];
}

export function suggestionJobStatusForDoc(
  jobs: Job[],
  documentId: string,
  suggestionsCount: number,
): SuggestionJobStatus {
  const latest = latestMetadataSuggestionJob(jobs, documentId);
  if (!latest) return "none";
  if (latest.status === "queued" || latest.status === "running") return "running";
  if (latest.status === "failed") return "failed";
  // Completed with 0 pending can mean "AI produced nothing" OR "user accepted
  // every suggestion". Keep the AI panel in both cases; only hard failures
  // should fall back to manual filing.
  if (latest.status === "completed" && suggestionsCount === 0) return "empty";
  return "none";
}

export function showSuggestionFailure(status: SuggestionJobStatus): boolean {
  return status === "failed";
}
