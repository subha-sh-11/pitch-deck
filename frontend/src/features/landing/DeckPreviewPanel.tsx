"use client";

import { useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { mockSlides } from "@/lib/mock/mock-deck";
import type { Slide } from "@/types/slide";

const PREVIEW_SLIDES: Slide[] = [
  mockSlides[0],
  mockSlides[1],
  mockSlides[2],
  mockSlides[9],
];

const GENRE_CHIPS = [
  "Survival Thriller",
  "Suspense Drama",
  "Childhood Comedy",
];

export function DeckPreviewPanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeSlide = PREVIEW_SLIDES[activeIndex];

  return (
    <div className="relative">
      <div className="landing-spotlight absolute -inset-8 rounded-3xl opacity-80" aria-hidden />
      <div className="glass-panel-strong relative rounded-2xl p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-accent-gold">
              Pitch Deck Preview
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-text-primary md:text-xl">
              The Tank
            </h3>
            <p className="text-xs text-text-dim">Feature Film · Investor Pitch</p>
          </div>
          <span className="rounded-full border border-border-glass bg-surface-2/80 px-3 py-1 text-xs text-text-muted">
            {activeIndex + 1} of 16
          </span>
        </div>

        <div className="overflow-hidden rounded-xl border border-border-glass shadow-2xl">
          <div className="pointer-events-none select-none [&_.font-display]:!text-2xl md:[&_.font-display]:!text-3xl lg:[&_.font-display]:!text-4xl [&_p]:!text-xs md:[&_p]:!text-sm">
            <SlideRenderer slide={activeSlide} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {PREVIEW_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`group overflow-hidden rounded-lg border transition-all ${
                index === activeIndex
                  ? "border-accent-gold/60 ring-1 ring-accent-gold/30"
                  : "border-border-glass opacity-70 hover:opacity-100 hover:border-accent-gold/30"
              }`}
            >
              <div className="pointer-events-none aspect-video [&_*]:!text-[6px] [&_.font-display]:!text-[8px]">
                <SlideRenderer slide={slide} className="!aspect-video" />
              </div>
              <p className="truncate px-1.5 py-1 text-[10px] text-text-muted group-hover:text-text-primary">
                {slide.title}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {GENRE_CHIPS.map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-border-glass bg-surface-2/60 px-2.5 py-0.5 text-[10px] text-text-muted"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
