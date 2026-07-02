"use client";

import { useEffect, useRef, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import {
  SLIDE_H,
  SLIDE_W,
  deckFileName,
  exportPDF,
  exportPPTX,
  waitForImages,
} from "@/lib/deck-export";
import type { DesignDirection } from "@/types/design";
import type { Slide } from "@/types/slide";

/**
 * Inline "Export PDF / PPTX" controls for the presentation page. On click it mounts a hidden,
 * full-size (1280×720) copy of the deck, waits for its images, captures each slide, and builds the
 * file — so the download is full-resolution without a permanent second render of the deck.
 */
export function DeckExportButtons({
  slides,
  design,
}: {
  slides: Slide[];
  design?: DesignDirection;
}) {
  const [pending, setPending] = useState<null | "pdf" | "pptx">(null);
  const [status, setStatus] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    (async () => {
      try {
        // Let the hidden stage mount, then wait for its images to load.
        await new Promise((r) => setTimeout(r, 60));
        if (stageRef.current) await waitForImages(stageRef.current);
        if (cancelled) return;
        const els = refs.current.filter(Boolean) as HTMLElement[];
        const name = deckFileName(String(slides[0]?.content?.heading || ""));
        const onProgress = (i: number, n: number) => setStatus(`Rendering slide ${i} / ${n}…`);
        if (pending === "pdf") await exportPDF(els, name, onProgress);
        else await exportPPTX(els, name, onProgress);
      } catch (e) {
        console.error("[deck export] failed:", e); // surface the real cause in the console
        if (!cancelled) {
          const msg = (e as Error)?.message || "unknown error";
          setStatus(`Export failed: ${msg.slice(0, 80)}`);
        }
        // keep the message briefly
        await new Promise((r) => setTimeout(r, 4000));
      } finally {
        if (!cancelled) {
          setStatus("");
          setPending(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pending, slides]);

  const busy = Boolean(pending);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => !busy && setPending("pdf")}
        disabled={busy}
        className="rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black transition hover:bg-white/90 disabled:opacity-40"
      >
        Export PDF
      </button>
      <button
        type="button"
        onClick={() => !busy && setPending("pptx")}
        disabled={busy}
        className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-40"
      >
        Export PPTX
      </button>
      {status && <span className="text-[11px] text-white/55">{status}</span>}

      {/* Hidden full-size render, mounted only while exporting. */}
      {pending && (
        <div
          ref={stageRef}
          aria-hidden
          style={{
            position: "fixed",
            left: -100000,
            top: 0,
            width: SLIDE_W,
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              style={{ width: SLIDE_W, height: SLIDE_H }}
            >
              <SlideRenderer slide={s} designDirection={design} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
