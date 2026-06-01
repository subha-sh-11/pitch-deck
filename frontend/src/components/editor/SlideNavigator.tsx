"use client";

import { useState } from "react";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import { ADDABLE_SLIDE_TYPES } from "@/lib/regenerate-slide";
import type { Slide, SlideType } from "@/types/slide";
import { SLIDE_TYPE_LABELS } from "@/types/slide";
import { IconCamera, IconPlus } from "./EditorIcons";

interface SlideNavigatorProps {
  slides: Slide[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAddSlide: (slideType: SlideType) => void;
}

export function SlideNavigator({
  slides,
  activeIndex,
  onSelect,
  onAddSlide,
}: SlideNavigatorProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#E0E0E5] bg-[#F8F8FA]">
      <div className="border-b border-[#E0E0E5] p-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setAddOpen(!addOpen)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#D8D8E0] bg-white py-2.5 text-sm font-medium text-[#1A1A1F] shadow-sm transition-colors hover:border-[#4F46E5]/40 hover:bg-[#FAFAFC]"
          >
            <IconPlus />
            Add slide
          </button>
          {addOpen && (
            <>
              <div className="fixed inset-0 z-30" aria-hidden onClick={() => setAddOpen(false)} />
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#E0E0E5] bg-white py-1 shadow-xl">
                {ADDABLE_SLIDE_TYPES.map((item) => (
                  <button
                    key={item.slideType}
                    type="button"
                    className="block w-full px-4 py-2 text-left text-sm text-[#1A1A1F] hover:bg-[#F0F0F3]"
                    onClick={() => {
                      onAddSlide(item.slideType);
                      setAddOpen(false);
                    }}
                  >
                    {SLIDE_TYPE_LABELS[item.slideType]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {slides.map((slide, index) => {
          const active = index === activeIndex;
          const hasMedia =
            slide.appearance?.backgroundKey === "warm-portrait" ||
            slide.slideType === "cover";

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`group relative w-full text-left transition-all ${
                active
                  ? "rounded-lg ring-2 ring-[#4F46E5] ring-offset-2 ring-offset-[#F8F8FA]"
                  : "rounded-lg hover:ring-1 hover:ring-[#E0E0E5]"
              }`}
            >
              <span className="absolute -left-0.5 top-2 z-10 min-w-[18px] text-center text-[11px] font-medium tabular-nums text-[#9CA3AF]">
                {index + 1}
              </span>

              <div className="ml-5 overflow-hidden rounded-lg border border-[#E0E0E5] bg-white shadow-sm">
                <SlideThumbnailPreview slide={slide} active={active} />
              </div>

              {active && hasMedia && (
                <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-md bg-white/90 text-[#4F46E5] shadow-sm">
                  <IconCamera />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
