"use client";

import type { Slide } from "@/types/slide";

interface EditorFilmstripProps {
  slides: Slide[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function EditorFilmstrip({
  slides,
  activeIndex,
  onSelect,
}: EditorFilmstripProps) {
  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-border-glass bg-surface-1">
      <p className="border-b border-border-glass px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-dim">
        Slides
      </p>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => onSelect(index)}
            className={`w-full rounded-lg border p-2 text-left transition-colors ${
              index === activeIndex
                ? "border-accent-gold/50 bg-accent-gold/10"
                : "border-border-glass hover:bg-surface-2"
            }`}
          >
            <div className="mb-1 aspect-video rounded bg-surface-3" />
            <p className="text-[10px] text-text-dim">{slide.slideNumber}</p>
            <p className="truncate text-xs font-medium text-text-primary">
              {slide.title}
            </p>
          </button>
        ))}
      </div>
    </aside>
  );
}
