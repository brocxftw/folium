/** Mirrors backend normalize_display_citation_text for UI unit coverage. */
export function normalizeDisplayCitationTextForTest(text: string): string {
  let cleaned = text;
  let previous: string | null = null;
  while (previous !== cleaned) {
    previous = cleaned;
    cleaned = cleaned.replace(/\[(\d+)\](?:\s*)\[\1\]/g, "[$1]");
  }
  cleaned = cleaned.replace(/\[(\d+)\]\s+([.,;:!?])/g, "[$1]$2");
  cleaned = cleaned.replace(/[^\S\n]{2,}/g, " ");
  cleaned = cleaned.replace(/\s+([.,;:!?])/g, "$1");
  return cleaned;
}
