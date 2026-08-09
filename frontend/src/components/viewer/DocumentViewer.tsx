import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import { WorkerMessageHandler } from "pdfjs-dist/build/pdf.worker.min.mjs";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api/client";
import type { Document } from "@/lib/api/types";

// Bundle the worker into the main thread so Cursor/Electron (and other
// environments that block module Workers) can still render PDFs.
(globalThis as unknown as { pdfjsWorker?: { WorkerMessageHandler: unknown } }).pdfjsWorker = {
  WorkerMessageHandler,
};
pdfjsLib.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.min.mjs`;


interface DocumentViewerProps {
  document: Document | undefined;
  page?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

export function DocumentViewer({
  document,
  page: externalPage,
  onPageChange,
  className,
}: DocumentViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  const currentPage = externalPage ?? page;
  const docId = document?.id;
  const mime = document?.mime_type;

  useEffect(() => {
    if (externalPage !== undefined) setPage(externalPage);
  }, [externalPage]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    if (pdfRef.current) {
      void pdfRef.current.destroy();
      pdfRef.current = null;
    }
    setPdf(null);
    setFallbackUrl(null);
    setError(null);
    setTotalPages(1);
    setPage(1);

    if (!docId || !mime) return;

    const isPdf = mime === "application/pdf";
    const isImage = mime.startsWith("image/");
    const isText =
      mime.startsWith("text/") || mime === "application/json" || mime === "text/markdown";

    if (!isPdf && !isImage && !isText) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const url = api.downloadUrl(docId);

    void (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(`Failed to download file (${res.status})`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const typedBlob = new Blob([buffer], { type: mime });
        objectUrl = URL.createObjectURL(typedBlob);

        if (!isPdf) {
          setFallbackUrl(objectUrl);
          setLoading(false);
          return;
        }

        try {
          const proxy = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
          if (cancelled) {
            void proxy.destroy();
            return;
          }
          pdfRef.current = proxy;
          setPdf(proxy);
          setTotalPages(proxy.numPages);
          setFallbackUrl(objectUrl);
          setLoading(false);
        } catch (pdfErr: unknown) {
          // Electron / worker failures: fall back to native PDF frame.
          if (cancelled) return;
          console.warn("pdf.js failed, using native fallback", pdfErr);
          setFallbackUrl(objectUrl);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load document");
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      if (pdfRef.current) {
        void pdfRef.current.destroy();
        pdfRef.current = null;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docId, mime]);

  useLayoutEffect(() => {
    if (!pdf || mime !== "application/pdf") return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        renderTaskRef.current?.cancel();
        const pdfPage = await pdf.getPage(currentPage);
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const scale = (zoom / 100) * 1.25;
        const viewport = pdfPage.getViewport({ scale });
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const transform =
          outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;

        const task = pdfPage.render({
          canvasContext: ctx,
          canvas,
          viewport,
          transform,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "RenderingCancelledException") return;
        // Keep native iframe fallback visible if canvas render fails.
        console.warn("PDF canvas render failed", err);
      }
    };

    void renderPage();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pdf, mime, currentPage, zoom]);

  const goToPage = (p: number) => {
    const next = Math.max(1, Math.min(totalPages, p));
    setPage(next);
    onPageChange?.(next);
  };

  if (!document) {
    return (
      <div
        className={cn(
          "flex flex-1 items-center justify-center bg-white text-text-muted text-sm",
          className,
        )}
      >
        Select a document to preview
      </div>
    );
  }

  const isPdf = document.mime_type === "application/pdf";
  const isImage = document.mime_type.startsWith("image/");
  const isText =
    document.mime_type.startsWith("text/") ||
    document.mime_type === "application/json" ||
    document.mime_type === "text/markdown";
  const showCanvas = isPdf && !!pdf;

  return (
    <div className={cn("flex flex-col bg-white min-h-0", className)}>
      <div className="flex items-center gap-1 border-b border-surface-border bg-surface px-2 py-1.5 text-text-secondary shrink-0">
        <span className="flex-1 truncate text-xs text-text-primary">{document.title}</span>
        {isPdf && pdf && (
          <>
            <button
              type="button"
              className="h-7 w-7 rounded-md hover:bg-surface-hover disabled:opacity-40"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span className="text-xs tabular-nums">
              {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              className="h-7 w-7 rounded-md hover:bg-surface-hover disabled:opacity-40"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
            >
              ›
            </button>
            <button
              type="button"
              className="h-7 px-2 rounded-md text-xs hover:bg-surface-hover"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
            >
              −
            </button>
            <span className="text-xs w-10 text-center">{zoom}%</span>
            <button
              type="button"
              className="h-7 px-2 rounded-md text-xs hover:bg-surface-hover"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
            >
              +
            </button>
          </>
        )}
        <a
          href={api.downloadUrl(document.id)}
          download={document.original_filename}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-hover"
          title="Download original"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="relative flex-1 min-h-0 overflow-auto bg-white">
        {loading && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-text-muted text-sm bg-white/80">
            Loading…
          </p>
        )}
        {error && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-danger text-sm px-4 text-center bg-white">
            {error}
          </p>
        )}

        {showCanvas && (
          <div className="flex min-h-full justify-center p-4">
            <canvas ref={canvasRef} className="max-w-full shadow-sm border border-surface-border bg-white" />
          </div>
        )}

        {/* Native fallback when pdf.js is unavailable (e.g. some Electron shells). */}
        {!showCanvas && !loading && !error && fallbackUrl && isPdf && (
          <iframe
            src={fallbackUrl}
            title={document.title}
            className="h-full w-full min-h-[480px] border-0 bg-white"
          />
        )}

        {!loading && !error && fallbackUrl && isImage && (
          <div className="flex h-full items-start justify-center overflow-auto p-4">
            <img src={fallbackUrl} alt={document.title} className="max-w-full object-contain" />
          </div>
        )}

        {!loading && !error && fallbackUrl && isText && (
          <iframe
            src={fallbackUrl}
            title={document.title}
            className="h-full w-full min-h-[480px] border-0 bg-white"
          />
        )}

        {!loading && !error && !isPdf && !isImage && !isText && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
            <p className="text-sm">Preview not available for this file type</p>
            <a
              href={api.downloadUrl(document.id)}
              download={document.original_filename}
              className="text-accent hover:underline text-sm"
            >
              Download {document.original_filename}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
