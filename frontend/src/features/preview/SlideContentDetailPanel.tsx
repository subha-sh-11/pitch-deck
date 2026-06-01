"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { Slide, SlideContent } from "@/types/slide";
import {
  applyEditableTextToSlide,
  blocksToEditableText,
  formatSlidePreviewBlocks,
} from "./format-slide-content";
import { SlideContentCards } from "./SlideContentCards";

interface SlideContentDetailPanelProps {
  slide: Slide;
  slideKey: string;
  totalSlides: number;
  onSave: (patch: Partial<SlideContent>) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  savedFlash: boolean;
}

export function SlideContentDetailPanel({
  slide,
  slideKey,
  totalSlides,
  onSave,
  onRegenerate,
  regenerating,
  savedFlash,
}: SlideContentDetailPanelProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    setEditing(false);
    setEditText(blocksToEditableText(formatSlidePreviewBlocks(slide)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on slide switch
  }, [slide.id]);

  function handleSaveEdit() {
    onSave(applyEditableTextToSlide(slide, editText));
    setEditing(false);
  }

  return (
    <article className="preview-slide-panel flex h-full min-h-0 flex-col overflow-hidden">
      <div key={slideKey} className="preview-fade-in flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-800/80 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">
              {slide.slideNumber} / {totalSlides}
            </p>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-zinc-100">
              {slide.title}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-zinc-500">{slide.purpose}</p>
          </div>
          {!editing && (
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={regenerating}
                onClick={onRegenerate}
              >
                {regenerating ? "…" : "Regenerate"}
              </Button>
              {savedFlash && (
                <span className="text-xs text-zinc-500">Saved</span>
              )}
            </div>
          )}
        </header>

        <div className="preview-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {editing ? (
            <div>
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={14}
                className="text-sm leading-relaxed"
              />
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <SlideContentCards slide={slide} />
          )}
        </div>
      </div>
    </article>
  );
}
