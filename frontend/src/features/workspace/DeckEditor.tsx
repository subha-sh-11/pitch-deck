"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { mockDesignDirection, mockSlides } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";
import { SLIDE_TYPE_LABELS } from "@/types/slide";

interface DeckEditorProps {
  projectId: string;
}

export function DeckEditor({ projectId }: DeckEditorProps) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const slide = mockSlides[index];

  return (
    <div className="grid gap-6 xl:grid-cols-[180px_1fr_260px]">
      <div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-y-auto xl:max-h-[520px]">
        {mockSlides.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setIndex(i)}
            className={`shrink-0 rounded-lg border p-2 transition-colors xl:w-full ${
              i === index ? "border-accent-gold/50 bg-accent-gold/10" : "border-border-glass"
            }`}
          >
            <div className="aspect-video w-32 xl:w-full rounded bg-surface-3 mb-1" />
            <p className="text-xs text-text-dim">{s.slideNumber}</p>
            <p className="text-xs font-medium text-text-primary truncate">{s.title}</p>
          </button>
        ))}
      </div>

      <div>
        <SlideRenderer slide={slide} />
        <div className="mt-4 flex justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={index === mockSlides.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-text-primary">Properties</h3>
        <div className="space-y-2 text-sm">
          <p><span className="text-text-dim">Title:</span> {slide.title}</p>
          <p><span className="text-text-dim">Type:</span> {SLIDE_TYPE_LABELS[slide.slideType]}</p>
          <p><span className="text-text-dim">Layout:</span> {slide.layout.layoutType}</p>
          <Badge variant="muted">{slide.status}</Badge>
        </div>
        <div>
          <p className="text-xs text-text-dim mb-1">Design mood</p>
          <p className="text-sm text-text-muted">{mockDesignDirection.mood}</p>
        </div>
        <div>
          <p className="text-xs text-text-dim mb-1">Image prompt preview</p>
          <p className="text-xs text-text-muted line-clamp-3">
            {mockDesignDirection.visualStyle.slice(0, 2).join(", ")} — cinematic full-bleed
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" size="sm">Regenerate Design</Button>
          <Button variant="ghost" size="sm">Replace Image</Button>
          <Button variant="ghost" size="sm">Edit Layout</Button>
          <Button variant="ghost" size="sm">Duplicate Slide</Button>
        </div>
      </div>

      <div className="xl:col-span-3 flex justify-end">
        <Button onClick={() => router.push(projectRoutes.review(projectId))}>
          Go to Review
        </Button>
      </div>
    </div>
  );
}
