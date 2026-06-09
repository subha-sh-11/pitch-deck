"use client";

import { SlideRenderer } from "@/components/slides/SlideRenderer";
import type { ImageActions } from "@/components/slides/editing/SlideEditContext";
import type { DesignDirection } from "@/types/design";
import type { Slide, SlideAppearance, SlideContent } from "@/types/slide";
import { SlideContextBar } from "./SlideContextBar";

interface SlideCanvasProps {
  slide: Slide;
  zoom: number;
  designDirection?: DesignDirection;
  onAppearanceChange: (appearance: Partial<SlideAppearance>) => void;
  onContentChange?: (patch: Partial<SlideContent>) => void;
  imageActions?: ImageActions;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onResetStyle?: () => void;
}

export function SlideCanvas({
  slide,
  zoom,
  designDirection,
  onAppearanceChange,
  onContentChange,
  imageActions,
  onDuplicate,
  onDelete,
  onResetStyle,
}: SlideCanvasProps) {
  return (
    <div className="pitch-canvas relative flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 items-center justify-center overflow-auto p-4 pb-20">
        {/* Fit-to-canvas: the slide fills the available space at 16:9 (zoom = % of
            canvas height), letterboxed like a real presentation surface. */}
        <div
          className="aspect-video max-w-full shrink-0 transition-[height] duration-200 ease-out"
          style={{ height: `${zoom}%` }}
        >
          <div className="pitch-slide-shadow h-full w-full overflow-hidden rounded-lg bg-white ring-1 ring-[#E0E0E5]">
            <SlideRenderer
              slide={slide}
              designDirection={designDirection}
              className="rounded-none"
              editing
              onContentChange={onContentChange}
              imageActions={imageActions}
            />
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
