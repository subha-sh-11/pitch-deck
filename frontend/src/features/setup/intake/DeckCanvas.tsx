"use client";

import { useMemo } from "react";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import { buildSlideFromOutline } from "@/lib/build-slides";
import type { SlideType } from "@/types/slide";
import type { Interview } from "./useInterview";

// Content-only gridded canvas where the deck appears live (toolbar lives in IntakeStudio).
const OUTLINE: { slideType: SlideType; title: string }[] = [
  { slideType: "cover", title: "Cover" },
  { slideType: "logline", title: "Logline" },
  { slideType: "synopsis", title: "Synopsis" },
  { slideType: "character", title: "Characters" },
  { slideType: "visual_aesthetic", title: "Visual Aesthetic" },
];

export function DeckCanvas({ iv }: { iv: Interview }) {
  const form = iv.form;
  const hasContent = Boolean(
    (form.title || "").trim() || (form.logline || "").trim() || (form.synopsis || "").trim(),
  );
  const slides = useMemo(
    () => OUTLINE.map((o, i) => buildSlideFromOutline({ ...o, purpose: "" }, form, i + 1, `canvas-${o.slideType}`)),
    [form],
  );

  return (
    <div
      className="relative h-full overflow-y-auto"
      style={{
        backgroundColor: "rgb(10 10 12)",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      {!hasContent ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <SketchIcon />
          <p className="font-display text-2xl text-text-muted">Your deck will appear here</p>
          <p className="max-w-sm text-sm text-text-dim">
            Describe your film on the left or fill the brief. As your story comes together, the
            slides take shape here — live.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {slides.map((s, i) => (
            <figure key={s.id} className="group">
              <figcaption className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-dim">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-3 text-[9px] text-text-muted">
                  {i + 1}
                </span>
                {s.title}
              </figcaption>
              <div className="overflow-hidden rounded-xl border border-border-glass shadow-2xl shadow-black/40 ring-1 ring-white/5 transition-transform group-hover:-translate-y-0.5">
                <SlideThumbnailPreview slide={s} />
              </div>
            </figure>
          ))}
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}

function SketchIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" className="text-text-dim">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </svg>
  );
}
