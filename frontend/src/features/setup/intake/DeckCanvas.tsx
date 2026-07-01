"use client";

import { useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import { DeckExportButtons } from "@/features/export/DeckExportButtons";
import { buildSlideFromOutline } from "@/lib/build-slides";
import { FALLBACK_DESIGN } from "@/lib/deck-themes";
import { projectRoutes } from "@/lib/routes";
import { useSmoothProgress } from "@/lib/use-smooth-progress";
import type { SlideType } from "@/types/slide";
import type { Interview } from "./useInterview";

// The "presentation tab". Before Build it shows a live sketch from the brief; the moment the
// director hits Build deck, real generation streams the actual slides in here — same page, no
// intermediate routes (Cloud-Design style).
const OUTLINE: { slideType: SlideType; title: string }[] = [
  { slideType: "cover", title: "Cover" },
  { slideType: "logline", title: "Logline" },
  { slideType: "synopsis", title: "Synopsis" },
  { slideType: "character", title: "Characters" },
  { slideType: "visual_aesthetic", title: "Visual Aesthetic" },
];

const DOT_BG: CSSProperties = {
  backgroundColor: "rgb(10 10 12)",
  backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
};

export function DeckCanvas({ iv }: { iv: Interview }) {
  const params = useParams();
  const projectId = (params?.id as string) || "";
  const form = iv.form;
  const real = iv.draftSlides;
  const generating = iv.generationStatus === "generating";
  const buildProgress = useSmoothProgress(iv.generationProgress, generating);

  // The deck's live design — driven by the agent (e.g. "make it blue") and applied to every
  // slide instantly via CSS vars. useInterview folds any agent override into iv.designDirection.
  const effectiveDesign = iv.designDirection ?? FALLBACK_DESIGN;

  const hasContent = Boolean(
    (form.title || "").trim() || (form.logline || "").trim() || (form.synopsis || "").trim(),
  );
  const sketch = useMemo(
    () => OUTLINE.map((o, i) => buildSlideFromOutline({ ...o, purpose: "" }, form, i + 1, `canvas-${o.slideType}`)),
    [form],
  );

  // 1 ── Real generated deck (after Build): stream slides as they arrive.
  if (real.length > 0) {
    return (
      <div className="relative h-full overflow-y-auto" style={DOT_BG}>
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border-glass bg-black/50 px-6 py-2.5 backdrop-blur">
          <span className="text-xs text-text-dim">
            {generating
              ? `Building your deck… ${buildProgress}%`
              : `Deck ready · ${real.length} slides · ask the producer to restyle`}
          </span>
          {!generating && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <DeckExportButtons slides={real} design={effectiveDesign} />
              {projectId && (
                <Link
                  href={projectRoutes.review(projectId)}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-white/10"
                >
                  Review
                </Link>
              )}
              {projectId && (
                <Link
                  href={projectRoutes.export(projectId)}
                  className="rounded-md border border-white/15 px-2.5 py-1 text-xs font-medium text-text-primary transition hover:bg-white/10"
                >
                  More ↓
                </Link>
              )}
            </div>
          )}
        </div>
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {real.map((s, i) => (
            <figure key={s.id} className="group">
              <figcaption className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-dim">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-3 text-[9px] text-text-muted">
                  {i + 1}
                </span>
                {s.title}
              </figcaption>
              <div className="overflow-hidden rounded-xl border border-border-glass shadow-2xl shadow-black/40 ring-1 ring-white/5 transition-transform group-hover:-translate-y-0.5">
                <SlideThumbnailPreview slide={s} designDirection={effectiveDesign} />
              </div>
            </figure>
          ))}
          {generating && <p className="py-3 text-center text-xs text-text-dim">Adding more slides…</p>}
          <div className="h-4" />
        </div>
      </div>
    );
  }

  // 2 ── Generation kicked off but no slides yet: progress state.
  if (generating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-8 text-center" style={DOT_BG}>
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent-neon/30 border-t-accent-neon" />
        <div>
          <p className="font-display text-2xl text-text-primary">Building your deck…</p>
          <p className="mt-1 text-sm text-text-muted">Drafting story, copy, and cinematic art. This can take up to a minute.</p>
        </div>
        <div className="h-1.5 w-64 overflow-hidden rounded-full bg-surface-3">
          <div
            className="h-full rounded-full bg-accent-neon transition-[width] duration-500"
            style={{ width: `${buildProgress}%` }}
          />
        </div>
      </div>
    );
  }

  // 3 ── Pre-build: live sketch from the brief, or empty state.
  return (
    <div className="relative h-full overflow-y-auto" style={DOT_BG}>
      {!hasContent ? (
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center">
          <div className="intake-halo pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full" />
          <div className="animate-intake-fade-in relative flex max-w-sm flex-col items-center gap-3">
            <SketchIcon />
            <p className="font-display text-3xl text-text-primary">Your deck will appear here</p>
            <p className="text-sm leading-relaxed text-text-muted">
              Describe your film on the left or fill the brief. When you hit{" "}
              <span className="text-text-primary">Build deck</span>, the real slides generate right here.
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
          {sketch.map((s, i) => (
            <figure key={s.id} className="group">
              <figcaption className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wider text-text-dim">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-surface-3 text-[9px] text-text-muted">
                  {i + 1}
                </span>
                {s.title}
              </figcaption>
              <div className="overflow-hidden rounded-xl border border-border-glass shadow-2xl shadow-black/40 ring-1 ring-white/5 transition-transform group-hover:-translate-y-0.5">
                <SlideThumbnailPreview slide={s} designDirection={effectiveDesign} />
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
