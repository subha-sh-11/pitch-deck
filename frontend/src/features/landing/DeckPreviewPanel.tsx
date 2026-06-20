"use client";

import { useEffect, useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import type { Slide } from "@/types/slide";

// Static sample slides — landing-page decoration only (not app data).
const PREVIEW_SLIDES: Slide[] = [
  {
    id: "preview-cover",
    slideNumber: 1,
    slideType: "cover",
    title: "Cover",
    purpose: "",
    content: {
      heading: "THE TANK",
      subheading: "A Devil On The Roof",
      body: "A contained Telugu survival thriller.",
    },
    layout: { template: "cover", layoutType: "full_bleed" },
    status: "approved",
  },
  {
    id: "preview-logline",
    slideNumber: 2,
    slideType: "logline",
    title: "Logline",
    purpose: "",
    content: {
      heading: "Logline",
      body: "Three kids are sealed inside a rooftop water tank as their city searches everywhere but above.",
    },
    layout: { template: "logline", layoutType: "centered_statement" },
    status: "approved",
  },
  {
    id: "preview-genre",
    slideNumber: 3,
    slideType: "genre_blend",
    title: "Genre Blend",
    purpose: "",
    content: {
      heading: "Genre Blend",
      items: [
        { title: "Survival Thriller", description: "A race against rising water." },
        { title: "Suspense Drama", description: "Helpless parents, hidden truth." },
        { title: "Childhood Comedy", description: "Mischief that turns to dread." },
      ],
    },
    layout: { template: "genre_blend", layoutType: "three_column" },
    status: "approved",
  },
  {
    id: "preview-visual",
    slideNumber: 4,
    slideType: "visual_aesthetic",
    title: "Visual Aesthetic",
    purpose: "",
    content: {
      heading: "Visual Aesthetic",
      body: "Dark concrete, water reflections, claustrophobic framing.",
      moodBlocks: [
        { label: "Concrete", color: "#2A2A2A" },
        { label: "Moss", color: "#3F5F4A" },
        { label: "Rust", color: "#8A4B2A" },
        { label: "Water", color: "#A9C6C7" },
      ],
    },
    layout: { template: "visual_aesthetic", layoutType: "moodboard" },
    status: "approved",
  },
];

const GENRE_CHIPS = [
  "Survival Thriller",
  "Suspense Drama",
  "Childhood Comedy",
];

export function DeckPreviewPanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const activeSlide = PREVIEW_SLIDES[activeIndex];

  useEffect(() => {
    // Flag mount on the next frame (not synchronously in the effect body) so the entrance
    // transition runs after first paint.
    const raf = requestAnimationFrame(() => setMounted(true));
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % PREVIEW_SLIDES.length);
    }, 5000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="landing-preview-float relative">
      <div
        className="landing-preview-glow pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-accent-neon/20 via-transparent to-accent-lime/10 blur-2xl"
        aria-hidden
      />

      <div className="landing-glass-strong relative overflow-hidden rounded-[1.75rem] p-5 md:p-6">
        <div className="absolute right-0 top-0 h-32 w-32 bg-gradient-to-bl from-accent-neon/10 to-transparent" />

        <div className="relative mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent-neon/90">
              Live preview
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold text-text-primary md:text-2xl">
              The Tank
            </h3>
            <p className="text-xs text-text-dim">Feature · Investor pitch</p>
          </div>
          <span className="landing-glass rounded-full px-3 py-1 text-xs font-medium tabular-nums text-text-muted">
            {activeIndex + 1} / 16
          </span>
        </div>

        <div
          className={`overflow-hidden rounded-xl ring-1 ring-white/[0.08] transition-opacity duration-500 ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pointer-events-none select-none shadow-2xl [&_.font-display]:!text-xl md:[&_.font-display]:!text-2xl [&_p]:!text-[10px] md:[&_p]:!text-xs">
            <SlideRenderer slide={activeSlide} />
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-4 gap-2">
          {PREVIEW_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`group overflow-hidden rounded-xl border text-left transition-all duration-300 ${
                index === activeIndex
                  ? "border-accent-neon/50 bg-accent-neon/[0.08] shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
              }`}
            >
              <div className="aspect-video overflow-hidden">
                <SlideThumbnailPreview slide={slide} active={index === activeIndex} />
              </div>
              <p className="truncate px-2 py-1.5 text-[10px] font-medium text-text-muted group-hover:text-text-primary">
                {slide.title}
              </p>
            </button>
          ))}
        </div>

        <div className="relative mt-4 flex flex-wrap gap-2">
          {GENRE_CHIPS.map((genre) => (
            <span
              key={genre}
              className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[10px] text-text-muted backdrop-blur-sm"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
