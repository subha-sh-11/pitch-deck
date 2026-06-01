"use client";

import { useEffect } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import type { Slide } from "@/types/slide";
import { IconChevronLeft, IconChevronRight, IconClose } from "./EditorIcons";

interface PresentationModeProps {
  slides: Slide[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function PresentationMode({
  slides,
  index,
  onIndexChange,
  onClose,
}: PresentationModeProps) {
  const slide = slides[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        onIndexChange(Math.min(slides.length - 1, index + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        onIndexChange(Math.max(0, index - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, slides.length, onClose, onIndexChange]);

  if (!slide) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="flex h-12 items-center justify-between px-4">
        <span className="text-sm text-white/60">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Exit presentation"
          className="rounded-lg p-2 text-white/80 hover:bg-white/10"
        >
          <IconClose />
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center px-8 pb-8">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onIndexChange(index - 1)}
          aria-label="Previous slide"
          className="mr-4 rounded-full p-3 text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          <IconChevronLeft className="h-8 w-8" />
        </button>

        <div className="w-full max-w-5xl">
          <SlideRenderer slide={slide} />
        </div>

        <button
          type="button"
          disabled={index >= slides.length - 1}
          onClick={() => onIndexChange(index + 1)}
          aria-label="Next slide"
          className="ml-4 rounded-full p-3 text-white/80 hover:bg-white/10 disabled:opacity-30"
        >
          <IconChevronRight className="h-8 w-8" />
        </button>
      </div>

      {slide.speakerNotes && (
        <div className="border-t border-white/10 bg-black/80 px-6 py-3">
          <p className="text-xs uppercase tracking-wider text-white/40">Speaker notes</p>
          <p className="mt-1 text-sm text-white/80">{slide.speakerNotes}</p>
        </div>
      )}
    </div>
  );
}
