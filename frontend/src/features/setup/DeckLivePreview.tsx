"use client";

import { useMemo } from "react";
import { SlideThumbnailPreview } from "@/components/slides/SlideThumbnailPreview";
import { buildSlideFromOutline } from "@/lib/build-slides";
import type { SlideType } from "@/types/slide";
import { useSetupWizard } from "./SetupWizardContext";

// The handful of slides we render live as the conversation fills the brief.
const PREVIEW_OUTLINE: { slideType: SlideType; title: string; purpose: string }[] = [
  { slideType: "cover", title: "Cover", purpose: "" },
  { slideType: "logline", title: "Logline", purpose: "" },
  { slideType: "synopsis", title: "Synopsis", purpose: "" },
  { slideType: "character", title: "Characters", purpose: "" },
  { slideType: "visual_aesthetic", title: "Visual Aesthetic", purpose: "" },
];

export function DeckLivePreview() {
  const { formData, designDirection } = useSetupWizard();

  const hasContent = Boolean(
    (formData.title || "").trim() ||
      (formData.logline || "").trim() ||
      (formData.synopsis || "").trim(),
  );

  // Stable ids so the slides update in place (no remount) as the brief grows.
  const slides = useMemo(
    () =>
      PREVIEW_OUTLINE.map((o, i) =>
        buildSlideFromOutline(o, formData, i + 1, `preview-${o.slideType}`),
      ),
    [formData],
  );

  return (
    <div className="flex h-full flex-col bg-surface-1/30">
      <div className="flex items-center justify-between border-b border-border-glass px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-dim">
          Live deck preview
        </span>
        <span className="text-[10px] text-text-dim">
          {hasContent ? `${slides.length} slides` : "waiting for your story…"}
        </span>
      </div>

      {!hasContent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="aspect-video w-full max-w-md rounded-xl border border-dashed border-border-glass bg-surface-2/30" />
          <p className="max-w-xs text-sm text-text-dim">
            Your pitch deck builds here, live, as we talk. Describe your film on the left to begin.
          </p>
        </div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {slides.map((s, i) => (
            <div key={s.id}>
              <p className="mb-1.5 text-[10px] uppercase tracking-wider text-text-dim">
                {i + 1}. {s.title}
              </p>
              <div className="overflow-hidden rounded-lg border border-border-glass shadow-lg shadow-black/30">
                <SlideThumbnailPreview slide={s} designDirection={designDirection ?? undefined} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
