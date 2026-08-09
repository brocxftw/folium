import { Link } from "react-router-dom";
import { useAbout, useSession } from "@/lib/api/hooks";

export function AboutPage() {
  const { data, isLoading, error } = useAbout();
  const { data: session } = useSession();
  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header>
        <h1 className="text-xl font-semibold">About</h1>
        <p className="mt-1 text-sm text-text-secondary">Product information and privacy & data handling.</p>
      </header>
      {isLoading ? <p className="text-text-muted">Loading product information…</p> : error || !data ? (
        <p role="alert" className="text-danger">Product metadata is unavailable.</p>
      ) : (
        <section className="space-y-3" aria-labelledby="product-heading">
          <h2 id="product-heading" className="text-lg font-semibold">{data.product}</h2>
          <p className="text-text-secondary">{data.description}</p>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div><dt className="text-xs text-text-muted">Version</dt><dd className="font-mono">{data.version}</dd></div>
            <div><dt className="text-xs text-text-muted">Build revision</dt><dd className="font-mono">{data.build_revision || "Not supplied"}</dd></div>
            <div><dt className="text-xs text-text-muted">Build date</dt><dd>{data.build_date || "Not supplied"}</dd></div>
          </dl>
        </section>
      )}
      <section className="space-y-4 border-t border-surface-border pt-8" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" className="text-lg font-semibold">Privacy &amp; Data Handling</h2>
        <div className="space-y-3 text-sm leading-6 text-text-secondary">
          <p>Folium is local-first: documents, extracted text, metadata, and search indexes are stored in the deployment you or your administrator controls.</p>
          <p>AI providers are optional. Whether document content may leave the deployment is controlled by the administrator-managed AI Policy. Local-only mode blocks remote AI transmission; other modes still apply the configured operation permissions and confirmation behavior.</p>
          <p>Provider credentials are encrypted at rest and are never returned in full. Operational logs contain allowlisted application facts and are redacted; prompts, extracted document text, cookies, credentials, and authentication tokens are not intentionally persisted.</p>
        </div>
        {session?.user.is_admin ? (
          <Link className="inline-flex text-sm font-medium text-accent hover:underline" to="/settings/artificial-intelligence?tab=policy">Review AI Policy →</Link>
        ) : (
          <p className="text-sm text-text-muted">AI Policy is managed by your Folium administrator.</p>
        )}
      </section>
      {data && Object.keys(data.project_links).length > 0 && (
        <section className="space-y-3 border-t border-surface-border pt-8" aria-labelledby="links-heading">
          <h2 id="links-heading" className="text-lg font-semibold">Project links</h2>
          <ul className="flex flex-wrap gap-4">
            {Object.entries(data.project_links).map(([label, url]) => (
              <li key={label}><a href={url} target="_blank" rel="noreferrer" className="capitalize text-accent hover:underline">{label}</a></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
