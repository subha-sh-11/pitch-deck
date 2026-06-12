"use client";

import { useEffect, useRef } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { useSetupWizard } from "../SetupWizardContext";
import { useWorkshop } from "./workshop";
import { SLIDE_TYPE_LABELS } from "@/types/slide";

/**
 * Presentation-first Slide Workshop (Canva-style):
 *   [ compact strip: slide badge · inline instructions · Generate · Approve ]
 *   [ LARGE slide canvas with smooth horizontal motion ]
 *   [ thumbnail filmstrip — click to switch, active highlighted ]
 *   [ slim footer: progress · Assemble ]
 * The image prompt lives in the LEFT rail dock (see workshop.tsx).
 */
export function SlideWorkshop({ onAssembled }: { onAssembled: () => void }) {
  const { designDirection, generationStatus, generationProgress, generationError } =
    useSetupWizard();
  const {
    slides,
    index,
    setIndex,
    slide,
    busy,
    error,
    assembling,
    allApproved,
    generate,
    assemble,
  } = useWorkshop();

  const thumbRefs = useRef(new Map<string, HTMLButtonElement>());

  // Keep the active thumbnail centered in the strip.
  useEffect(() => {
    if (!slide) return;
    thumbRefs.current.get(slide.id)?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [slide]);

  if (generationStatus === "generating") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
        <p className="text-sm">Architecting your deck — {generationProgress}%</p>
        <p className="text-xs text-text-dim">Story analysis · design language · slide outline</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
        <p className="text-sm">No slides yet — hit “Build deck” to architect the outline.</p>
        {generationError && <p className="text-xs text-red-400">{generationError}</p>}
      </div>
    );
  }

  const current = slide!;
  const currentBusy = busy[current.id];

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ── Canvas: the slide is the hero; controls float on hover ── */}
      <div className="group relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full items-center transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)]"
          style={{ transform: `translateX(${-index * 100}%)` }}
        >
          {slides.map((s, i) => {
            const active = i === index;
            return (
              <div
                key={s.id}
                className={`relative w-full shrink-0 px-8 py-3 transition-opacity duration-500 ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="mx-auto aspect-video max-h-[calc(100vh-270px)] w-full max-w-[calc((100vh-270px)*1.7778)]">
                  {s.generated || busy[s.id] ? (
                    <div className="h-full w-full overflow-hidden rounded-xl shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
                      <SlideRenderer slide={s} designDirection={designDirection ?? undefined} />
                    </div>
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border-glass bg-surface-1/40">
                      <span className="rounded-full border border-accent-neon/30 bg-accent-neon/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-neon">
                        Slide {s.slideNumber} · {SLIDE_TYPE_LABELS[s.slideType]}
                      </span>
                      <h2 className="max-w-[70%] text-center font-display text-2xl font-semibold text-text-primary">
                        {s.title}
                      </h2>
                      {s.purpose && (
                        <p className="max-w-[60%] text-center text-sm leading-relaxed text-text-muted">
                          {s.purpose}
                        </p>
                      )}
                      {active && (
                        <button
                          type="button"
                          onClick={() => void generate()}
                          className="mt-1 rounded-full bg-accent-neon px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(248,201,164,0.3)] transition-colors hover:bg-accent-neon-dim"
                        >
                          ✦ Generate this slide
                        </button>
                      )}
                    </div>
                  )}
                  {active && currentBusy && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center gap-3 rounded-full bg-surface-1/95 px-5 py-2.5 text-sm font-medium text-text-primary shadow-lg">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent-neon border-t-transparent" />
                        {currentBusy === "image" ? "Generating image…" : "Writing the slide — copy, layout, artwork…"}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Assemble — floats in only when every slide is approved */}
        {allApproved && (
          <button
            type="button"
            disabled={assembling}
            onClick={() => {
              void assemble().then((ok) => ok && onAssembled());
            }}
            className="absolute bottom-4 right-10 z-10 rounded-full bg-accent-neon px-5 py-2 text-sm font-semibold text-zinc-950 shadow-[0_0_20px_rgba(248,201,164,0.4)] transition-colors hover:bg-accent-neon-dim disabled:cursor-not-allowed disabled:opacity-60"
          >
            {assembling ? "Assembling…" : "Assemble deck →"}
          </button>
        )}

        {/* Errors float too */}
        {error && (
          <p className="absolute bottom-4 left-10 z-10 max-w-[60%] rounded-full bg-red-950/80 px-3.5 py-1.5 text-[11px] text-red-300 backdrop-blur-sm">
            {error}
          </p>
        )}

        {/* Prev / next */}
        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex(Math.max(0, index - 1))}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-border-glass bg-surface-0/80 p-2.5 text-text-muted backdrop-blur transition-colors hover:text-text-primary"
            aria-label="Previous slide"
          >
            <Chevron dir="left" />
          </button>
        )}
        {index < slides.length - 1 && (
          <button
            type="button"
            onClick={() => setIndex(Math.min(slides.length - 1, index + 1))}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-border-glass bg-surface-0/80 p-2.5 text-text-muted backdrop-blur transition-colors hover:text-text-primary"
            aria-label="Next slide"
          >
            <Chevron dir="right" />
          </button>
        )}
      </div>

      {/* ── Filmstrip (Canva-style page access — large, numbered thumbnails) ── */}
      <div className="flex shrink-0 items-end gap-3 overflow-x-auto border-t border-border-glass bg-surface-0/40 px-4 py-3 [scrollbar-width:thin]">
        {slides.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              if (el) thumbRefs.current.set(s.id, el);
              else thumbRefs.current.delete(s.id);
            }}
            type="button"
            onClick={() => setIndex(i)}
            className={`group relative shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300 ${
              i === index
                ? "border-accent-neon shadow-[0_0_16px_rgba(248,201,164,0.3)]"
                : "border-border-glass opacity-70 hover:-translate-y-0.5 hover:opacity-100"
            }`}
            title={`${s.slideNumber}. ${s.title}`}
          >
            <div className="h-[113px] w-[200px] overflow-hidden bg-surface-1">
              {s.generated ? (
                <div
                  className="pointer-events-none origin-top-left"
                  style={{ width: 800, height: 452, transform: "scale(0.25)" }}
                >
                  <SlideRenderer slide={s} designDirection={designDirection ?? undefined} />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2">
                  <span className="line-clamp-2 text-center text-[11px] leading-tight text-text-dim">
                    {s.title || SLIDE_TYPE_LABELS[s.slideType]}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-text-dim/70">
                    not generated
                  </span>
                </div>
              )}
            </div>
            {/* Canva-style page number */}
            <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white/90 backdrop-blur-sm">
              {s.slideNumber}
            </span>
            <span
              className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ${
                s.status === "approved"
                  ? "bg-emerald-400"
                  : s.generated
                    ? "bg-accent-neon"
                    : "bg-zinc-600"
              }`}
            />
            {busy[s.id] && (
              <span className="absolute left-1.5 top-1.5 h-3 w-3 animate-spin rounded-full border border-accent-neon border-t-transparent" />
            )}
          </button>
        ))}
      </div>

    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      {dir === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}
