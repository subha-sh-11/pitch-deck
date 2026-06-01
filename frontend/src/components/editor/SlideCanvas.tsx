"use client";

import { SlideRenderer } from "@/components/slides/SlideRenderer";
import type { Slide, SlideAppearance } from "@/types/slide";
import { SlideContextBar } from "./SlideContextBar";

interface SlideCanvasProps {
  slide: Slide;
  zoom: number;
  onAppearanceChange: (appearance: Partial<SlideAppearance>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onResetStyle?: () => void;
}

export function SlideCanvas({
  slide,
  zoom,
  onAppearanceChange,
  onDuplicate,
  onDelete,
  onResetStyle,
}: SlideCanvasProps) {
  return (
    <div className="pitch-canvas relative flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 items-center justify-center overflow-auto p-8 pb-24">
        <div
          className="w-full max-w-[920px] transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "center center",
          }}
        >
          <div className="pitch-slide-shadow overflow-hidden rounded-lg bg-white ring-1 ring-[#E0E0E5]">
            <SlideRenderer slide={slide} className="rounded-none" />
          </div>
        </div>
      </div>

      <SlideContextBar
        slide={slide}
        onAppearanceChange={onAppearanceChange}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        onResetStyle={onResetStyle}
      />
    </div>
  );
}
