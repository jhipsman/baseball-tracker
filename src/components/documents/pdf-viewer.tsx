"use client";

import { useEffect, useRef, useState } from "react";

const MAX_PAGES = 30;

/** Renders a PDF's pages to fit the screen (works on phones where inline PDFs don't). */
export function PdfViewer({ url, title }: { url: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The legacy build runs on older iPhones too.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const pdf = await pdfjs.getDocument({ url }).promise;
        if (cancelled || !box.current) return;
        setPages(pdf.numPages);
        const width = box.current.clientWidth || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        box.current.replaceChildren();
        for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
          const page = await pdf.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = "100%";
          canvas.className = "block rounded-lg bg-white ring-1 ring-zinc-200";
          canvas.setAttribute("aria-label", `${title}, page ${n}`);
          canvas.setAttribute("role", "img");
          box.current.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, title]);

  return (
    <div className="space-y-2">
      <div
        ref={box}
        className="max-h-[70vh] space-y-3 overflow-y-auto rounded-xl bg-zinc-100 p-2"
      />
      {state === "loading" ? <p className="text-sm text-zinc-500">Loading the form…</p> : null}
      {state === "error" ? (
        <p className="text-sm text-zinc-600">This PDF can&apos;t be shown here; open it below.</p>
      ) : null}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700"
      >
        Open the full PDF{pages > MAX_PAGES ? ` (${pages} pages)` : ""} ↗
      </a>
    </div>
  );
}
