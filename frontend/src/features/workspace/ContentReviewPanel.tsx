"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { mockSlides } from "@/lib/mock/mock-deck";
import { projectRoutes } from "@/lib/routes";
import { SLIDE_TYPE_LABELS, type Slide } from "@/types/slide";

interface ContentReviewPanelProps {
  projectId: string;
}

function slideToEditableText(slide: Slide): string {
  const { content } = slide;
  if (content.body) return content.body;
  if (content.bullets) return content.bullets.join("\n");
  if (content.items) return content.items.map((i) => `${i.title}: ${i.description}`).join("\n");
  return content.heading;
}

export function ContentReviewPanel({ projectId }: ContentReviewPanelProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(mockSlides[0].id);
  const selected = mockSlides.find((s) => s.id === selectedId) ?? mockSlides[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="space-y-2 overflow-y-auto max-h-[600px]">
        {mockSlides.map((slide) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setSelectedId(slide.id)}
            className={`w-full rounded-xl border p-3 text-left transition-colors ${
              selectedId === slide.id
                ? "border-accent-gold/50 bg-accent-gold/10"
                : "border-border-glass hover:bg-surface-2"
            }`}
          >
            <span className="text-xs text-text-dim">{slide.slideNumber}</span>
            <p className="font-medium text-text-primary">{slide.title}</p>
          </button>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl font-semibold text-text-primary">
            {selected.title}
          </h3>
          <Badge variant="muted">{SLIDE_TYPE_LABELS[selected.slideType]}</Badge>
          <Badge variant={selected.status === "approved" ? "success" : "warning"}>
            {selected.status.replace("_", " ")}
          </Badge>
        </div>
        <p className="mb-4 text-sm text-text-muted">{selected.purpose}</p>
        <Textarea
          label="Heading"
          defaultValue={selected.content.heading}
          rows={1}
          className="min-h-0 mb-4"
        />
        <Textarea
          label="Content"
          defaultValue={slideToEditableText(selected)}
          rows={8}
        />
        {selected.aiRationale && (
          <p className="mt-4 text-xs text-text-dim">
            AI rationale: {selected.aiRationale}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" size="sm">Save Changes</Button>
          <Button variant="ghost" size="sm">Regenerate Slide</Button>
        </div>
      </div>

      <div className="lg:col-span-2 flex justify-end gap-4">
        <Button onClick={() => router.push(projectRoutes.design(projectId))}>
          Approve All Content
        </Button>
      </div>
    </div>
  );
}
