"use client";

import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import type { Slide } from "@/types/slide";
import { SLIDE_TYPE_LABELS } from "@/types/slide";
import { slideContentToText } from "./slide-content-utils";

interface PreviewSlideListProps {
  slides: Slide[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function PreviewSlideList({ slides, selectedId, onSelect }: PreviewSlideListProps) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col rounded-2xl border border-white/[0.06] bg-[#0c0c0e]/80">
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6b7280]">
            Slides
          </h2>
          <span className="rounded-full bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-[#9CA3AF]">
            {slides.length}
          </span>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6b7280]">
          Select a slide to review and edit copy.
        </p>
      </div>

      <div className="preview-scroll flex-1 space-y-2 p-3">
        {slides.map((slide) => {
          const active = slide.id === selectedId;
          const preview = slideContentToText(slide.content);

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelect(slide.id)}
              className={`preview-slide-item w-full rounded-xl border p-3 text-left transition-all duration-200 ${
                active
                  ? "border-[#22d3ee]/50 bg-[#22d3ee]/[0.06] shadow-[0_0_0_1px_rgba(34,211,238,0.15)]"
                  : "border-transparent bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.04]"
              }`}
            >
              <div className="mb-2.5 overflow-hidden rounded-lg ring-1 ring-white/[0.06]">
                <SlideThumbnailPreview slide={slide} active={active} />
              </div>

              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold tabular-nums ${
                        active ? "text-[#22d3ee]" : "text-[#6b7280]"
                      }`}
                    >
                      {String(slide.slideNumber).padStart(2, "0")}
                    </span>
                    <p className="truncate text-sm font-medium text-[#F5F1E8]">
                      {slide.title}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-[#6b7280]">
                    {SLIDE_TYPE_LABELS[slide.slideType]}
                  </p>
                </div>
                {active && (
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#22d3ee]" />
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-[#6b7280]">
                {preview}
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
