/** Allow only safe highlight tags from Postgres ts_headline output. */
export function sanitizeSearchSnippet(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/&lt;(\/?)(b|em|mark)&gt;/gi, "<$1$2>");
}
