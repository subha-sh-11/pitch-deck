"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getDeck } from "@/lib/api/deck";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { projectRoutes } from "@/lib/routes";
import {
  SLIDE_H,
  SLIDE_W,
  deckFileName,
  exportPDF,
  exportPNGZip,
  exportPPTX,
} from "@/lib/deck-export";
import type { Deck } from "@/types/deck";

type Exporter = (els: HTMLElement[], fileName: string, onProgress?: (i: number, t: number) => void) => Promise<void>;

export function ExportStudio({ projectId }: { projectId: string }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadErr, setLoadErr] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    getDeck(projectId)
      .then(setDeck)
      .catch(() => setLoadErr(true));
  }, [projectId]);

  useEffect(() => {
    const fit = () => setZoom(Math.min(1, (window.innerWidth - 64) / SLIDE_W));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const slides = deck?.slides ?? [];
  const design = deck?.designDirection ?? undefined;
  const fileName = deckFileName(String(slides[0]?.content?.heading || ""));

  const run = useCallback(
    async (label: string, fn: Exporter) => {
      setError("");
      setBusy(label);
      try {
        const els = refs.current.filter(Boolean) as HTMLElement[];
        await fn(els, fileName, (i, t) => setBusy(`Rendering slide ${i} / ${t}…`));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export failed. Try the Print option.");
      } finally {
        setBusy("");
      }
    },
    [fileName],
  );

  if (loadErr) {
    return (
      <Centered>
        <p className="text-lg text-white/80">No deck to export yet.</p>
        <p className="mt-1 text-sm text-white/50">Generate the deck first, then come back here.</p>
        <BackLink id={projectId} />
      </Centered>
    );
  }
  if (!deck) return <Centered><p className="text-white/60">Loading deck…</p></Centered>;
  if (!slides.length) {
    return (
      <Centered>
        <p className="text-lg text-white/80">This deck has no slides yet.</p>
        <BackLink id={projectId} />
      </Centered>
    );
  }

  const working = Boolean(busy);

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0c" }}>
      <div className="export-bar sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-white/10 bg-black/70 px-5 py-3 backdrop-blur">
        <BackLink id={projectId} inline />
        <span className="ml-1 mr-auto text-sm text-white/60">Export · {slides.length} slides</span>
        <Btn onClick={() => run("Building PDF…", exportPDF)} disabled={working} primary>
          Download PDF
        </Btn>
        <Btn onClick={() => run("Building PPTX…", exportPPTX)} disabled={working}>
          PowerPoint (.pptx)
        </Btn>
        <Btn onClick={() => run("Building images…", exportPNGZip)} disabled={working}>
          Images (.zip)
        </Btn>
        <Btn onClick={() => window.print()} disabled={working}>
          Print
        </Btn>
      </div>

      {(busy || error) && (
        <div className="export-bar px-5 py-2 text-sm" style={{ color: error ? "#fca5a5" : "#cbd5e1" }}>
          {error || busy}
        </div>
      )}

      <div className="mx-auto py-8" style={{ width: SLIDE_W * zoom }}>
        <div className="export-stage" style={{ zoom }}>
          {slides.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              className="export-slide mx-auto mb-8 overflow-hidden rounded-lg shadow-2xl shadow-black/50"
              style={{ width: SLIDE_W, height: SLIDE_H }}
            >
              <SlideRenderer slide={s} designDirection={design} />
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: ${SLIDE_W}px ${SLIDE_H}px; margin: 0; }
          html, body { margin: 0 !important; background: #0a0a0c !important; }
          .export-bar { display: none !important; }
          .export-stage { zoom: 1 !important; }
          .export-slide {
            width: ${SLIDE_W}px !important; height: ${SLIDE_H}px !important;
            margin: 0 !important; border-radius: 0 !important; box-shadow: none !important;
            page-break-after: always; break-after: page;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
        primary ? "bg-white text-black hover:bg-white/90" : "border border-white/15 text-white/85 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function BackLink({ id, inline }: { id: string; inline?: boolean }) {
  return (
    <Link
      href={projectRoutes.editor(id)}
      className={`text-sm text-white/70 hover:text-white ${inline ? "" : "mt-4 inline-block underline"}`}
    >
      ← Back to deck
    </Link>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      style={{ background: "#0a0a0c" }}
    >
      {children}
    </div>
  );
}
