"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { parsePageRange, describePages } from "@/lib/pageRange";

type Props = {
  file: File;
  /** Page range already chosen for this file, so reopening the popup keeps it. */
  initialRange?: string;
  onApply: (pages: number[], rangeText: string, totalPages: number) => void;
  onClose: () => void;
};

async function loadPdf(file: File): Promise<PDFDocumentProxy> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

/** One page, drawn only once it scrolls into view (so a 200-page file does not render 200 canvases at once). */
function PageThumb({ pdf, pageNumber }: { pdf: PDFDocumentProxy; pageNumber: number }) {
  const holder = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setVisible(true), { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !canvas.current) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2, 520 / base.width) * Math.min(2, window.devicePixelRatio || 1);
      const vp = page.getViewport({ scale });
      const c = canvas.current;
      c.width = vp.width;
      c.height = vp.height;
      const t = page.render({ canvasContext: c.getContext("2d")!, viewport: vp });
      task = t;
      await t.promise.catch(() => {});
      if (!cancelled) setDone(true);
    })().catch(() => {});
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, pdf, pageNumber]);

  return (
    <div ref={holder} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="relative bg-slate-100">
        <canvas ref={canvas} className="block h-auto w-full" style={{ minHeight: done ? undefined : 180 }} />
        {!done && <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Loading…</div>}
      </div>
      <div className="border-t border-slate-100 py-1 text-center text-[11px] font-semibold text-slate-600">Page {pageNumber}</div>
    </div>
  );
}

export default function PdfPreviewDialog({ file, initialRange = "", onApply, onClose }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [failed, setFailed] = useState(false);
  const [range, setRange] = useState(initialRange);

  useEffect(() => {
    let doc: PDFDocumentProxy | null = null;
    let dead = false;
    loadPdf(file)
      .then((d) => {
        if (dead) return void d.destroy();
        doc = d;
        setPdf(d);
      })
      .catch(() => !dead && setFailed(true));
    return () => {
      dead = true;
      doc?.destroy();
    };
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const total = pdf?.numPages ?? 0;
  const parsed = useMemo(() => (pdf ? parsePageRange(range, total) : null), [pdf, range, total]);
  const pages = parsed?.ok ? parsed.pages : [];
  const allSelected = pages.length === total;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Preview and choose pages"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900/90">Preview your document</h2>
            <p className="truncate text-xs text-slate-900/60">
              {file.name}
              {pdf ? ` · ${total} page${total === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100">
            ×
          </button>
        </div>

        <div className="space-y-2 border-b border-slate-200 px-5 py-3">
          <label htmlFor="page-range" className="block text-xs font-semibold text-slate-700">
            Pages to print <span className="font-normal text-slate-500">(leave empty for all pages)</span>
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="page-range"
              value={range}
              onChange={(e) => setRange(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-10"
              inputMode="text"
              disabled={!pdf}
              className="input min-w-0 grow"
            />
            {range && (
              <button type="button" onClick={() => setRange("")} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">
                All pages
              </button>
            )}
          </div>
          {parsed && !parsed.ok && <p className="text-xs font-medium text-red-600">{parsed.error}</p>}
          {parsed?.ok && pdf && (
            <p className="text-xs text-slate-600">
              {allSelected ? `All ${total} pages will be printed.` : `${pages.length} of ${total} pages will be printed: ${describePages(pages)}`}
            </p>
          )}
        </div>

        <div className="min-h-[200px] grow overflow-y-auto bg-slate-50 px-5 py-4">
          {failed && (
            <p className="py-10 text-center text-sm text-slate-600">
              We couldn&apos;t show a preview of this PDF (it may be password-protected). You can still print the whole file.
            </p>
          )}
          {!failed && !pdf && <p className="py-10 text-center text-sm text-slate-500">Loading preview…</p>}
          {pdf && parsed?.ok && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {pages.map((n) => (
                <PageThumb key={n} pdf={pdf} pageNumber={n} />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn-secondary !w-auto px-5">
            Cancel
          </button>
          <button
            type="button"
            disabled={failed ? false : !pdf || !parsed?.ok}
            onClick={() => (failed ? onApply([], "", 0) : onApply(pages, allSelected ? "" : range.trim(), total))}
            className="btn-primary grow"
          >
            {failed || allSelected ? "Print all pages" : `Use ${pages.length} page${pages.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
    </div>
  );
}
