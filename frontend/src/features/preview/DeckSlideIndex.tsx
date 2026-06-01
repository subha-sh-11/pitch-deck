"use client";

import type { Slide } from "@/types/slide";

interface DeckSlideIndexProps {
  slides: Slide[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function DeckSlideIndex({ slides, selectedId, onSelect }: DeckSlideIndexProps) {
  return (
    <div className="preview-slide-list flex h-full min-h-0 flex-col p-3">
      <p className="mb-2 px-2 text-xs font-medium text-zinc-500">
        Slides <span className="text-zinc-600">· {slides.length}</span>
      </p>

      <nav
        className="preview-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto"
        aria-label="Slide list"
      >
        {slides.map((slide, index) => {
          const active = slide.id === selectedId;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => onSelect(slide.id)}
              style={{ animationDelay: `${index * 25}ms` }}
              className={`preview-index-row preview-index-stagger preview-fade-in flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                active ? "preview-index-row--active" : ""
              }`}
            >
              <span
                className={`preview-index-num w-5 shrink-0 text-center text-xs tabular-nums ${
                  active ? "font-medium" : "text-zinc-600"
                }`}
              >
                {slide.slideNumber}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  active ? "font-medium text-zinc-200" : "text-zinc-500"
                }`}
              >
                {slide.title}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
