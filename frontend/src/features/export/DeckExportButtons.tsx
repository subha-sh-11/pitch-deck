"use client";

import { useEffect, useRef, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { OverlayMenuItem, OverlayPanel, useOverlay } from "@/components/ui/overlay";
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
 * The single "Export" menu for the presentation editor (PDF / PPTX live inside it).
 * On pick it mounts a hidden, full-size (1280×720) copy of the deck, waits for its
 * images, captures each slide, and builds the file — so the download is
 * full-resolution without a permanent second render of the deck.
 */
export function DeckExportMenu({
  slides,
  design,
}: {
  slides: Slide[];
  design?: DesignDirection;
}) {
  const menu = useOverlay("menu");
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
  const pick = (kind: "pdf" | "pptx") => {
    if (!busy) setPending(kind);
  };

  return (
    <div className="relative">
      <button
        type="button"
        {...menu.triggerProps}
        disabled={busy}
        aria-busy={busy}
        title="Download the deck as PDF or PowerPoint"
        className="flex h-10 items-center gap-1.5 rounded-lg border border-border-glass px-3.5 text-[13px] font-medium text-text-muted transition-colors hover:border-white/30 hover:text-text-primary disabled:opacity-50"
      >
        {busy ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
            {status || "Exporting…"}
          </>
        ) : (
          <>
            Export
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </>
        )}
      </button>

      <OverlayPanel state={menu} align="end" label="Export the deck" className="w-52 p-1">
        <MenuItem onClick={() => pick("pdf")} label="PDF document" hint="Best for sharing & review" />
        <MenuItem onClick={() => pick("pptx")} label="PowerPoint (.pptx)" hint="Editable slides" />
      </OverlayPanel>

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

function MenuItem({ onClick, label, hint }: { onClick: () => void; label: string; hint: string }) {
  return (
    <OverlayMenuItem onSelect={onClick} className="flex flex-col items-start gap-0.5">
      <span className="text-sm text-text-primary">{label}</span>
      <span className="text-[11px] text-text-dim">{hint}</span>
    </OverlayMenuItem>
  );
}
