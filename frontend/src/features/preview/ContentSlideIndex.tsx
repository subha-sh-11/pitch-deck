"use client";

import type { Slide } from "@/types/slide";
import { SLIDE_TYPE_LABELS } from "@/types/slide";
import {
  assessSlideContentReliability,
  type ContentReliabilityStatus,
} from "./content-reliability";

interface ContentSlideIndexProps {
  slides: Slide[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const statusDot: Record<ContentReliabilityStatus, string> = {
  reliable: "bg-emerald-500",
  needs_review: "bg-amber-500",
  weak: "bg-red-500/90",
};

export function ContentSlideIndex({ slides, selectedId, onSelect }: ContentSlideIndexProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-white/[0.06] bg-[#0c0c0e]/80">
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6b7280]">
          Content index
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6b7280]">
          Text only — pick a slide to check relevance.
        </p>
      </div>

      <div className="preview-scroll flex-1 p-2">
        {slides.map((slide) => {
          const active = slide.id === selectedId;
          const reliability = assessSlideContentReliability(slide);

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelect(slide.id)}
              className={`preview-slide-item mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                active
                  ? "bg-[#22d3ee]/10 text-[#F5F1E8]"
                  : "text-[#9CA3AF] hover:bg-white/[0.04]"
              }`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${statusDot[reliability.status]}`}
                title={reliability.headline}
              />
              <span
                className={`w-6 shrink-0 text-[11px] font-bold tabular-nums ${
                  active ? "text-[#22d3ee]" : "text-[#6b7280]"
                }`}
              >
                {slide.slideNumber}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{slide.title}</span>
                <span className="block truncate text-[10px] text-[#6b7280]">
                  {SLIDE_TYPE_LABELS[slide.slideType]} · {reliability.score}%
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
